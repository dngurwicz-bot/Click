import pytest

from app.config import Settings


def test_production_settings_reject_default_jwt_secret():
    with pytest.raises(ValueError):
        Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql+asyncpg://prod-user:secret@db:5432/click",
            JWT_SECRET="change-me-in-production-min-32-chars!!",  # force the default value
        )


def test_production_settings_accept_overrides():
    settings = Settings(
        APP_ENV="production",
        DATABASE_URL="postgresql+asyncpg://prod-user:secret@db:5432/click",
        JWT_SECRET="super-secret-production-key-1234567890",
    )

    assert settings.APP_ENV == "production"
