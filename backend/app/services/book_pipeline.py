import re
import string
from datetime import datetime

from sqlalchemy import select

from app.database import AsyncSessionLocal, BookCache
from app.services.goodreads import search_goodreads
from app.services.summarize import summarize_book_content

_CACHE_TTL_DAYS = 30


def normalize_title(title: str) -> str:
    title = title.lower().strip()
    title = title.translate(str.maketrans("", "", string.punctuation))
    return re.sub(r"\s+", " ", title)


def _is_fresh(cached_at: datetime) -> bool:
    return (datetime.utcnow() - cached_at.replace(tzinfo=None)).days < _CACHE_TTL_DAYS


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
                "reviews_summary": row.reviews_summary,
                "source_urls": row.source_urls or {},
            }

        cached_goodreads_id = row.goodreads_id if row else None

        try:
            goodreads_result = await search_goodreads(title, author, goodreads_id=cached_goodreads_id)
        except Exception:
            goodreads_result = None

        if not goodreads_result:
            return None

        description = goodreads_result.get("description", "")
        popular_reviews = goodreads_result.get("popular_reviews", [])
        plot_summary = ""
        reviews_summary = ""
        try:
            plot_summary, reviews_summary = await summarize_book_content(description, popular_reviews)
        except Exception:
            pass

        source_urls: dict = {}
        if goodreads_result.get("goodreads_id"):
            source_urls["goodreads"] = (
                f"https://www.goodreads.com/search?q={title.replace(' ', '+')}"
            )

        book = {
            "title": goodreads_result.get("title") or title,
            "author": goodreads_result.get("author") or author or "",
            "year": goodreads_result.get("year") or "",
            "cover_image_url": goodreads_result.get("cover_image_url"),
            "google_rating": None,
            "google_ratings_count": None,
            "goodreads_rating": goodreads_result.get("goodreads_rating"),
            "goodreads_ratings_count": goodreads_result.get("goodreads_ratings_count"),
            "genres": goodreads_result.get("genres") or [],
            "plot_summary": plot_summary,
            "reviews_summary": reviews_summary,
            "source_urls": source_urls,
            "goodreads_id": goodreads_result.get("goodreads_id"),
        }

        if row:
            for key, val in book.items():
                setattr(row, key, val)
            row.cached_at = datetime.utcnow()
        else:
            session.add(BookCache(normalized_title=normalized, **book))

        await session.commit()

        book.pop("goodreads_id", None)
        return book
