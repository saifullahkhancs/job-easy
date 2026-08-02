
from dataclasses import field
import os

from pydantic import Field, model_validator, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    DEBUG: bool = False
    ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "development")
    # It's crucial to set a strong, secret key in your environment.
    # You can generate one with: openssl rand -hex 32
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "dev-secret-change-me")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    PASSWORD_RESET_URL: str = os.environ.get(
        "PASSWORD_RESET_URL", "https://www.jobeasy.online/forgot-password"
    )
    # Public URL of the SPA, used to build links inside notification emails.
    FRONTEND_BASE_URL: str = os.environ.get(
        "FRONTEND_BASE_URL", "https://www.jobeasy.online"
    )
    # Extra recipients (comma separated) that should always receive the
    # "new approval request" notification, on top of the admins stored in DB.
    ADMIN_NOTIFICATION_EMAILS: str = os.environ.get("ADMIN_NOTIFICATION_EMAILS", "")
    BACKEND_CORS_ORIGINS: str | None = None

    # SMTP configuration for system emails (Resend)
    SMTP_HOST: str = Field("smtp.resend.com", env=["SMTP_HOST"])
    SMTP_PORT: int = Field(587, env=["SMTP_PORT"])
    SMTP_USERNAME: str = Field("resend", env=["SMTP_USERNAME"])
    SMTP_PASSWORD: str = Field("", env=["SMTP_PASSWORD"]) # Your Resend API key
    SMTP_FROM_EMAIL: str = Field("info@jobeasy.online", env=["SMTP_FROM_EMAIL"])
    SMTP_FROM_NAME: str = Field("Job Easy", env=["SMTP_FROM_NAME"])
    SMTP_USE_TLS: bool = Field(True, env=["SMTP_USE_TLS"])
    SMTP_USE_SSL: bool = Field(False, env=["SMTP_USE_SSL"])

    # Map Resend API key from the existing SMTP_PASSWORD env var for compatibility
    EMAIL_FROM: str = Field("info@jobeasy.online", env=["EMAIL_FROM"])
    EMAIL_FROM_NAME:str = Field("Job Easy", env=["EMAIL_FROM_NAME"])
    RESEND_API_KEY: str = Field("RESEND_API_KEY", env=["SMTP_PASSWORD"])
    # Rate limiting settings
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60  # seconds

    @field_validator("DATABASE_URL")
    @classmethod
    def clean_db_url(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().strip("'").strip('"')
        return v

    @model_validator(mode="after")
    def validate_jwt_secret(self):
        if self.ENVIRONMENT == "production" and self.JWT_SECRET in ["dev-secret-change-me", "change-me", "secret"]:
            raise ValueError("JWT_SECRET must be set to a strong random value in production")
        return self

    @property
    def admin_notification_emails(self) -> list[str]:
        """Static admin recipients configured via environment."""
        raw = self.ADMIN_NOTIFICATION_EMAILS or ""
        return [email.strip() for email in raw.split(",") if email.strip()]

    @property
    def cors_origins(self) -> list[str]:
        raw_origins = self.BACKEND_CORS_ORIGINS or os.environ.get("CORS_ORIGINS", "")
        return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
