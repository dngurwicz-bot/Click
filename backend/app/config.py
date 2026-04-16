from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/click_db"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_ANON_KEY: str = ""

    # JWT
    JWT_SECRET: str = "change-me-in-production-min-32-chars!!"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 480

    # App
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000"

    # Feature flags
    BILLING_ENABLED: bool = False

    # AI
    GEMINI_API_KEY: str = ""

    # Company / Issuer details (printed on invoice PDFs)
    COMPANY_NAME_HE: str = "חברת CLICK בע\"מ"
    COMPANY_NAME_EN: str = "CLICK Ltd."
    COMPANY_TAX_ID: str = ""
    COMPANY_ADDRESS: str = ""
    COMPANY_PHONE: str = ""
    COMPANY_EMAIL: str = ""

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.APP_ENV != "development":
            if self.JWT_SECRET == "change-me-in-production-min-32-chars!!":
                raise ValueError("JWT_SECRET must be overridden outside development")
            if self.DATABASE_URL == "postgresql+asyncpg://postgres:password@localhost:5432/click_db":
                raise ValueError("DATABASE_URL must be overridden outside development")
            if not self.SUPABASE_URL:
                raise ValueError("SUPABASE_URL must be set outside development")
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
