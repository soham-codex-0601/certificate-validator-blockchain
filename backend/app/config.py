from functools import lru_cache
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CertiChain API"
    environment: str = "development"
    debug: bool = False

    database_url: str = "sqlite:///./certichain.db"
    jwt_secret_key: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    cors_origins: str = "http://127.0.0.1:5500,http://localhost:5500"

    max_upload_size: int = 10 * 1024 * 1024
    upload_dir: str = "./uploads"

    blockchain_enabled: bool = False
    blockchain_rpc_url: str = ""
    blockchain_contract_address: str = ""
    issuer_private_key: str = ""
    blockchain_chain_id: int | None = None

    allow_public_issuer_registration: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        value = value.lower()
        if value not in {"development", "staging", "production"}:
            raise ValueError("environment must be development, staging, or production")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
