from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/matches", tags=["matches"])

STAGE_ORDER = {
    "group": 0,
    "round_of_32": 1,
    "round_of_16": 2,
    "quarter_final": 3,
    "semi_final": 4,
    "third_place": 5,
    "final": 6,
}


def _enrich_match(match: models.Match, user: Optional[models.User], db: Session) -> schemas.MatchOut:
    pred = None
    if user:
        p = db.query(models.Prediction).filter(
            models.Prediction.match_id == match.id,
            models.Prediction.user_id == user.id,
        ).first()
        if p:
            pred = schemas.PredictionOut.model_validate(p)

    return schemas.MatchOut(
        id=match.id,
        match_number=match.match_number,
        stage=match.stage,
        group_name=match.group_name,
        scheduled_at=match.scheduled_at,
        home_team=schemas.TeamOut.model_validate(match.home_team) if match.home_team else None,
        away_team=schemas.TeamOut.model_validate(match.away_team) if match.away_team else None,
        home_score=match.home_score,
        away_score=match.away_score,
        status=match.status,
        my_prediction=pred,
    )


@router.get("", response_model=list[schemas.MatchOut])
def list_matches(
    stage: Optional[str] = None,
    current_user: Optional[models.User] = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Match).options(
        joinedload(models.Match.home_team),
        joinedload(models.Match.away_team),
    )
    if stage:
        q = q.filter(models.Match.stage == stage)
    matches = q.order_by(models.Match.scheduled_at, models.Match.match_number).all()
    return [_enrich_match(m, current_user, db) for m in matches]
