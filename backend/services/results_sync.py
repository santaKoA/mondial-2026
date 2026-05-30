"""
Fetches match results from football-data.org and updates the DB.
API: https://api.football-data.org/v4
Free tier: WC + CL included, 10 req/min.
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

API_URL = "https://api.football-data.org/v4"
WC_CODE = "WC"
WC_SEASON = 2026

# Map football-data.org English team names → Hebrew names in our DB
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
    return {"X-Auth-Token": settings.FOOTBALL_DATA_TOKEN}


def _to_hebrew(name: str) -> str | None:
    return TEAM_NAME_MAP.get(name)


def _apply_result(db, match: models.Match, home_score: int, away_score: int, finished: bool = True) -> bool:
    """Update match score. If finished=True, also calculates points. Returns True if changed."""
    new_status = "finished" if finished else "live"

    if (match.home_score == home_score and match.away_score == away_score
            and match.status == new_status):
        return False

    match.home_score = home_score
    match.away_score = away_score
    match.status = new_status

    if finished:
        predictions = db.query(models.Prediction).filter(models.Prediction.match_id == match.id).all()
        for pred in predictions:
            pred.points = scoring.calculate_points(
                match.stage, home_score, away_score, pred.home_score, pred.away_score
            )
    return True


def _parse_match_dt(m: dict) -> datetime:
    raw = m["utcDate"]
    dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _find_knockout_match_by_time(db, match_dt: datetime) -> models.Match | None:
    """Find unassigned knockout match closest to match_dt (within ±2h)."""
    window = timedelta(hours=2)
    candidates = (
        db.query(models.Match)
        .filter(
            models.Match.stage != "group",
            models.Match.home_team_id.is_(None),
            models.Match.is_test == False,
            models.Match.scheduled_at >= match_dt - window,
            models.Match.scheduled_at <= match_dt + window,
        )
        .all()
    )
    if not candidates:
        return None
    return min(candidates, key=lambda m: abs((m.scheduled_at - match_dt).total_seconds()))


async def sync_results() -> dict:
    """Fetch all WC fixtures from football-data.org, assign knockout teams + update scores."""
    global last_sync_at, last_sync_updated, last_sync_error

    if not settings.FOOTBALL_DATA_TOKEN:
        last_sync_error = "FOOTBALL_DATA_TOKEN לא מוגדר"
        return {"error": last_sync_error}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{API_URL}/competitions/{WC_CODE}/matches",
                params={"season": WC_SEASON},
                headers=_headers(),
            )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        last_sync_error = str(e)
        logger.error(f"football-data.org fetch error: {e}")
        return {"error": str(e)}

    matches_api = data.get("matches", [])
    scores_updated = 0
    teams_assigned = 0
    unknown_teams: list[str] = []

    LIVE_STATUSES = {"IN_PLAY", "PAUSED", "HALFTIME", "EXTRA_TIME", "PENALTY"}

    db = SessionLocal()
    try:
        # Build fixture_id → DB match map for fast lookup
        fixture_id_map: dict[int, models.Match] = {}
        linked = db.query(models.Match).filter(
            models.Match.api_fixture_id.isnot(None),
            models.Match.is_test == False,
        ).all()
        for lm in linked:
            fixture_id_map[lm.api_fixture_id] = lm

        for m in matches_api:
            status = m["status"]
            fixture_id = m["id"]
            home_api = m["homeTeam"]["name"]
            away_api = m["awayTeam"]["name"]

            # Try fixture_id match first (most reliable)
            match = fixture_id_map.get(fixture_id)

            # Fall back to team name matching
            if not match:
                home_heb = _to_hebrew(home_api)
                away_heb = _to_hebrew(away_api)
                if not home_heb or not away_heb:
                    unknown_teams.append(f"{home_api} / {away_api}")
                    continue

                home_team = db.query(models.Team).filter_by(name=home_heb).first()
                away_team = db.query(models.Team).filter_by(name=away_heb).first()
                if not home_team or not away_team:
                    continue

                match = db.query(models.Match).filter_by(
                    home_team_id=home_team.id,
                    away_team_id=away_team.id,
                    is_test=False,
                ).first()

                # Knockout: match by time and auto-assign
                if not match:
                    match_dt = _parse_match_dt(m)
                    match = _find_knockout_match_by_time(db, match_dt)
                    if match:
                        match.home_team_id = home_team.id
                        match.away_team_id = away_team.id
                        # Store fixture_id for future syncs
                        match.api_fixture_id = fixture_id
                        teams_assigned += 1
                        logger.info(f"Auto-assigned {home_heb} vs {away_heb}")

            if not match:
                continue

            # Update score — finished or live
            if status == "FINISHED":
                home_score = m["score"]["fullTime"]["home"]
                away_score = m["score"]["fullTime"]["away"]
                if home_score is not None and away_score is not None:
                    if _apply_result(db, match, home_score, away_score, finished=True):
                        scores_updated += 1
            elif status in LIVE_STATUSES:
                # Live score (halftime or current score)
                ht = m["score"].get("halfTime", {})
                ft = m["score"].get("fullTime", {})
                home_score = ft.get("home") or ht.get("home")
                away_score = ft.get("away") or ht.get("away")
                if home_score is not None and away_score is not None:
                    if _apply_result(db, match, home_score, away_score, finished=False):
                        scores_updated += 1

        db.commit()
    finally:
        db.close()

    last_sync_at = datetime.now(timezone.utc)
    last_sync_updated = scores_updated + teams_assigned
    last_sync_error = None

    if unknown_teams:
        logger.warning(f"Unknown team names: {set(unknown_teams)}")

    return {
        "scores_updated": scores_updated,
        "teams_assigned": teams_assigned,
        "total_fixtures": len(matches_api),
    }


async def sync_single_fixture(fixture_id: int, match_id: int) -> dict:
    """Fetch a single match by ID from football-data.org and update the test match."""
    global last_sync_at, last_sync_updated, last_sync_error

    if not settings.FOOTBALL_DATA_TOKEN:
        return {"error": "FOOTBALL_DATA_TOKEN לא מוגדר"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{API_URL}/matches/{fixture_id}",
                headers=_headers(),
            )
        resp.raise_for_status()
        m = resp.json()
    except Exception as e:
        last_sync_error = str(e)
        logger.error(f"sync_single_fixture error: {e}")
        return {"error": str(e)}

    status = m["status"]
    home_api = m["homeTeam"]["name"]
    away_api = m["awayTeam"]["name"]
    ft = m["score"].get("fullTime", {})
    ht = m["score"].get("halfTime", {})
    home_score = ft.get("home") or ht.get("home")
    away_score = ft.get("away") or ht.get("away")

    LIVE_STATUSES = {"IN_PLAY", "PAUSED", "HALFTIME", "EXTRA_TIME", "PENALTY"}

    db = SessionLocal()
    try:
        match = db.query(models.Match).filter(models.Match.id == match_id).first()
        if not match:
            return {"error": "Match not found in DB"}

        updated = False
        if status == "FINISHED" and home_score is not None and away_score is not None:
            updated = _apply_result(db, match, home_score, away_score, finished=True)
        elif status in LIVE_STATUSES and home_score is not None and away_score is not None:
            updated = _apply_result(db, match, home_score, away_score, finished=False)
        db.commit()
    finally:
        db.close()

    last_sync_at = datetime.now(timezone.utc)
    if updated:
        last_sync_updated += 1

    return {
        "fixture_id": fixture_id,
        "status": status,
        "home": home_api,
        "away": away_api,
        "score": f"{home_score}-{away_score}",
        "updated": updated,
    }


async def sync_test_matches() -> int:
    """Sync all unfinished test matches that have an api_fixture_id."""
    db = SessionLocal()
    try:
        test_matches = db.query(models.Match).filter(
            models.Match.is_test == True,
            models.Match.status != "finished",
            models.Match.api_fixture_id.isnot(None),
        ).all()
        pairs = [(m.api_fixture_id, m.id) for m in test_matches]
    finally:
        db.close()

    updated = 0
    for fixture_id, match_id in pairs:
        result = await sync_single_fixture(fixture_id, match_id)
        if result.get("updated"):
            updated += 1
    return updated


def _next_match_window() -> tuple[bool, float]:
    """Returns (is_active_window, seconds_to_sleep)."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        upcoming = (
            db.query(models.Match)
            .filter(models.Match.status != "finished")
            .filter(models.Match.home_team_id.isnot(None))
            .filter(models.Match.is_test == False)
            .all()
        )
        for m in upcoming:
            delta = (m.scheduled_at - now).total_seconds()
            if -1800 <= delta <= 7200:
                return True, 600
        return False, 1800
    finally:
        db.close()


def _has_active_test_match() -> bool:
    """Check if any test match is within its active window."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        upcoming = db.query(models.Match).filter(
            models.Match.is_test == True,
            models.Match.status != "finished",
            models.Match.api_fixture_id.isnot(None),
        ).all()
        for m in upcoming:
            delta = (m.scheduled_at - now).total_seconds()
            if -1800 <= delta <= 7200:
                return True
        return False
    finally:
        db.close()


async def polling_loop():
    """Background task: polls football-data.org at the right cadence."""
    await asyncio.sleep(30)
    while True:
        try:
            is_active, sleep_secs = _next_match_window()
            has_test = _has_active_test_match()
            if is_active:
                await sync_results()
            if has_test:
                await sync_test_matches()
            await asyncio.sleep(sleep_secs)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Polling loop error: {e}")
            await asyncio.sleep(300)
