from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import Boolean, Column, String, Integer, Float, DateTime, Text, JSON, text, ForeignKey
from datetime import datetime, timezone
import os

DATABASE_URL = os.environ["DATABASE_URL"].replace(
    "postgresql://", "postgresql+asyncpg://", 1
).replace(
    "postgres://", "postgresql+asyncpg://", 1
)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class BookCache(Base):
    __tablename__ = "book_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    normalized_title = Column(String, unique=True, index=True, nullable=False)
    title = Column(String)
    author = Column(String)
    year = Column(String)
    cover_image_url = Column(String)
    google_rating = Column(Float)
    google_ratings_count = Column(Integer)
    goodreads_rating = Column(Float)
    goodreads_ratings_count = Column(Integer)
    genres = Column(JSON)
    plot_summary = Column(Text)
    reviews_summary = Column(Text)
    source_urls = Column(JSON)
    goodreads_id = Column(String)
    cached_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    name            = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    google_id       = Column(String, unique=True, index=True, nullable=True)
    picture_url     = Column(String, nullable=True)
    is_premium      = Column(Boolean, default=False, nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)


class BookHistory(Base):
    __tablename__ = "book_history"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    user_id          = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title            = Column(String, nullable=False)
    author           = Column(String, nullable=True)
    year             = Column(String, nullable=True)
    cover_image_url  = Column(String, nullable=True)
    goodreads_rating = Column(Float, nullable=True)
    google_rating    = Column(Float, nullable=True)
    genres           = Column(JSON, nullable=True)
    looked_up_at     = Column(DateTime, default=datetime.utcnow, nullable=False)


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    identity_key = Column(String, index=True, nullable=False)  # "device:<id>" or "user:<id>"
    date = Column(String, nullable=False)  # YYYY-MM-DD
    lookup_count = Column(Integer, default=0)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE"
        ))


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
