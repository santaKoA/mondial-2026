from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


def _build_leaderboard(users: list[models.User]) -> list[schemas.UserOut]:
    result = []
    for user in users:
        match_pts = sum(p.points or 0 for p in user.predictions)
        special_pts = sum(s.points for s in user.special_predictions)
        winner_pick = next((s.value for s in user.special_predictions if s.prediction_type == "winner"), None)
        top_scorer_pick = next((s.value for s in user.special_predictions if s.prediction_type == "top_scorer"), None)
        result.append(
            schemas.UserOut(
                id=user.id,
                name=user.name,
                is_admin=user.is_admin,
                total_points=match_pts + special_pts,
                prediction_count=len(user.predictions),
                winner_pick=winner_pick,
                top_scorer_pick=top_scorer_pick,
            )
        )
    result.sort(key=lambda u: (-u.total_points, u.name))
    return result


@router.get("", response_model=list[schemas.UserOut])
def leaderboard(
    group_id: Optional[int] = None,
    _: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    if group_id:
        user_ids = [
            ug.user_id for ug in db.query(models.UserGroup).filter(
                models.UserGroup.group_id == group_id
            ).all()
        ]
        users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
    else:
        users = db.query(models.User).all()

    return _build_leaderboard(users)


@router.get("/groups", response_model=list[schemas.GroupOut])
def my_groups(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    user_groups = db.query(models.UserGroup).filter(
        models.UserGroup.user_id == current_user.id
    ).all()
    result = []
    for ug in user_groups:
        group = db.query(models.Group).filter(models.Group.id == ug.group_id).first()
        if group:
            count = db.query(models.UserGroup).filter(models.UserGroup.group_id == group.id).count()
            result.append(schemas.GroupOut(id=group.id, name=group.name, code=group.code, member_count=count, owner_id=group.owner_id))
    return result


@router.delete("/groups/{group_id}/members/{user_id}")
def remove_member(
    group_id: int,
    user_id: int,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="קבוצה לא נמצאה")
    if group.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="רק ראש הקבוצה יכול להסיר חברים")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="לא ניתן להסיר את עצמך מהקבוצה")
    membership = db.query(models.UserGroup).filter(
        models.UserGroup.group_id == group_id,
        models.UserGroup.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="המשתמש אינו בקבוצה")
    db.delete(membership)
    db.commit()
    return {"ok": True}
