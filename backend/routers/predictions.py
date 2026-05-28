from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

CUTOFF_MINUTES = 5


def _can_predict(match: models.Match) -> bool:
    now = datetime.now(timezone.utc)
    cutoff = match.scheduled_at.replace(tzinfo=timezone.utc) - timedelta(minutes=CUTOFF_MINUTES)
    return now < cutoff and match.status == "upcoming"


@router.post("/{match_id}", response_model=schemas.PredictionOut)
def upsert_prediction(
    match_id: int,
    body: schemas.PredictionIn,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if not _can_predict(match):
        raise HTTPException(status_code=400, detail="ההגשה נסגרה 5 דקות לפני תחילת המשחק")

    existing = db.query(models.Prediction).filter(
        models.Prediction.match_id == match_id,
        models.Prediction.user_id == current_user.id,
    ).first()

    now = datetime.now(timezone.utc)
    if existing:
        existing.home_score = body.home_score
        existing.away_score = body.away_score
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        return schemas.PredictionOut.model_validate(existing)
    else:
        pred = models.Prediction(
            user_id=current_user.id,
            match_id=match_id,
            home_score=body.home_score,
            away_score=body.away_score,
            submitted_at=now,
            updated_at=now,
        )
        db.add(pred)
        db.commit()
        db.refresh(pred)
        return schemas.PredictionOut.model_validate(pred)


@router.get("/match/{match_id}", response_model=list[schemas.GroupPredictionOut])
def group_predictions(
    match_id: int,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Reveal only after the match has actually kicked off (not just locked)
    kickoff = match.scheduled_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) < kickoff:
        raise HTTPException(status_code=403, detail="ניחושים יוצגו לאחר תחילת המשחק")

    # Collect all groups the current user belongs to
    user_group_ids = [
        ug.group_id for ug in
        db.query(models.UserGroup).filter(models.UserGroup.user_id == current_user.id).all()
    ]
    if not user_group_ids:
        return []

    # Collect all unique member IDs across all those groups
    all_member_ids = set()
    for gid in user_group_ids:
        for ug in db.query(models.UserGroup).filter(models.UserGroup.group_id == gid).all():
            all_member_ids.add(ug.user_id)

    all_users = {
        u.id: u.name
        for u in db.query(models.User).filter(models.User.id.in_(all_member_ids)).all()
    }

    pred_map = {
        p.user_id: p for p in
        db.query(models.Prediction).filter(
            models.Prediction.match_id == match_id,
            models.Prediction.user_id.in_(all_member_ids),
        ).all()
    }

    result = []
    for uid, uname in all_users.items():
        p = pred_map.get(uid)
        result.append(schemas.GroupPredictionOut(
            user_name=uname,
            home_score=p.home_score if p else None,
            away_score=p.away_score if p else None,
            points=p.points if p else None,
        ))

    result.sort(key=lambda x: (x.home_score is None, x.user_name))
    return result


@router.get("/my", response_model=list[schemas.PredictionOut])
def my_predictions(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Prediction).filter(models.Prediction.user_id == current_user.id).all()
