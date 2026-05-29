from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import auth as auth_utils
from utils import tournament_started

router = APIRouter(prefix="/api/special-predictions", tags=["special_predictions"])

ALLOWED_TYPES = {"winner", "top_scorer"}


@router.get("/my", response_model=list[schemas.SpecialPredictionOut])
def my_special_predictions(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.SpecialPrediction).filter(
        models.SpecialPrediction.user_id == current_user.id
    ).all()


@router.post("", response_model=schemas.SpecialPredictionOut)
def upsert_special_prediction(
    body: schemas.SpecialPredictionIn,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    if body.prediction_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Invalid prediction type")
    if tournament_started():
        raise HTTPException(status_code=400, detail="הניחושים המיוחדים נסגרו עם תחילת הטורניר")

    existing = db.query(models.SpecialPrediction).filter(
        models.SpecialPrediction.user_id == current_user.id,
        models.SpecialPrediction.prediction_type == body.prediction_type,
    ).first()

    if existing:
        existing.value = body.value
        existing.submitted_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return schemas.SpecialPredictionOut.model_validate(existing)
    else:
        sp = models.SpecialPrediction(
            user_id=current_user.id,
            prediction_type=body.prediction_type,
            value=body.value,
        )
        db.add(sp)
        db.commit()
        db.refresh(sp)
        return schemas.SpecialPredictionOut.model_validate(sp)
