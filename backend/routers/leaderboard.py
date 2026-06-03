from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
from database import get_db
import models
import schemas
import auth as auth_utils
from utils import tournament_started

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


def _build_leaderboard(users: list[models.User], current_user_id: int, reveal_others: bool = True) -> list[schemas.UserOut]:
    result = []
    for user in users:
        real_preds = [p for p in user.predictions if not p.match.is_test]
        match_pts = sum(p.points or 0 for p in real_preds)
        special_pts = sum(s.points or 0 for s in user.special_predictions)
        winner_pick = next((s.value for s in user.special_predictions if s.prediction_type == "winner"), None)
        top_scorer_pick = next((s.value for s in user.special_predictions if s.prediction_type == "top_scorer"), None)
        exact_count = 0
        direction_count = 0
        for p in real_preds:
            m = p.match
            if m.status != "finished" or m.home_score is None or m.away_score is None:
                continue
            if p.home_score == m.home_score and p.away_score == m.away_score:
                exact_count += 1
            elif (p.home_score - p.away_score) * (m.home_score - m.away_score) > 0 or \
                 (p.home_score == p.away_score and m.home_score == m.away_score):
                direction_count += 1
        show_special = reveal_others or user.id == current_user_id
        result.append(
            schemas.UserOut(
                id=user.id,
                name=user.name,
                is_admin=user.is_admin,
                total_points=match_pts + special_pts,
                prediction_count=len(real_preds),
                exact_count=exact_count,
                direction_count=direction_count,
                winner_pick=winner_pick if show_special else None,
                top_scorer_pick=top_scorer_pick if show_special else None,
            )
        )
    result.sort(key=lambda u: (-u.total_points, u.name))
    return result


@router.get("", response_model=list[schemas.UserOut])
def leaderboard(
    group_id: Optional[int] = None,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    eager = [
        joinedload(models.User.predictions).joinedload(models.Prediction.match),
        joinedload(models.User.special_predictions),
    ]
    if group_id:
        user_ids = [
            ug.user_id for ug in db.query(models.UserGroup).filter(
                models.UserGroup.group_id == group_id
            ).all()
        ]
        users = db.query(models.User).options(*eager).filter(models.User.id.in_(user_ids)).all()
    else:
        users = db.query(models.User).options(*eager).all()

    return _build_leaderboard(users, current_user_id=current_user.id, reveal_others=tournament_started())


@router.get("/groups", response_model=list[schemas.GroupOut])
def my_groups(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    group_ids = [
        ug.group_id for ug in
        db.query(models.UserGroup).filter(models.UserGroup.user_id == current_user.id).all()
    ]
    if not group_ids:
        return []

    # Single query: groups + member counts
    rows = (
        db.query(models.Group, func.count(models.UserGroup.user_id).label("cnt"))
        .join(models.UserGroup, models.Group.id == models.UserGroup.group_id)
        .filter(models.Group.id.in_(group_ids))
        .group_by(models.Group.id)
        .all()
    )
    return [
        schemas.GroupOut(id=g.id, name=g.name, code=g.code, member_count=cnt, owner_id=g.owner_id)
        for g, cnt in rows
    ]


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
