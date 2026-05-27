from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("", response_model=list[schemas.UserOut])
def leaderboard(
    _: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    users = db.query(models.User).all()
    result = []
    for user in users:
        match_pts = sum(p.points or 0 for p in user.predictions)
        special_pts = sum(s.points for s in user.special_predictions)
        result.append(
            schemas.UserOut(
                id=user.id,
                name=user.name,
                is_admin=user.is_admin,
                total_points=match_pts + special_pts,
                prediction_count=len(user.predictions),
            )
        )
    result.sort(key=lambda u: (-u.total_points, u.name))
    return result
