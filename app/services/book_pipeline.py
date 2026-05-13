import asyncio
import re
import string
from datetime import datetime

from sqlalchemy import select

from app.database import AsyncSessionLocal, BookCache
from app.services.google_books import search_google_books
from app.services.goodreads import search_goodreads
from app.services.open_library import search_open_library

_CACHE_TTL_DAYS = 30


def normalize_title(title: str) -> str:
    title = title.lower().strip()
    title = title.translate(str.maketrans("", "", string.punctuation))
    return re.sub(r"\s+", " ", title)


def _is_fresh(cached_at: datetime) -> bool:
    return (datetime.utcnow() - cached_at.replace(tzinfo=None)).days < _CACHE_TTL_DAYS


def _first_n_sentences(text: str, n: int) -> str:
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return " ".join(sentences[:n])


async def get_book_data(title: str, author: str = "") -> dict | None:
    normalized = normalize_title(title)

    async with AsyncSessionLocal() as session:
        row = (
            await session.execute(
                select(BookCache).where(BookCache.normalized_title == normalized)
            )
        ).scalar_one_or_none()

        if row and _is_fresh(row.cached_at):
            return {
                "title": row.title,
                "author": row.author,
                "year": row.year,
                "cover_image_url": row.cover_image_url,
                "google_rating": row.google_rating,
                "google_ratings_count": row.google_ratings_count,
                "goodreads_rating": row.goodreads_rating,
                "goodreads_ratings_count": row.goodreads_ratings_count,
                "genres": row.genres or [],
                "plot_summary": row.plot_summary,
                "source_urls": row.source_urls or {},
            }

        google_result, goodreads_result = await asyncio.gather(
            search_google_books(title, author),
            search_goodreads(title, author),
            return_exceptions=True,
        )

        if isinstance(google_result, Exception):
            google_result = None
        if isinstance(goodreads_result, Exception):
            goodreads_result = None

        if not google_result:
            try:
                google_result = await search_open_library(title, author)
            except Exception:
                google_result = None

        if not google_result and not goodreads_result:
            return None

        source_urls: dict = {}
        if google_result and google_result.get("source_url"):
            source_urls["google_books"] = google_result["source_url"]
        if goodreads_result:
            source_urls["goodreads"] = (
                f"https://www.goodreads.com/search?q={title.replace(' ', '+')}"
            )

        genres = (google_result or {}).get("categories") or []
        if not genres and goodreads_result:
            genres = goodreads_result.get("genres", [])

        description = (google_result or {}).get("description", "")
        plot_summary = _first_n_sentences(description, 3)

        book = {
            "title": (google_result or {}).get("title") or title,
            "author": (google_result or {}).get("author") or author or "",
            "year": (google_result or {}).get("year") or "",
            "cover_image_url": (google_result or {}).get("cover_image_url"),
            "google_rating": (google_result or {}).get("google_rating"),
            "google_ratings_count": (google_result or {}).get("google_ratings_count"),
            "goodreads_rating": (goodreads_result or {}).get("goodreads_rating"),
            "goodreads_ratings_count": (goodreads_result or {}).get("goodreads_ratings_count"),
            "genres": genres,
            "plot_summary": plot_summary,
            "source_urls": source_urls,
        }

        if row:
            for key, val in book.items():
                setattr(row, key, val)
            row.cached_at = datetime.utcnow()
        else:
            session.add(BookCache(normalized_title=normalized, **book))

        await session.commit()
        return book
