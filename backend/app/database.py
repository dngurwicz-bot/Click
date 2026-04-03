from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.exc import InterfaceError, OperationalError
from typing import AsyncGenerator
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=300,  # recycle connections every 5 min
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except (InterfaceError, OperationalError):
            # Stale connection — invalidate pool and retry once
            await session.rollback()
            await engine.dispose()
            raise
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
