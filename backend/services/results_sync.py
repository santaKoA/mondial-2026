"""
Fetches finished match results from API-Football and updates the DB.
API: https://v3.football.api-sports.io  (league=1, season=2026)
Free tier: 100 calls/day — we poll every 10min during match windows only.
"""
import httpx
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from database import SessionLocal
import models
import scoring
from config import settings

logger = logging.getLogger(__name__)

API_URL = "https://v3.football.api-sports.io"
WC_LEAGUE = 1
WC_SEASON = 2026

# Map API (English) team names → Hebrew names in our DB
TEAM_NAME_MAP: dict[str, str] = {
    "Mexico": "מקסיקו",
    "Korea Republic": "דרום קוריאה",
    "South Korea": "דרום קוריאה",
    "Czechia": "צ'כיה",
    "Czech Republic": "צ'כיה",
    "South Africa": "דרום אפריקה",
    "Canada": "קנדה",
    "Qatar": "קטאר",
    "Switzerland": "שווייץ",
    "Bosnia and Herzegovina": "בוסניה והרצגובינה",
    "Bosnia": "בוסניה והרצגובינה",
    "Brazil": "ברזיל",
    "Haiti": "האיטי",
    "Scotland": "סקוטלנד",
    "Morocco": "מרוקו",
    "United States": 'ארה"ב',
    "USA": 'ארה"ב',
    "Paraguay": "פראגוואי",
    "Australia": "אוסטרליה",
    "Turkey": "טורקיה",
    "Türkiye": "טורקיה",
    "Germany": "גרמניה",
    "Cote d'Ivoire": "חוף השנהב",
    "Ivory Coast": "חוף השנהב",
    "Côte d'Ivoire": "חוף השנהב",
    "Ecuador": "אקוודור",
    "Curacao": "קוראסאו",
    "Curaçao": "קוראסאו",
    "Netherlands": "הולנד",
    "Holland": "הולנד",
    "Japan": "יפן",
    "Sweden": "שבדיה",
    "Tunisia": "טוניסיה",
    "Spain": "ספרד",
    "Cape Verde": "כף ורדה",
    "Cabo Verde": "כף ורדה",
    "Belgium": "בלגיה",
    "Egypt": "מצרים",
    "Iran": "איראן",
    "IR Iran": "איראן",
    "New Zealand": "ניו זילנד",
    "France": "צרפת",
    "Senegal": "סנגל",
    "Norway": "נורבגיה",
    "Iraq": "עיראק",
    "Argentina": "ארגנטינה",
    "Algeria": "אלג'יריה",
    "Austria": "אוסטריה",
    "Jordan": "ירדן",
    "Portugal": "פורטוגל",
    "DR Congo": "קונגו הדמוקרטית",
    "Congo DR": "קונגו הדמוקרטית",
    "Democratic Republic of Congo": "קונגו הדמוקרטית",
    "Uzbekistan": "אוזבקיסטן",
    "Colombia": "קולומביה",
    "England": "אנגליה",
    "Croatia": "קרואטיה",
    "Panama": "פנמה",
    "Ghana": "גאנה",
    "Saudi Arabia": "ערב הסעודית",
    "Uruguay": "אורוגוואי",
}

# Shared sync state
last_sync_at: datetime | None = None
last_sync_updated: int = 0
last_sync_error: str | None = None


def _headers() -> dict:
    return {
        "x-apisports-key": settings.FOOTBALL_API_KEY,
    }


def _to_hebrew(api_name: str) -> str | None:
    return TEAM_NAME_MAP.get(api_name)


def _apply_result(db, match: models.Match, home_score: int, away_score: int) -> bool:
    """Update match result and recalculate predictions. Returns True if changed."""
    if match.home_score == home_score and match.away_score == away_score and match.status == "finished":
        return False

    match.home_score = home_score
    match.away_score = away_score
    match.status = "finished"

    predictions = db.query(models.Prediction).filter(models.Prediction.match_id == match.id).all()
    for pred in predictions:
        pred.points = scoring.calculate_points(
            match.stage, home_score, away_score, pred.home_score, pred.away_score
        )
    return True


def _parse_fixture_dt(fixture: dict) -> datetime:
    raw = fixture["fixture"]["date"]
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(tzinfo=timezone.utc)


