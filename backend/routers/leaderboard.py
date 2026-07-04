from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
from database import get_db
import models
import schemas
import auth as auth_utils
import scoring
from utils import tournament_started

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


def _build_leaderboard(users: list[models.User], current_user_id: int, reveal_others: bool = True) -> list[schemas.UserOut]:
    result = []
    for user in users:
        real_preds = [p for p in user.predictions if not p.match.is_test]
        # Final points for finished matches + provisional points for live ones
        # (recomputed from the current live score on every request, so the
        # table moves in real time; finalized for good when the match ends)
        match_pts = 0
        for p in real_preds:
            m = p.match
            if m.status == "finished":
                match_pts += p.points or 0
            elif m.status == "live" and m.home_score is not None and m.away_score is not None:
                match_pts += scoring.calculate_points(
                    m.stage, m.home_score, m.away_score, p.home_score, p.away_score
                )
        special_pts = sum(s.points or 0 for s in user.special_predictions)
        winner_pick = next((s.value for s in user.special_predictions if s.prediction_type == "winner"), None)
        top_scorer_pick = next((s.value for s in user.special_predictions if s.prediction_type == "top_scorer"), None)
        exact_count = 0
        direction_count = 0
        for p in real_preds:
            m = p.match
            # Live matches count too — provisional, recalculated per request
            if m.status not in ("finished", "live") or m.home_score is None or m.away_score is None:
                continue
            # Knockout ET/pens: evaluate against the 90-min score, not the final
            ref_h = m.score_90_home if m.score_90_home is not None else m.home_score
            ref_a = m.score_90_away if m.score_90_away is not None else m.away_score
            if p.home_score == ref_h and p.away_score == ref_a:
                exact_count += 1
            elif (p.home_score - p.away_score) * (ref_h - ref_a) > 0 or \
                 (p.home_score == p.away_score and ref_h == ref_a):
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
    # Points desc → exact hits desc (tiebreaker) → name asc
    result.sort(key=lambda u: (-u.total_points, -u.exact_count, u.name))
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
    my_group_ids = {
        ug.group_id for ug in
        db.query(models.UserGroup).filter(models.UserGroup.user_id == current_user.id).all()
    }

    if group_id:
        if group_id not in my_group_ids and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="אינך חבר בקבוצה זו")
        user_ids = [
            ug.user_id for ug in db.query(models.UserGroup).filter(
                models.UserGroup.group_id == group_id
            ).all()
        ]
    else:
        # No group specified — only users sharing a group with the requester
        user_ids = [
            ug.user_id for ug in db.query(models.UserGroup).filter(
                models.UserGroup.group_id.in_(my_group_ids)
            ).all()
        ] if my_group_ids else [current_user.id]

    users = db.query(models.User).options(*eager).filter(models.User.id.in_(user_ids)).all()

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
