from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, contains_eager
from database import get_db
import secrets
import asyncio
import httpx
from datetime import datetime, timezone
import models
import schemas
import auth as auth_utils
import scoring
from services import results_sync

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.put("/matches/{match_id}/result")
def set_match_result(
    match_id: int,
    body: schemas.MatchResultIn,
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    match.home_score = body.home_score
    match.away_score = body.away_score
    match.status = "finished"

    predictions = db.query(models.Prediction).filter(models.Prediction.match_id == match_id).all()
    for pred in predictions:
        pred.points = scoring.calculate_points(
            match.stage,
            body.home_score, body.away_score,
            pred.home_score, pred.away_score,
        )

    db.commit()
    return {"ok": True, "updated_predictions": len(predictions)}


@router.put("/matches/{match_id}/teams")
def set_match_teams(
    match_id: int,
    home_team_id: int,
    away_team_id: int,
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    match.home_team_id = home_team_id
    match.away_team_id = away_team_id
    db.commit()
    return {"ok": True}


@router.post("/special-predictions/correct")
def set_special_correct(
    body: schemas.SpecialResultIn,
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    predictions = db.query(models.SpecialPrediction).filter(
        models.SpecialPrediction.prediction_type == body.prediction_type
    ).all()

    updated = 0
    for sp in predictions:
        if sp.value.strip().lower() == body.correct_value.strip().lower():
            sp.points = body.points_awarded
            updated += 1
        else:
            sp.points = 0

    db.commit()
    return {"ok": True, "correct_count": updated}


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    users = db.query(models.User).options(
        joinedload(models.User.predictions),
        joinedload(models.User.special_predictions),
        joinedload(models.User.groups).joinedload(models.UserGroup.group),
    ).all()
    result = []
    for user in users:
        match_pts = sum(p.points or 0 for p in user.predictions)
        special_pts = sum(s.points or 0 for s in user.special_predictions)
        group_names = [ug.group.name for ug in user.groups if ug.group]
        result.append(
            schemas.UserOut(
                id=user.id,
                name=user.name,
                is_admin=user.is_admin,
                total_points=match_pts + special_pts,
                prediction_count=len(user.predictions),
                created_at=user.created_at,
                group_names=group_names,
            )
        )
    return result


@router.get("/teams", response_model=list[schemas.TeamOut])
def list_teams(
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Team).order_by(models.Team.group_name, models.Team.name).all()


@router.get("/groups", response_model=list[schemas.GroupOut])
def list_groups(
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    groups = db.query(models.Group).options(
        joinedload(models.Group.members).joinedload(models.UserGroup.user)
    ).all()
    return [
        schemas.GroupOut(
            id=g.id,
            name=g.name,
            code=g.code,
            member_count=len(g.members),
            owner_id=g.owner_id,
            member_names=[ug.user.name for ug in g.members if ug.user],
        )
        for g in groups
    ]


@router.post("/groups", response_model=schemas.GroupOut)
def create_group(
    body: schemas.GroupCreateIn,
    current_admin: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    code = secrets.token_urlsafe(6)
    group = models.Group(name=body.name.strip(), code=code, owner_id=current_admin.id)
    db.add(group)
    db.commit()
    db.refresh(group)
    return schemas.GroupOut(id=group.id, name=group.name, code=group.code, member_count=0, owner_id=group.owner_id)


@router.post("/sync")
async def manual_sync(_: models.User = Depends(auth_utils.get_admin_user)):
    result = await results_sync.sync_results()
    return result


@router.get("/sync/status")
def sync_status(_: models.User = Depends(auth_utils.get_admin_user)):
    return {
        "last_sync_at": results_sync.last_sync_at.isoformat() if results_sync.last_sync_at else None,
        "last_updated": results_sync.last_sync_updated,
        "error": results_sync.last_sync_error,
        "api_configured": bool(settings.FOOTBALL_DATA_TOKEN),
    }


@router.post("/link-fixtures")
async def link_fixtures(
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    """Fetch all WC fixtures from football-data.org and store their IDs in our DB matches."""
    from config import settings as cfg
    if not cfg.FOOTBALL_DATA_TOKEN:
        raise HTTPException(status_code=400, detail="FOOTBALL_DATA_TOKEN לא מוגדר")

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{results_sync.API_URL}/competitions/WC/matches",
                params={"season": 2026},
                headers={"X-Auth-Token": cfg.FOOTBALL_DATA_TOKEN},
            )
        resp.raise_for_status()
        api_matches = resp.json().get("matches", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    linked = 0
    not_found = []

    for m in api_matches:
        home_api = m["homeTeam"]["name"]
        away_api = m["awayTeam"]["name"]
        fixture_id = m["id"]

        home_heb = results_sync.TEAM_NAME_MAP.get(home_api)
        away_heb = results_sync.TEAM_NAME_MAP.get(away_api)
        if not home_heb or not away_heb:
            not_found.append(f"{home_api} / {away_api}")
            continue

        home_team = db.query(models.Team).filter_by(name=home_heb).first()
        away_team = db.query(models.Team).filter_by(name=away_heb).first()
        if not home_team or not away_team:
            not_found.append(f"{home_api} / {away_api} (no team in DB)")
            continue

        match = db.query(models.Match).filter_by(
            home_team_id=home_team.id,
            away_team_id=away_team.id,
            is_test=False,
        ).first()
        if match:
            match.api_fixture_id = fixture_id
            match.api_league_id = 2
            match.api_season = 2026
            linked += 1

    db.commit()
    return {
        "linked": linked,
        "total_api": len(api_matches),
        "not_found": not_found,
    }


@router.put("/users/{user_id}/password")
def reset_user_password(
    user_id: int,
    body: schemas.ResetPasswordIn,
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="הסיסמה חייבת להכיל לפחות 4 תווים")
    from auth import hash_password
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_admin: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=403, detail="לא ניתן למחוק אדמין")
    if user.id == current_admin.id:
        raise HTTPException(status_code=403, detail="לא ניתן למחוק את עצמך")
    db.query(models.Prediction).filter(models.Prediction.user_id == user_id).delete()
    db.query(models.SpecialPrediction).filter(models.SpecialPrediction.user_id == user_id).delete()
    db.query(models.UserGroup).filter(models.UserGroup.user_id == user_id).delete()
    db.query(models.Group).filter(models.Group.owner_id == user_id).update({"owner_id": None})
    db.delete(user)
    db.commit()
    return {"ok": True}


@router.delete("/groups/{group_id}")
def delete_group(
    group_id: int,
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    # Null out primary group reference so users don't have a dangling FK
    db.query(models.User).filter(models.User.group_id == group_id).update({"group_id": None})
    db.query(models.UserGroup).filter(models.UserGroup.group_id == group_id).delete()
    db.delete(group)
    db.commit()
    return {"ok": True}


# ── Test Matches ──────────────────────────────────────────────────────────────

async def _find_fixture_id(api_league_id: int, api_season: int, scheduled_at: datetime) -> int | None:
    """Search football-data.org for a fixture by competition+season+date, closest to scheduled_at."""
    from config import settings
    if not settings.FOOTBALL_DATA_TOKEN:
        return None
    # Map legacy league_id to competition code
    competition = "CL" if api_league_id == 2 else "WC"
    date_str = scheduled_at.strftime("%Y-%m-%d")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{results_sync.API_URL}/competitions/{competition}/matches",
                params={"season": api_season, "dateFrom": date_str, "dateTo": date_str},
                headers={"X-Auth-Token": settings.FOOTBALL_DATA_TOKEN},
            )
        resp.raise_for_status()
        matches = resp.json().get("matches", [])
        if not matches:
            return None
        target = scheduled_at.replace(tzinfo=None)
        def diff(m):
            raw = m["utcDate"].replace("Z", "+00:00")
            dt = datetime.fromisoformat(raw).astimezone(timezone.utc).replace(tzinfo=None)
            return abs((dt - target).total_seconds())
        best = min(matches, key=diff)
        return best["id"]
    except Exception:
        return None


@router.get("/search-fixtures")
async def search_fixtures(
    competition: str = "CL",   # e.g. CL, WC
    season: int = 2025,
    date: str = "",            # YYYY-MM-DD
    team: str = "",            # optional name filter
    _: models.User = Depends(auth_utils.get_admin_user),
):
    """Search football-data.org fixtures by competition+season, filter by date/team."""
    from config import settings
    if not settings.FOOTBALL_DATA_TOKEN:
        raise HTTPException(status_code=400, detail="FOOTBALL_DATA_TOKEN לא מוגדר")
    try:
        # Fetch ALL matches for the season, filter by date locally (more reliable)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{results_sync.API_URL}/competitions/{competition}/matches",
                params={"season": season},
                headers={"X-Auth-Token": settings.FOOTBALL_DATA_TOKEN},
            )
        resp.raise_for_status()
        matches = resp.json().get("matches", [])

        results = []
        for m in matches:
            home = m["homeTeam"]["name"]
            away = m["awayTeam"]["name"]
            match_date = m["utcDate"][:10]  # YYYY-MM-DD
            if date and match_date != date:
                continue
            if team and team.lower() not in home.lower() and team.lower() not in away.lower():
                continue
            results.append({
                "fixture_id": m["id"],
                "home": home,
                "away": away,
                "date": m["utcDate"],
                "status": m["status"],
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-match", response_model=schemas.TestMatchOut)
async def create_test_match(
    body: schemas.TestMatchCreate,
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    # Generate a unique match_number well above normal range
    max_num = db.query(models.Match).order_by(models.Match.match_number.desc()).first()
    next_num = max((max_num.match_number if max_num else 0) + 1, 10000)

    # scheduled_at as naive UTC
    sat = body.scheduled_at
    if sat.tzinfo:
        sat = sat.astimezone(timezone.utc).replace(tzinfo=None)

    fixture_id = body.api_fixture_id
    if not fixture_id:
        fixture_id = await _find_fixture_id(body.api_league_id, body.api_season, sat)

    match = models.Match(
        match_number=next_num,
        stage=body.stage,
        scheduled_at=sat,
        status="upcoming",
        is_test=True,
        api_league_id=body.api_league_id,
        api_season=body.api_season,
        api_fixture_id=fixture_id,
        test_home_name=body.home_name,
        test_home_flag=body.home_flag,
        test_away_name=body.away_name,
        test_away_flag=body.away_flag,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


@router.get("/test-matches", response_model=list[schemas.TestMatchOut])
def list_test_matches(
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Match).filter(models.Match.is_test == True)\
        .order_by(models.Match.scheduled_at).all()


@router.get("/test-matches/cards", response_model=list[schemas.MatchOut])
def list_test_match_cards(
    current_admin: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    """Return test matches in MatchOut format (with fake TeamOut) so MatchCard can render them."""
    matches = db.query(models.Match).filter(models.Match.is_test == True)\
        .order_by(models.Match.scheduled_at).all()

    match_ids = [m.id for m in matches]
    pred_map = {}
    if match_ids:
        preds = db.query(models.Prediction).filter(
            models.Prediction.user_id == current_admin.id,
            models.Prediction.match_id.in_(match_ids),
        ).all()
        pred_map = {p.match_id: p for p in preds}

    result = []
    for m in matches:
        p = pred_map.get(m.id)
        result.append(schemas.MatchOut(
            id=m.id,
            match_number=m.match_number,
            stage=m.stage,
            group_name=m.group_name,
            scheduled_at=m.scheduled_at,
            home_team=schemas.TeamOut(id=0, name=m.test_home_name or '?', flag=m.test_home_flag or '🏳', group_name=None) if m.test_home_name else None,
            away_team=schemas.TeamOut(id=0, name=m.test_away_name or '?', flag=m.test_away_flag or '🏳', group_name=None) if m.test_away_name else None,
            home_score=m.home_score,
            away_score=m.away_score,
            status=m.status,
            my_prediction=schemas.PredictionOut(
                id=p.id, match_id=p.match_id,
                home_score=p.home_score, away_score=p.away_score,
                points=p.points, submitted_at=p.submitted_at, updated_at=p.updated_at,
            ) if p else None,
        ))
    return result


@router.delete("/test-matches/{match_id}")
def delete_test_match(
    match_id: int,
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    match = db.query(models.Match).filter(
        models.Match.id == match_id,
        models.Match.is_test == True,
    ).first()
    if not match:
        raise HTTPException(status_code=404, detail="Test match not found")
    db.query(models.Prediction).filter(models.Prediction.match_id == match_id).delete()
    db.delete(match)
    db.commit()
    return {"ok": True}


@router.post("/test-matches/{match_id}/sync")
async def sync_one_test_match(
    match_id: int,
    _: models.User = Depends(auth_utils.get_admin_user),
    db: Session = Depends(get_db),
):
    match = db.query(models.Match).filter(
        models.Match.id == match_id,
        models.Match.is_test == True,
    ).first()
    if not match:
        raise HTTPException(status_code=404, detail="Test match not found")
    if not match.api_fixture_id:
        raise HTTPException(status_code=400, detail="אין fixture_id — הכנס ידנית")
    result = await results_sync.sync_single_fixture(match.api_fixture_id, match.id)
    return result
