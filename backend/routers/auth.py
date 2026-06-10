from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from config import settings
import secrets
import models
import schemas
import auth as auth_utils
from auth import hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_to_out(user: models.User, db: Session) -> schemas.UserOut:
    real_preds = [p for p in user.predictions if not p.match.is_test]
    total = sum(p.points or 0 for p in real_preds) + sum(s.points or 0 for s in user.special_predictions)
    count = len(real_preds)
    return schemas.UserOut(
        id=user.id,
        name=user.name,
        is_admin=user.is_admin,
        total_points=total,
        prediction_count=count,
    )


def _group_to_out(group: models.Group, db: Session) -> schemas.GroupOut:
    count = db.query(models.UserGroup).filter(models.UserGroup.group_id == group.id).count()
    return schemas.GroupOut(id=group.id, name=group.name, code=group.code, member_count=count, owner_id=group.owner_id)


def _add_to_group(user: models.User, group: models.Group, db: Session):
    existing = db.query(models.UserGroup).filter(
        models.UserGroup.user_id == user.id,
        models.UserGroup.group_id == group.id,
    ).first()
    if not existing:
        db.add(models.UserGroup(user_id=user.id, group_id=group.id))


def _get_or_create_user(name: str, password: str, group: models.Group, is_admin: bool, db: Session) -> tuple[models.User, bool]:
    """Returns (user, created). created=True only when a brand-new user was registered."""
    if not password:
        raise HTTPException(status_code=400, detail="סיסמה נדרשת")

    # First: find by primary group (original sign-up group)
    user = db.query(models.User).filter(
        models.User.name == name,
        models.User.group_id == group.id,
    ).first()

    # Second: find by group membership — handles multi-group users logging in
    # with a code of a group they joined later (not their primary group)
    if not user:
        user = (
            db.query(models.User)
            .join(models.UserGroup, models.UserGroup.user_id == models.User.id)
            .filter(models.UserGroup.group_id == group.id, models.User.name == name)
            .first()
        )

    if user:
        if user.password_hash is None:
            user.password_hash = hash_password(password)
        elif not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="סיסמה שגויה. אם אתה משתמש חדש — השם הזה כבר תפוס בקבוצה, נסה שם אחר",
            )
        if is_admin and not user.is_admin:
            user.is_admin = True
        db.flush()
        return user, False
    else:
        user = models.User(name=name, is_admin=is_admin, password_hash=hash_password(password), group_id=group.id)
        db.add(user)
        db.flush()
        return user, True


@router.post("/join", response_model=schemas.TokenResponse)
def join(body: schemas.JoinRequest, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name required")

    is_admin = False
    group = None

    if body.code == settings.ADMIN_CODE:
        is_admin = True
        group = db.query(models.Group).filter(models.Group.code == settings.GROUP_CODE).first()
        if not group:
            raise HTTPException(status_code=500, detail="קבוצת ברירת המחדל לא קיימת — פנה למנהל המערכת")
    else:
        group = db.query(models.Group).filter(models.Group.code == body.code).first()
        if not group:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="קוד שגוי — בדוק שהקוד נכון")

    user, created = _get_or_create_user(name, body.password, group, is_admin, db)
    # Only auto-add membership for brand-new users. Existing users logging back in
    # keep their current memberships — so a member removed by the group owner
    # isn't silently re-added on next login.
    if created:
        _add_to_group(user, group, db)

    db.commit()
    db.refresh(user)

    token = auth_utils.create_token(user.id, user.name, user.is_admin)
    group_out = _group_to_out(group, db) if group else None
    return schemas.TokenResponse(token=token, user=_user_to_out(user, db), group=group_out)


@router.post("/create-group", response_model=schemas.TokenResponse)
def create_group_and_join(body: schemas.GroupCreatePublicIn, db: Session = Depends(get_db)):
    user_name = body.user_name.strip()
    group_name = body.group_name.strip()
    if not user_name or not group_name:
        raise HTTPException(status_code=400, detail="יש למלא שם וקוד")

    code = secrets.token_urlsafe(6)
    group = models.Group(name=group_name, code=code, owner_id=None)
    db.add(group)
    db.flush()
    user, _ = _get_or_create_user(user_name, body.password, group, False, db)
    group.owner_id = user.id
    db.flush()
    _add_to_group(user, group, db)

    db.commit()
    db.refresh(user)
    db.refresh(group)

    token = auth_utils.create_token(user.id, user.name, user.is_admin)
    return schemas.TokenResponse(token=token, user=_user_to_out(user, db), group=_group_to_out(group, db))


@router.post("/groups", response_model=schemas.GroupOut)
def create_additional_group(
    body: schemas.GroupCreateIn,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    code = secrets.token_urlsafe(6)
    group = models.Group(name=body.name.strip(), code=code, owner_id=current_user.id)
    db.add(group)
    db.flush()
    _add_to_group(current_user, group, db)
    db.commit()
    db.refresh(group)
    count = db.query(models.UserGroup).filter(models.UserGroup.group_id == group.id).count()
    return schemas.GroupOut(id=group.id, name=group.name, code=group.code, member_count=count, owner_id=group.owner_id)


@router.post("/join-group", response_model=schemas.GroupOut)
def join_existing_group(
    body: schemas.JoinGroupByCodeIn,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(models.Group).filter(models.Group.code == body.code.strip()).first()
    if not group:
        raise HTTPException(status_code=400, detail="קוד שגוי — בדוק שהקוד נכון")
    already = db.query(models.UserGroup).filter(
        models.UserGroup.user_id == current_user.id,
        models.UserGroup.group_id == group.id,
    ).first()
    if already:
        raise HTTPException(status_code=400, detail="כבר חבר בקבוצה זו")
    _add_to_group(current_user, group, db)
    db.commit()
    return _group_to_out(group, db)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(auth_utils.get_current_user), db: Session = Depends(get_db)):
    return _user_to_out(current_user, db)


@router.put("/change-password")
def change_password(
    body: schemas.ChangePasswordIn,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.password_hash or not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="הסיסמה הישנה שגויה")
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="הסיסמה החדשה חייבת להכיל לפחות 4 תווים")
    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
