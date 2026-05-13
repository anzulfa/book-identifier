import os
import re
import httpx

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")
SEARLO_API_KEY = os.getenv("SEARLO_API_KEY", "")
_API_HOST = "goodreads-api-latest-updated.p.rapidapi.com"
_SEARLO_SEARCH_URL = "https://api.searlo.tech/api/v1/search/simple"

_http_client = httpx.AsyncClient(timeout=httpx.Timeout(10.0))


def _strip_series(title: str) -> str:
    return re.sub(r"\s*\(.*?\)\s*$", "", title).strip()


async def _get_goodreads_id_via_searlo(title: str, author: str = "") -> str | None:
    if not SEARLO_API_KEY:
        return None
    query = f"{title} {author} goodreads".strip()
    resp = await _http_client.get(
        _SEARLO_SEARCH_URL,
        params={"q": query, "limit": 3},
        headers={"X-API-Key": SEARLO_API_KEY},
    )
    if resp.status_code != 200:
        print(f"[goodreads] searlo search failed status={resp.status_code} body={resp.text[:200]!r}", flush=True)
        return None
    for item in resp.json().get("data", {}).get("organic", []):
        match = re.search(r"goodreads\.com/(?:[a-z]{2}/)?book/show/(\d+)", item.get("link", ""))
        if match:
            return match.group(1)
    short = _strip_series(title)
    if short != title:
        return await _get_goodreads_id_via_searlo(short, author)
    return None


async def _fetch_by_id(book_id: str) -> dict | None:
    if not RAPIDAPI_KEY:
        return None
    resp = await _http_client.get(
        f"https://{_API_HOST}/books/{book_id}",
        headers={"x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": _API_HOST},
        timeout=15.0,
    )
    if resp.status_code != 200:
        return None
    return resp.json()


async def get_goodreads_id(title: str, author: str = "") -> str | None:
    return await _get_goodreads_id_via_searlo(title, author)


async def search_goodreads(title: str, author: str = "", goodreads_id: str | None = None) -> dict | None:
    book_id = goodreads_id or await get_goodreads_id(title, author)
    if not book_id:
        return None

    data = await _fetch_by_id(book_id)
    if not data:
        return None

    year = ""
    pub_date = data.get("publicationDate", "") or ""
    year_match = re.search(r"\b(\d{4})\b", pub_date)
    if year_match:
        year = year_match.group(1)

    author_field = data.get("author", {})
    author_name = (
        author_field.get("name", "") if isinstance(author_field, dict) else str(author_field)
    )

    return {
        "goodreads_id": book_id,
        "title": data.get("title", ""),
        "author": author_name,
        "year": year,
        "cover_image_url": data.get("imageURL"),
        "goodreads_rating": data.get("rating"),
        "goodreads_ratings_count": data.get("ratings"),
        "genres": data.get("genres", []),
        "description": data.get("description", "") or "",
        "popular_reviews": data.get("popularReviews", []) or [],
    }
