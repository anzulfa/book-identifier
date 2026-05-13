import os
import httpx

GOOGLE_BOOKS_API_KEY = os.getenv("GOOGLE_BOOKS_API_KEY", "")
_BASE_URL = "https://www.googleapis.com/books/v1/volumes"


async def search_google_books(title: str, author: str = "") -> dict | None:
    query = f"intitle:{title}"
    if author:
        query += f"+inauthor:{author}"

    params: dict = {"q": query, "maxResults": 1, "printType": "books"}
    if GOOGLE_BOOKS_API_KEY:
        params["key"] = GOOGLE_BOOKS_API_KEY

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(_BASE_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    items = data.get("items")
    if not items:
        return None

    item = items[0]
    vol = item.get("volumeInfo", {})

    authors = vol.get("authors", [])
    published_date = vol.get("publishedDate", "")
    year = published_date[:4] if published_date else ""

    image_links = vol.get("imageLinks", {})
    thumbnail = image_links.get("thumbnail") or image_links.get("smallThumbnail")
    if thumbnail:
        thumbnail = thumbnail.replace("http://", "https://")

    book_id = item.get("id", "")

    return {
        "title": vol.get("title", ""),
        "author": ", ".join(authors),
        "year": year,
        "description": vol.get("description", ""),
        "cover_image_url": thumbnail,
        "google_rating": vol.get("averageRating"),
        "google_ratings_count": vol.get("ratingsCount"),
        "categories": vol.get("categories", []),
        "source_url": f"https://books.google.com/books?id={book_id}" if book_id else None,
    }
