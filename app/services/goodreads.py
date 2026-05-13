import os
import httpx

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")
_HOST = "goodreads-books-ratings-reviews-metadata.p.rapidapi.com"


async def search_goodreads(title: str, author: str = "") -> dict | None:
    if not RAPIDAPI_KEY:
        return None

    headers = {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": _HOST,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    body = {
        "title": title,
        "page": "1",
        "author": author or "",
        "language": "",
        "publisher": "",
        "year": "",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"https://{_HOST}/list", headers=headers, data=body)
        resp.raise_for_status()
        result = resp.json()

    books = result.get("result", {}).get("data", [])
    if not books:
        return None

    book = books[0]

    try:
        rating = float(book["average_rating"])
    except (KeyError, ValueError, TypeError):
        rating = None

    try:
        count = int(book["ratings_count"])
    except (KeyError, ValueError, TypeError):
        count = None

    return {
        "goodreads_rating": rating,
        "goodreads_ratings_count": count,
        "genres": [],
    }