def _find_knockout_match_by_time(db, fixture_dt: datetime) -> models.Match | None:
    """Find the unassigned knockout match closest to fixture_dt (within ±2h)."""
    window = timedelta(hours=2)
    candidates = (
        db.query(models.Match)
        .filter(
            models.Match.stage != "group",
            models.Match.home_team_id.is_(None),
            models.Match.scheduled_at >= fixture_dt - window,
            models.Match.scheduled_at <= fixture_dt + window,
        )
        .all()
    )
    if not candidates:
        return None
    return min(candidates, key=lambda m: abs((m.scheduled_at - fixture_dt).total_seconds()))


async def sync_results() -> dict:
    """Fetch all WC fixtures from API, assign knockout teams + update scores."""
    global last_sync_at, last_sync_updated, last_sync_error

    if not settings.FOOTBALL_API_KEY:
        last_sync_error = "FOOTBALL_API_KEY לא מוגדר"
        return {"error": last_sync_error}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{API_URL}/fixtures",
                params={"league": WC_LEAGUE, "season": WC_SEASON},
                headers=_headers(),
            )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        last_sync_error = str(e)
        logger.error(f"API-Football fetch error: {e}")
        return {"error": str(e)}

    fixtures = data.get("response", [])
    scores_updated = 0
    teams_assigned = 0
    unknown_teams: list[str] = []

    db = SessionLocal()
    try:
        for fixture in fixtures:
            home_api = fixture["teams"]["home"]["name"]
            away_api = fixture["teams"]["away"]["name"]
            status = fixture["fixture"]["status"]["short"]

            home_heb = _to_hebrew(home_api)
            away_heb = _to_hebrew(away_api)
            if not home_heb or not away_heb:
                unknown_teams.append(f"{home_api} / {away_api}")
                continue

            home_team = db.query(models.Team).filter_by(name=home_heb).first()
            away_team = db.query(models.Team).filter_by(name=away_heb).first()
            if not home_team or not away_team:
                continue

            # Try to find our DB match by team IDs first (group stage + already-assigned knockout)
            match = db.query(models.Match).filter_by(
                home_team_id=home_team.id,
                away_team_id=away_team.id,
            ).first()

            # For knockout: match by scheduled_at and auto-assign teams
            if not match:
                fixture_dt = _parse_fixture_dt(fixture)
                match = _find_knockout_match_by_time(db, fixture_dt)
                if match:
                    match.home_team_id = home_team.id
                    match.away_team_id = away_team.id
                    teams_assigned += 1
                    logger.info(f"Auto-assigned {home_heb} vs {away_heb} to match #{match.match_number}")

            if not match:
                continue

            # Update score if finished
            if status in ("FT", "AET", "PEN"):
                home_score = fixture["goals"]["home"]
                away_score = fixture["goals"]["away"]
                if home_score is not None and away_score is not None:
                    if _apply_result(db, match, home_score, away_score):
                        scores_updated += 1

        db.commit()
    finally:
        db.close()

    last_sync_at = datetime.now(timezone.utc)
    last_sync_updated = scores_updated + teams_assigned
    last_sync_error = None

    if unknown_teams:
        logger.warning(f"Unknown team names from API: {set(unknown_teams)}")

    return {
        "scores_updated": scores_updated,
        "teams_assigned": teams_assigned,
        "total_fixtures": len(fixtures),
    }


def _next_match_window() -> tuple[bool, float]:
    """Returns (is_active_window, seconds_to_sleep).
    Active window: -30min to +120min around any unfinished match.
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        upcoming = (
            db.query(models.Match)
            .filter(models.Match.status != "finished")
            .filter(models.Match.home_team_id.isnot(None))
            .all()
        )
        for m in upcoming:
            delta = (m.scheduled_at - now).total_seconds()
            if -1800 <= delta <= 7200:  # -30min to +2h
                return True, 600  # poll every 10 min
            if 0 < delta <= 3600:  # next match within 1h
                return False, min(delta - 1800, 600)
        return False, 1800  # no active/upcoming match → 30min sleep
    finally:
        db.close()


async def polling_loop():
    """Background task: polls API-Football at the right cadence."""
    await asyncio.sleep(30)  # wait for startup to complete
    while True:
        try:
            is_active, sleep_secs = _next_match_window()
            if is_active:
                await sync_results()
            await asyncio.sleep(sleep_secs)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Polling loop error: {e}")
            await asyncio.sleep(300)
