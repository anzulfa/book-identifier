import httpx

_BASE_URL = "https://openlibrary.org/search.json"


async def search_open_library(title: str, author: str = "") -> dict | None:
    params: dict = {"title": title, "limit": 1}
    if author:
        params["author"] = author

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(_BASE_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    docs = data.get("docs")
    if not docs:
        return None

    doc = docs[0]

    cover_id = doc.get("cover_i")
    cover_url = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg" if cover_id else None

    year = str(doc["first_publish_year"]) if doc.get("first_publish_year") else ""
    ol_key = doc.get("key", "")

    return {
        "title": doc.get("title", ""),
        "author": ", ".join(doc.get("author_name", [])),
        "year": year,
        "description": "",
        "cover_image_url": cover_url,
        "google_rating": None,
        "google_ratings_count": None,
        "categories": doc.get("subject", [])[:5],
        "source_url": f"https://openlibrary.org{ol_key}" if ol_key else None,
    }
