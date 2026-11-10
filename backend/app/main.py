import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api import auth, planner, resources, stats, topics
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import SessionLocal

configure_logging(settings.log_level)
log = logging.getLogger("skillforge")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("SkillForge API starting (env=%s)", settings.env)
    yield


app = FastAPI(
    title="SkillForge API",
    version="1.0.0",
    description="Solution Engineer learning tracker. All endpoints except /auth/register, /auth/login, "
                "/auth/refresh and /health require a Bearer access token and only ever return the caller's own data.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,  # tokens travel in the Authorization header, not cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("unhandled error", extra={"request_id": request_id, "method": request.method, "path": request.url.path})
        return JSONResponse({"detail": "Internal server error", "request_id": request_id}, status_code=500)
    response.headers["x-request-id"] = request_id
    response.headers["x-content-type-options"] = "nosniff"
    response.headers["referrer-policy"] = "no-referrer"
    log.info("request", extra={
        "request_id": request_id, "method": request.method, "path": request.url.path,
        "status": response.status_code, "duration_ms": round((time.perf_counter() - start) * 1000, 1),
    })
    return response


@app.exception_handler(SQLAlchemyError)
async def db_error_handler(request: Request, exc: SQLAlchemyError):
    log.exception("database error", extra={"path": request.url.path})
    return JSONResponse({"detail": "A database error occurred. Your change was not saved. Please try again."}, status_code=503)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    # Pydantic prefixes custom validator messages with "Value error, "; users should not see that.
    errors = [
        {"field": ".".join(str(p) for p in e["loc"] if p != "body"), "message": str(e["msg"]).removeprefix("Value error, ")}
        for e in exc.errors()
    ]
    first = errors[0]["message"] if errors else "Invalid request"
    return JSONResponse({"detail": first, "errors": errors}, status_code=422)


@app.get("/api/health", tags=["system"], summary="Liveness and database connectivity")
def health():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse({"status": "degraded", "database": "unreachable"}, status_code=503)
    return {"status": "ok", "database": "ok"}


for r in (auth.router, topics.router, planner.router, resources.router, stats.router):
    app.include_router(r, prefix="/api")
