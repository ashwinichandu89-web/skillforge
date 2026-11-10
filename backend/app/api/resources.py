import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models import LearningResource, User
from app.schemas.content import ResourceCreate, ResourceOut, ResourceUpdate, UploadUrlIn
from app.services.common import get_category, get_visible_topic, not_found

router = APIRouter(prefix="/resources", tags=["resources"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _s3():
    if not settings.s3_bucket:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "File storage is not configured on this server (S3_BUCKET is not set)")
    import boto3  # imported lazily so the API runs without AWS libraries when S3 is unused
    return boto3.client("s3", region_name=settings.aws_region)


def _check_links(db: Session, user: User, topic_id: int | None, category_id: int | None) -> int | None:
    """Validates referenced ids belong to the user's visible data. Returns the category implied by the topic."""
    if topic_id is not None:
        topic = get_visible_topic(db, user, topic_id)
        return topic.category_id
    if category_id is not None:
        get_category(db, category_id)
    return category_id


def _own(db: Session, user: User, resource_id: int) -> LearningResource:
    r = db.scalar(select(LearningResource).where(LearningResource.id == resource_id, LearningResource.user_id == user.id))
    if r is None:
        raise not_found("Resource")
    return r


@router.get("", response_model=list[ResourceOut])
def list_resources(
    category_id: int | None = None, topic_id: int | None = None, kind: str | None = None, q: str | None = None,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    query = select(LearningResource).where(LearningResource.user_id == user.id)
    if category_id is not None:
        query = query.where(LearningResource.category_id == category_id)
    if topic_id is not None:
        query = query.where(LearningResource.topic_id == topic_id)
    if kind:
        query = query.where(LearningResource.kind == kind)
    if q:
        like = f"%{q.strip()[:100]}%"
        query = query.where(LearningResource.title.ilike(like) | LearningResource.notes.ilike(like))
    return list(db.scalars(query.order_by(LearningResource.created_at.desc()).limit(500)))


@router.post("", response_model=ResourceOut, status_code=201)
def create_resource(body: ResourceCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    category_id = _check_links(db, user, body.topic_id, body.category_id)
    if body.s3_key and not body.s3_key.startswith(f"users/{user.id}/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid file reference")
    if not (body.url or body.s3_key or body.notes.strip()):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Provide a link, an uploaded file, or notes")
    r = LearningResource(
        user_id=user.id, topic_id=body.topic_id, category_id=category_id, title=body.title.strip(), kind=body.kind,
        url=body.url, s3_key=body.s3_key, filename=body.filename, notes=body.notes,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.patch("/{resource_id}", response_model=ResourceOut)
def update_resource(resource_id: int, body: ResourceUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = _own(db, user, resource_id)
    data = body.model_dump(exclude_unset=True)
    if "topic_id" in data or "category_id" in data:
        topic_id = data.get("topic_id", r.topic_id)
        category_id = _check_links(db, user, topic_id, data.get("category_id", r.category_id))
        r.topic_id, r.category_id = topic_id, category_id
    for f in ("title", "kind", "url", "notes"):
        if f in data and data[f] is not None:
            setattr(r, f, data[f])
    if not (r.url or r.s3_key or (r.notes or "").strip()):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A resource needs a link, a file, or notes")
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{resource_id}", status_code=204)
def delete_resource(resource_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = _own(db, user, resource_id)
    key = r.s3_key
    db.delete(r)
    db.commit()
    if key and settings.s3_bucket:  # best effort: the DB row is the source of truth
        try:
            _s3().delete_object(Bucket=settings.s3_bucket, Key=key)
        except Exception:  # noqa: BLE001
            pass
    return Response(status_code=204)


@router.post("/upload-url", summary="Get a presigned POST for uploading a PDF directly to S3")
def upload_url(body: UploadUrlIn, user: User = Depends(get_current_user)):
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", body.filename)[-100:] or "file.pdf"
    key = f"users/{user.id}/{uuid.uuid4().hex}/{safe}"
    post = _s3().generate_presigned_post(
        Bucket=settings.s3_bucket, Key=key,
        Fields={"Content-Type": body.content_type},
        Conditions=[{"Content-Type": body.content_type}, ["content-length-range", 1, MAX_UPLOAD_BYTES]],
        ExpiresIn=300,
    )
    return {"s3_key": key, "filename": safe, "url": post["url"], "fields": post["fields"], "max_bytes": MAX_UPLOAD_BYTES}


@router.get("/{resource_id}/download-url", summary="Short-lived link to download an uploaded file")
def download_url(resource_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = _own(db, user, resource_id)
    if not r.s3_key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This resource has no uploaded file")
    url = _s3().generate_presigned_url(
        "get_object", Params={"Bucket": settings.s3_bucket, "Key": r.s3_key}, ExpiresIn=300,
    )
    return {"url": url}
