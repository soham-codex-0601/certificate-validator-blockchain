from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class IssuerRegisterRequest(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=150
    )

    email: EmailStr

    password: str = Field(
        min_length=12,
        max_length=128
    )

    institution: str = Field(
        min_length=2,
        max_length=255
    )


class CertificatePrepareResponse(BaseModel):
    certificate_id: str
    certificate_hash: str
    status: str


class CertificateFinalizeRequest(BaseModel):
    transaction_hash: str = Field(
        min_length=66,
        max_length=66
    )


class CertificateIssueResponse(BaseModel):
    certificate_id: str
    certificate_hash: str
    transaction_hash: str
    issuer_address: str
    status: str


class CertificateVerifyResponse(BaseModel):
    valid: bool
    status: str
    message: str

    certificate_id: str | None = None

    certificate_hash: str | None = None

    blockchain_hash: str | None = None

    issuer_address: str | None = None

    transaction_hash: str | None = None

    timestamp: int | None = None


class CertificateDetailsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    certificate_id: str

    student_name: str

    certificate_type: str

    institution: str

    issuer_address: str | None

    transaction_hash: str | None

    issued_at: datetime

    is_revoked: bool