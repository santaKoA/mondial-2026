from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from config import settings
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_to_out(user: models.User, db: Session) -> schemas.UserOut:
    total = sum(p.points or 0 for p in user.predictions) + sum(s.points for s in user.special_predictions)
    count = len(user.predictions)
    return schemas.UserOut(
        id=user.id,
        name=user.name,
        is_admin=user.is_admin,
        total_points=total,
        prediction_count=count,
    )


@router.post("/join", response_model=schemas.TokenResponse)
def join(body: schemas.JoinRequest, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name required")

    is_admin = False
    if body.code == settings.ADMIN_CODE:
        is_admin = True
    elif body.code != settings.GROUP_CODE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="קוד שגוי")

    user = db.query(models.User).filter(models.User.name == name).first()
    if user:
        if is_admin and not user.is_admin:
            user.is_admin = True
            db.commit()
    else:
        user = models.User(name=name, is_admin=is_admin)
        db.add(user)
        db.commit()
        db.refresh(user)

    token = auth_utils.create_token(user.id, user.name, user.is_admin)
    return schemas.TokenResponse(token=token, user=_user_to_out(user, db))


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(auth_utils.get_current_user), db: Session = Depends(get_db)):
    return _user_to_out(current_user, db)
