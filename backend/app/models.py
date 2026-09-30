from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(30), default="issuer", index=True)
    institution: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now
    )


class Certificate(Base):
    __tablename__ = "certificates"

    __table_args__ = (
        UniqueConstraint(
            "certificate_id",
            name="uq_certificate_id"
        ),
        UniqueConstraint(
            "certificate_hash",
            name="uq_certificate_hash"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    certificate_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True
    )

    student_name: Mapped[str] = mapped_column(
        String(150)
    )

    certificate_type: Mapped[str] = mapped_column(
        String(150)
    )

    institution: Mapped[str] = mapped_column(
        String(255)
    )

    file_name: Mapped[str] = mapped_column(
        String(255)
    )

    stored_file_key: Mapped[str] = mapped_column(
        String(255)
    )

    certificate_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True
    )

    issuer_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    # MetaMask wallet address
    issuer_address: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    # Sepolia transaction hash
    transaction_hash: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    blockchain_timestamp: Mapped[int | None] = mapped_column(
        nullable=True
    )

    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now
    )

    is_revoked: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )

    revocation_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )