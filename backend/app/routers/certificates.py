import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Certificate

from ..schemas import (
    CertificateDetailsResponse,
    CertificateFinalizeRequest,
    CertificateIssueResponse,
    CertificatePrepareResponse,
    CertificateVerifyResponse,
)

from ..services.blockchain import blockchain
from ..services.hashing import calculate_sha256
from ..services.storage import storage


router = APIRouter(
    prefix="/api/certificates",
    tags=["Certificates"]
)


settings = get_settings()


ALLOWED_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
}


@router.post(
    "/prepare",
    response_model=CertificatePrepareResponse
)
async def prepare_certificate(
    file: UploadFile = File(...),

    student_name: str = Form(...),

    certificate_type: str = Form(...),

    institution: str = Form(...),

    db: Session = Depends(get_db),
):

    """
    Prepare certificate for blockchain registration.

    This endpoint:
    1. receives the certificate
    2. calculates SHA-256
    3. stores the certificate off-chain
    4. creates a certificate ID
    5. returns the hash

    MetaMask performs the actual blockchain transaction.
    """

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No file supplied"
        )

    if file.content_type not in ALLOWED_TYPES:

        raise HTTPException(
            status_code=400,
            detail="Unsupported file type"
        )

    file_bytes = await file.read()

    if len(file_bytes) > settings.max_upload_size:

        raise HTTPException(
            status_code=400,
            detail="File exceeds the maximum upload size"
        )

    certificate_hash = calculate_sha256(
        file_bytes
    )

    # Check whether exact file already exists
    existing = db.scalar(
        select(Certificate).where(
            Certificate.certificate_hash
            == certificate_hash
        )
    )

    if existing:

        raise HTTPException(
            status_code=409,
            detail=(
                "This exact file is already registered "
                f"as {existing.certificate_id}"
            )
        )

    certificate_id = (
        "CERT-"
        + uuid.uuid4().hex[:10].upper()
    )

    stored_file_key = storage.save(
        file.filename,
        file_bytes
    )

    certificate = Certificate(

        certificate_id=certificate_id,

        student_name=student_name.strip(),

        certificate_type=certificate_type.strip(),

        institution=institution.strip(),

        file_name=file.filename,

        stored_file_key=stored_file_key,

        certificate_hash=certificate_hash,

        issuer_id=None,

        issuer_address=None,

        transaction_hash=None,
    )

    db.add(certificate)

    db.commit()

    return CertificatePrepareResponse(

        certificate_id=certificate_id,

        certificate_hash=(
            "0x" + certificate_hash
        ),

        status="READY_FOR_METAMASK",
    )


@router.post(
    "/{certificate_id}/finalize",
    response_model=CertificateIssueResponse
)
def finalize_certificate(
    certificate_id: str,

    payload: CertificateFinalizeRequest,

    db: Session = Depends(get_db),
):

    """
    Finalize an already submitted MetaMask transaction.

    The backend verifies that:
    - the transaction succeeded
    - it was sent to our contract
    - the certificate exists
    - the hash matches
    - the issuer is the transaction sender
    """

    certificate = db.scalar(
        select(Certificate).where(
            Certificate.certificate_id
            == certificate_id
        )
    )

    if not certificate:

        raise HTTPException(
            status_code=404,
            detail="Certificate preparation not found"
        )

    if certificate.transaction_hash:

        return CertificateIssueResponse(

            certificate_id=certificate.certificate_id,

            certificate_hash=(
                "0x"
                + certificate.certificate_hash
            ),

            transaction_hash=(
                certificate.transaction_hash
            ),

            issuer_address=(
                certificate.issuer_address
                or ""
            ),

            status="ALREADY_FINALIZED",
        )

    try:

        result = blockchain.finalize_transaction(

            certificate_id=(
                certificate.certificate_id
            ),

            certificate_hash=(
                "0x"
                + certificate.certificate_hash
            ),

            tx_hash=payload.transaction_hash,
        )

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc)
        )

    certificate.transaction_hash = (
        result["transaction_hash"]
    )

    certificate.issuer_address = (
        result["issuer_address"]
    )

    certificate.blockchain_timestamp = (
        result["timestamp"]
    )

    db.commit()

    return CertificateIssueResponse(

        certificate_id=certificate.certificate_id,

        certificate_hash=(
            "0x"
            + certificate.certificate_hash
        ),

        transaction_hash=(
            certificate.transaction_hash
        ),

        issuer_address=(
            certificate.issuer_address
        ),

        status="REGISTERED_ON_CHAIN",
    )


