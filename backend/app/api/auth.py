from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, rate_limit_auth
from app.core.config import settings
from app.core.security import (
    DUMMY_HASH, create_access_token, create_refresh_token, decode_token, hash_password, hash_token_id, verify_password,
)
from app.db.session import get_db
from app.models import Category, Milestone, RefreshToken, User
from app.schemas.auth import LoginIn, PasswordChange, RefreshIn, RegisterIn, TokenOut, UserOut, UserUpdate
from app.services.common import user_today

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue(db: Session, user: User) -> TokenOut:
    refresh, expires, jti = create_refresh_token(user.id)
    # Housekeeping: expired tokens can never be used again, so do not let them accumulate.
    db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.expires_at < datetime.now(timezone.utc)))
    db.add(RefreshToken(user_id=user.id, jti_hash=hash_token_id(jti), expires_at=expires))
    return TokenOut(access_token=create_access_token(user.id), refresh_token=refresh, user=UserOut.model_validate(user))


def _revoke_all(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
        .values(revoked=True, revoked_at=datetime.now(timezone.utc))
    )


def _utc(ts: datetime) -> datetime:
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)  # some drivers return naive UTC


def _default_milestones(db: Session, user: User) -> None:
    start = user_today(user)
    for i, cat in enumerate(db.scalars(select(Category).order_by(Category.sort_order))):
        db.add(Milestone(
            user_id=user.id, category_id=cat.id, title=f"Complete {cat.name}",
            description="Auto-completes when every built-in topic in this category is completed. Edit the date to fit your plan.",
            target_date=start + timedelta(days=45 * (i + 1)),
        ))


@router.post("/register", response_model=TokenOut, status_code=201, dependencies=[Depends(rate_limit_auth)])
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.email == body.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(email=body.email, name=body.name, password_hash=hash_password(body.password), timezone=body.timezone)
    db.add(user)
    try:
        db.flush()
    except IntegrityError:  # lost a race with a concurrent registration
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists") from None
    _default_milestones(db, user)
    tokens = _issue(db, user)
    db.commit()
    return tokens


@router.post("/login", response_model=TokenOut, dependencies=[Depends(rate_limit_auth)])
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    # Verify against a dummy hash when the user is missing so timing does not reveal which emails exist.
    ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if not user or not ok or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    tokens = _issue(db, user)
    db.commit()
    return tokens


@router.post("/refresh", response_model=TokenOut, dependencies=[Depends(rate_limit_auth)])
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    invalid = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    try:
        payload = decode_token(body.refresh_token, "refresh")
        user_id = int(payload["sub"])
        jti_hash = hash_token_id(payload["jti"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise invalid from None

    record = db.scalar(select(RefreshToken).where(RefreshToken.jti_hash == jti_hash, RefreshToken.user_id == user_id))
    if record is None:
        raise invalid
    if record.revoked:
        # A rotated-out token was presented again. Moments after rotation that is almost always a second
        # browser tab racing the first, so just refuse it. Later than that, assume theft and end every
        # session for this user.
        now = datetime.now(timezone.utc)
        just_rotated = (
            record.revoked_at is not None
            and (now - _utc(record.revoked_at)).total_seconds() <= settings.refresh_reuse_grace_seconds
        )
        if not just_rotated:
            _revoke_all(db, user_id)
            db.commit()
        raise invalid
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise invalid
    record.revoked = True  # rotation: each refresh token works exactly once
    record.revoked_at = datetime.now(timezone.utc)
    tokens = _issue(db, user)
    db.commit()
    return tokens


@router.post("/logout", status_code=204)
def logout(body: RefreshIn, db: Session = Depends(get_db)):
    """Revokes the given refresh token. Always returns 204 so it cannot be used to probe tokens."""
    try:
        payload = decode_token(body.refresh_token, "refresh")
        record = db.scalar(select(RefreshToken).where(RefreshToken.jti_hash == hash_token_id(payload["jti"])))
        if record and not record.revoked:
            record.revoked = True
            record.revoked_at = datetime.now(timezone.utc)
            db.commit()
    except (jwt.PyJWTError, KeyError):
        pass
    return Response(status_code=204)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(user, field, value)
    db.commit()
    return user


@router.post("/change-password", status_code=204)
def change_password(body: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    _revoke_all(db, user.id)  # sign out everywhere
    db.commit()
    return Response(status_code=204)
