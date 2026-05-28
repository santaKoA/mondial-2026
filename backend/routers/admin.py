from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from database import get_db
import secrets
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
    users = db.query(models.User).all()
    result = []
    for user in users:
        match_pts = sum(p.points or 0 for p in user.predictions)
        special_pts = sum(s.points or 0 for s in user.special_predictions)
        result.append(
            schemas.UserOut(
                id=user.id,
                name=user.name,
                is_admin=user.is_admin,
                total_points=match_pts + special_pts,
                prediction_count=len(user.predictions),
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
    groups = db.query(models.Group).all()
    result = []
    for g in groups:
        count = db.query(models.UserGroup).filter(models.UserGroup.group_id == g.id).count()
        result.append(schemas.GroupOut(id=g.id, name=g.name, code=g.code, member_count=count))
    return result


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
        "api_configured": bool(results_sync.settings.FOOTBALL_API_KEY),
    }


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
    db.query(models.UserGroup).filter(models.UserGroup.group_id == group_id).delete()
    db.delete(group)
    db.commit()
    return {"ok": True}