@router.get(
    "/{certificate_id}/verify",
    response_model=CertificateVerifyResponse
)
def verify_by_id(
    certificate_id: str
):

    """
    Verify that a certificate ID exists on Sepolia
    and has not been revoked.
    """

    try:

        chain = blockchain.get_certificate(
            certificate_id
        )

    except Exception as exc:

        raise HTTPException(
            status_code=503,
            detail=(
                f"Blockchain unavailable: {exc}"
            )
        )

    if not chain["exists"]:

        return CertificateVerifyResponse(

            valid=False,

            status="NOT_FOUND",

            message=(
                "No on-chain certificate record "
                "exists for this ID."
            ),

            certificate_id=certificate_id,
        )

    if chain["revoked"]:

        return CertificateVerifyResponse(

            valid=False,

            status="REVOKED",

            message=(
                "The certificate exists on-chain "
                "but has been revoked."
            ),

            certificate_id=certificate_id,

            blockchain_hash=(
                chain["certificate_hash"]
            ),

            issuer_address=(
                chain["issuer_address"]
            ),

            timestamp=(
                chain["timestamp"]
            ),
        )

    return CertificateVerifyResponse(

        valid=True,

        status="REGISTERED",

        message=(
            "On-chain certificate record found. "
            "Upload the exact certificate file "
            "to verify its contents."
        ),

        certificate_id=certificate_id,

        blockchain_hash=(
            chain["certificate_hash"]
        ),

        issuer_address=(
            chain["issuer_address"]
        ),

        timestamp=(
            chain["timestamp"]
        ),
    )


@router.post(
    "/verify/file",
    response_model=CertificateVerifyResponse
)
async def verify_file(

    file: UploadFile = File(...),

    certificate_id: str = Form(...),
):

    """
    Strong certificate verification.

    Calculates SHA-256 of uploaded file and
    compares it against the hash stored on Sepolia.
    """

    if file.content_type not in ALLOWED_TYPES:

        raise HTTPException(
            status_code=400,
            detail="Unsupported file type"
        )

    file_bytes = await file.read()

    if len(file_bytes) > settings.max_upload_size:

        raise HTTPException(
            status_code=400,
            detail="File exceeds the maximum upload size"
        )

    file_hash = (
        "0x"
        + calculate_sha256(file_bytes)
    )

    try:

        chain = blockchain.get_certificate(
            certificate_id.strip()
        )

    except Exception as exc:

        raise HTTPException(
            status_code=503,
            detail=(
                f"Blockchain unavailable: {exc}"
            )
        )

    if not chain["exists"]:

        return CertificateVerifyResponse(

            valid=False,

            status="NOT_FOUND",

            message=(
                "No on-chain certificate record "
                "exists for this ID."
            ),

            certificate_id=certificate_id,

            certificate_hash=file_hash,
        )

    if chain["revoked"]:

        return CertificateVerifyResponse(

            valid=False,

            status="REVOKED",

            message=(
                "This certificate has been revoked "
                "by the contract owner."
            ),

            certificate_id=certificate_id,

            certificate_hash=file_hash,

            blockchain_hash=(
                chain["certificate_hash"]
            ),

            issuer_address=(
                chain["issuer_address"]
            ),

            timestamp=(
                chain["timestamp"]
            ),
        )

    valid = (
        file_hash.lower()
        == chain["certificate_hash"].lower()
    )

    return CertificateVerifyResponse(

        valid=valid,

        status=(
            "AUTHENTIC"
            if valid
            else "HASH_MISMATCH"
        ),

        message=(

            "The uploaded file matches the "
            "SHA-256 hash registered on-chain."

            if valid

            else

            "The certificate ID exists, but the "
            "uploaded file does not match the "
            "on-chain SHA-256 hash."
        ),

        certificate_id=certificate_id,

        certificate_hash=file_hash,

        blockchain_hash=(
            chain["certificate_hash"]
        ),

        issuer_address=(
            chain["issuer_address"]
        ),

        timestamp=(
            chain["timestamp"]
        ),
    )


@router.get(
    "/{certificate_id}",
    response_model=CertificateDetailsResponse
)
def get_certificate_details(

    certificate_id: str,

    db: Session = Depends(get_db),
):

    certificate = db.scalar(
        select(Certificate).where(
            Certificate.certificate_id
            == certificate_id
        )
    )

    if not certificate:

        raise HTTPException(
            status_code=404,
            detail="Certificate not found"
        )

    return certificate