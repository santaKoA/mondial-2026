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


@router.get("/my", response_model=list[schemas.PredictionOut])
def my_predictions(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Prediction).filter(models.Prediction.user_id == current_user.id).all()
