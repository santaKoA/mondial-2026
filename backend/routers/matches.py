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


@router.get("/teams", response_model=list[schemas.TeamOut])
def list_teams(
    _: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Team).order_by(models.Team.name).all()


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

    # Load all predictions for this user in a single query, keyed by match_id
    pred_map: dict[int, models.Prediction] = {}
    if current_user:
        match_ids = [m.id for m in matches]
        preds = db.query(models.Prediction).filter(
            models.Prediction.user_id == current_user.id,
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
            home_team=schemas.TeamOut.model_validate(m.home_team) if m.home_team else None,
            away_team=schemas.TeamOut.model_validate(m.away_team) if m.away_team else None,
            home_score=m.home_score,
            away_score=m.away_score,
            status=m.status,
            my_prediction=schemas.PredictionOut.model_validate(p) if p else None,
        ))
    return result
