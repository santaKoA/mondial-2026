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
    "Bosnia-Herzegovina": "בוסניה והרצגובינה",
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
    "Cape Verde Islands": "כף ורדה",
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


def _final_scores(score: dict) -> tuple:
    """
    Final result by 90 minutes only (house rule: predictions are for regular time).
    If the match went to extra time, the API puts the 90-min score in regularTime;
    otherwise fullTime *is* the 90-min score.
    """
    rt = score.get("regularTime") or {}
    ft = score.get("fullTime") or {}
    if rt.get("home") is not None and rt.get("away") is not None:
        return rt["home"], rt["away"]
    return ft.get("home"), ft.get("away")


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

                # Name match must also agree on kickoff time (±2h) — otherwise a
                # knockout rematch of two group-stage opponents would overwrite
                # their old group match
                match_dt = _parse_match_dt(m)
                window = timedelta(hours=2)
                match = db.query(models.Match).filter(
                    models.Match.home_team_id == home_team.id,
                    models.Match.away_team_id == away_team.id,
                    models.Match.is_test == False,
                    models.Match.scheduled_at >= match_dt - window,
                    models.Match.scheduled_at <= match_dt + window,
                ).first()

                # Knockout: match by time and auto-assign
                if not match:
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

            # Finals only — live display is ESPN's job (football-data's free
            # tier lags, and stale half-time data must not overwrite ESPN)
            if status == "FINISHED":
                home_score, away_score = _final_scores(m["score"])
                if home_score is not None and away_score is not None:
                    if _apply_result(db, match, home_score, away_score, finished=True):
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
    if status == "FINISHED":
        # Final result by 90 minutes only (excludes extra time / penalties)
        home_score, away_score = _final_scores(m["score"])
    else:
        ft = m["score"].get("fullTime", {})
        ht = m["score"].get("halfTime", {})
        home_ft, away_ft = ft.get("home"), ft.get("away")
        home_ht, away_ht = ht.get("home"), ht.get("away")
        home_score = home_ft if home_ft is not None else home_ht
        away_score = away_ft if away_ft is not None else away_ht

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


def _mark_kicked_off_matches():
    """
    Set status='live' and score=0-0 for any match whose kickoff has passed
    but is still 'upcoming'. No API call — pure time-based.
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        just_kicked = db.query(models.Match).filter(
            models.Match.status == "upcoming",
            models.Match.home_team_id.isnot(None),
            models.Match.scheduled_at <= now,
        ).all()
        if just_kicked:
            for m in just_kicked:
                m.status = "live"
                m.home_score = 0
                m.away_score = 0
            db.commit()
            logger.info(f"Marked {len(just_kicked)} match(es) as live 0-0")
    finally:
        db.close()


def _next_event_secs() -> float:
    """
    Seconds until the next event requiring a wakeup:
    - Kickoff of any upcoming match (to mark it live)
    - +45min or +120min sync point for any active match
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        active = db.query(models.Match).filter(
            models.Match.status != "finished",
            models.Match.home_team_id.isnot(None),
        ).all()

        points = []
        for m in active:
            # Kickoff wakeup
            if m.status == "upcoming" and m.scheduled_at > now:
                points.append(m.scheduled_at)
            # API sync points
            for offset_min in (45, 120):
                pt = m.scheduled_at + timedelta(minutes=offset_min)
                if pt > now:
                    points.append(pt)

        if not points:
            return 3600
        return max((min(points) - now).total_seconds(), 0)
    finally:
        db.close()


# ── ESPN live scores ──────────────────────────────────────────────────────────
# Unofficial but stable public endpoint with real-time scores (football-data's
# free tier only updates around half-time/full-time). Used for LIVE DISPLAY
# ONLY — final results and points always come from football-data (regularTime).

ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"


