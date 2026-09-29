import os
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile
)

from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Certificate
from ..services.hashing import calculate_sha256


router = APIRouter(
    prefix="/api/certificates",
    tags=["Certificates"]
)


UPLOAD_DIR = "uploads"

os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/issue")
async def issue_certificate(
    file: UploadFile = File(...),
    student_name: str = Form(...),
    certificate_type: str = Form(...),
    institution: str = Form(...),
    db: Session = Depends(get_db)
):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file supplied"
        )

    allowed_types = {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp"
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type"
        )

    file_bytes = await file.read()

    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File exceeds 10 MB"
        )

    certificate_hash = calculate_sha256(file_bytes)

    certificate_id = (
        "CERT-"
        + uuid.uuid4().hex[:10].upper()
    )

    file_path = os.path.join(
        UPLOAD_DIR,
        certificate_id + "-" + file.filename
    )

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    certificate = Certificate(
        certificate_id=certificate_id,
        student_name=student_name,
        certificate_type=certificate_type,
        institution=institution,
        certificate_hash=certificate_hash,
        file_name=file.filename,
        issuer_address="PENDING",
        transaction_hash=None
    )

    db.add(certificate)
    db.commit()
    db.refresh(certificate)

    return {
        "certificate_id": certificate_id,
        "certificate_hash": certificate_hash,
        "status": "CREATED"
    }