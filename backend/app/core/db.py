from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=settings.env == "development")
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Lightweight migrations — add missing columns to existing tables
    _migrations = [
        ("tasks", "github_status", "NVARCHAR(30) DEFAULT 'open'"),
    ]
    async with engine.begin() as conn:
        for table, column, col_type in _migrations:
            try:
                await conn.execute(text(
                    f"ALTER TABLE {table} ADD {column} {col_type}"
                ))
            except Exception:
                pass  # column already exists

    # Cleanup orphaned runs from previous server crashes
    async with engine.begin() as conn:
        await conn.execute(text(
            "UPDATE runs SET status = 'interrupted', error = 'Server restarted while running' "
            "WHERE status IN ('running', 'awaiting_gate')"
        ))
        await conn.execute(text(
            "UPDATE tasks SET status = 'error' "
            "WHERE status IN ('in_progress', 'ready', 'in_review') "
            "AND run_id IN (SELECT id FROM runs WHERE status = 'interrupted')"
        ))
