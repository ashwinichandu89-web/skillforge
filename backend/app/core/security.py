"""Password hashing and JWT helpers.

Passwords use PBKDF2-HMAC-SHA256 from the standard library (OWASP-recommended
iteration count) with a per-password random salt and constant-time comparison.
"""
import base64
import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings

_ITERATIONS = 600_000
_ALGO = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return "$".join([_ALGO, str(_ITERATIONS), base64.b64encode(salt).decode(), base64.b64encode(digest).decode()])


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_b64, digest_b64 = stored.split("$")
        if algo != _ALGO:
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


# Used to keep login timing similar whether or not the email exists.
DUMMY_HASH = hash_password(secrets.token_hex(8))


def hash_token_id(jti: str) -> str:
    return hashlib.sha256(jti.encode()).hexdigest()


def _encode(sub: int, token_type: str, lifetime: timedelta, jti: str | None = None) -> tuple[str, datetime, str]:
    now = datetime.now(timezone.utc)
    exp = now + lifetime
    jti = jti or uuid.uuid4().hex
    payload = {"sub": str(sub), "type": token_type, "iat": now, "exp": exp, "jti": jti}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), exp, jti


def create_access_token(user_id: int) -> str:
    token, _, _ = _encode(user_id, "access", timedelta(minutes=settings.access_token_minutes))
    return token


def create_refresh_token(user_id: int) -> tuple[str, datetime, str]:
    """Returns (token, expires_at, jti). The jti hash is stored server-side for revocation."""
    return _encode(user_id, "refresh", timedelta(days=settings.refresh_token_days))


def decode_token(token: str, expected_type: str) -> dict:
    """Raises jwt.PyJWTError on any problem (expired, bad signature, wrong type)."""
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return payload