async def sync_live_espn() -> int:
    """
    ESPN sync for matches that are live in our DB:
    - state 'in'  → update the displayed score (all stages)
    - state 'post' → finalize GROUP-STAGE matches only (no extra time in
      groups, so ESPN's final score == the 90-minute score). Knockout finals
      stay with football-data, which separates regularTime from extra time.
    """
    db = SessionLocal()
    try:
        live_matches = db.query(models.Match).filter(
            models.Match.status == "live",
            models.Match.home_team_id.isnot(None),
            models.Match.is_test == False,
        ).all()
        if not live_matches:
            return 0
        team_names = {t.id: t.name for t in db.query(models.Team).all()}
        index = {
            (team_names.get(m.home_team_id), team_names.get(m.away_team_id)): m
            for m in live_matches
        }

        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        espn_url = f"{ESPN_SCOREBOARD_URL}?dates={today}"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(espn_url)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning(f"ESPN live sync error: {e}")
            return 0

        updated = 0
        for e in data.get("events", []):
            comp = e.get("competitions", [{}])[0]
            state = comp.get("status", {}).get("type", {}).get("state")
            if state not in ("in", "post"):
                continue
            home_heb = away_heb = None
            home_score = away_score = None
            for c in comp.get("competitors", []):
                heb = _to_hebrew(c.get("team", {}).get("displayName", ""))
                try:
                    sc = int(c.get("score"))
                except (TypeError, ValueError):
                    sc = None
                if c.get("homeAway") == "home":
                    home_heb, home_score = heb, sc
                else:
                    away_heb, away_score = heb, sc
            if home_score is None or away_score is None:
                continue
            match = index.get((home_heb, away_heb))
            if not match:
                continue
            if state == "post" and match.stage == "group":
                # Group stage: ESPN final == 90-min score → finish + points
                if _apply_result(db, match, home_score, away_score, finished=True):
                    updated += 1
                    logger.info(f"ESPN finalized group match {match.id}: {home_score}-{away_score}")
            elif state == "in":
                if match.home_score != home_score or match.away_score != away_score:
                    match.home_score = home_score
                    match.away_score = away_score
                    updated += 1
            # state == 'post' on a knockout match: leave for football-data
        if updated:
            db.commit()
            logger.info(f"ESPN live: updated {updated} match(es)")
        return updated
    finally:
        db.close()


def _any_live_match() -> bool:
    db = SessionLocal()
    try:
        return db.query(models.Match).filter(
            models.Match.status == "live",
            models.Match.home_team_id.isnot(None),
            models.Match.is_test == False,
        ).count() > 0
    finally:
        db.close()


def _live_overdue() -> bool:
    """
    True if any match is still 'live' past its +120min sync point — e.g. extra
    time, penalties, or a long stoppage. We keep re-syncing every ~10 minutes
    until the API reports FINISHED, up to 5 hours after kickoff.
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        live = db.query(models.Match).filter(
            models.Match.status == "live",
            models.Match.home_team_id.isnot(None),
        ).all()
        for m in live:
            if m.scheduled_at + timedelta(minutes=120) <= now <= m.scheduled_at + timedelta(hours=5):
                return True
        return False
    finally:
        db.close()


def _has_api_sync_due() -> bool:
    """True if any match is within the 5-min window after its +45min or +120min point."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        active = db.query(models.Match).filter(
            models.Match.status != "finished",
            models.Match.home_team_id.isnot(None),
        ).all()
        for m in active:
            for offset_min in (45, 120):
                pt = m.scheduled_at + timedelta(minutes=offset_min)
                diff = (now - pt).total_seconds()
                if 0 <= diff <= 1800:  # 30-minute window — survives server restarts
                    return True
        return False
    finally:
        db.close()


async def polling_loop():
    """
    Background task:
    1. At kickoff → mark match live with 0-0 (no API call)
    2. While live → ESPN live-score update every 3 minutes (display only)
    3. At kickoff+45min → football-data sync (halftime score)
    4. At kickoff+120min → football-data sync (final result + points),
       retried every 10 min while still live (extra time), up to 5h
    """
    import time as _time
    await asyncio.sleep(30)
    fd_cooldown_until = 0.0
    while True:
        try:
            # Mark matches that just kicked off as live 0-0
            _mark_kicked_off_matches()

            # football-data sync at +45/+120 points, or while a match ran past
            # +120 and is still live (extra time / long stoppage)
            if _time.monotonic() >= fd_cooldown_until and (_has_api_sync_due() or _live_overdue()):
                logger.info("API sync point reached")
                await sync_results()
                await sync_test_matches()
                # cooldown: 10 min while a match is overdue, else past the 30-min window
                fd_cooldown_until = _time.monotonic() + (600 if _live_overdue() else 1860)

            # While any match is live — tick ESPN every 3 minutes
            if _any_live_match():
                await sync_live_espn()
                await asyncio.sleep(180)
                continue

            # Sleep until next event (kickoff or sync point)
            secs = _next_event_secs()
            await asyncio.sleep(max(min(secs - 30, 3600), 60))

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Polling loop error: {e}")
            await asyncio.sleep(300)
