"""Environment-driven configuration. No secrets are hard-coded or logged."""
import os
from dataclasses import dataclass, field

_INSECURE_SECRETS = {"", "change-me", "changeme", "secret", "dev-secret"}


def _csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    env: str = "development"
    database_url: str = "postgresql+psycopg2://skillforge:skillforge@localhost:5432/skillforge"
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    # A rotated-out refresh token presented again within this window is refused but does NOT revoke the
    # session family: two browser tabs refreshing at the same moment is normal, not theft.
    refresh_reuse_grace_seconds: int = 20
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:5173"])
    s3_bucket: str = ""
    aws_region: str = "ap-south-1"
    auth_rate_limit: int = 10  # attempts ...
    auth_rate_window_seconds: int = 60  # ... per window, per client IP
    log_level: str = "INFO"
    trust_proxy: bool = False  # honour X-Forwarded-For (set only behind a trusted load balancer)

    @property
    def is_production(self) -> bool:
        return self.env.lower() in {"production", "prod"}


def load_settings(environ: dict | None = None) -> Settings:
    e = environ if environ is not None else os.environ
    s = Settings(
        env=e.get("ENV", "development"),
        database_url=e.get("DATABASE_URL", Settings.database_url),
        jwt_secret=e.get("JWT_SECRET", ""),
        jwt_algorithm=e.get("JWT_ALGORITHM", "HS256"),
        access_token_minutes=int(e.get("ACCESS_TOKEN_MINUTES", "15")),
        refresh_token_days=int(e.get("REFRESH_TOKEN_DAYS", "14")),
        refresh_reuse_grace_seconds=int(e.get("REFRESH_REUSE_GRACE_SECONDS", "20")),
        cors_origins=_csv(e.get("CORS_ORIGINS", "http://localhost:5173")),
        s3_bucket=e.get("S3_BUCKET", ""),
        aws_region=e.get("AWS_REGION", "ap-south-1"),
        auth_rate_limit=int(e.get("AUTH_RATE_LIMIT", "10")),
        auth_rate_window_seconds=int(e.get("AUTH_RATE_WINDOW_SECONDS", "60")),
        log_level=e.get("LOG_LEVEL", "INFO").upper(),
        trust_proxy=e.get("TRUST_PROXY", "0") in {"1", "true", "True"},
    )
    if s.jwt_secret in _INSECURE_SECRETS or len(s.jwt_secret) < 32:
        if s.is_production:
            raise RuntimeError("JWT_SECRET must be set to a random value of at least 32 characters in production")
        # Development convenience only: an ephemeral secret, so tokens die on restart.
        object.__setattr__(s, "jwt_secret", os.urandom(32).hex())
    if s.is_production and "*" in s.cors_origins:
        raise RuntimeError("CORS_ORIGINS must not contain '*' in production")
    return s


settings = load_settings()
