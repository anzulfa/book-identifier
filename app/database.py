from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, JSON
from datetime import datetime, timezone
import os

DATABASE_URL = os.environ["DATABASE_URL"]

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
    source_urls = Column(JSON)
    cached_at = Column(DateTime, default=datetime.utcnow)


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    identity_key = Column(String, index=True, nullable=False)  # "device:<id>" or "user:<id>"
    date = Column(String, nullable=False)  # YYYY-MM-DD
    lookup_count = Column(Integer, default=0)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
