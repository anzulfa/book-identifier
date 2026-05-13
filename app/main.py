from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.auth import TokenRequest, create_access_token, get_current_identity
from app.database import init_db
from app.rate_limit import check_and_increment
from app.services.book_pipeline import get_book_data
from app.services.claude_vision import extract_title_from_image


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Book Identifier API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Request / Response schemas ----------


class ExtractTitleRequest(BaseModel):
    image_base64: str


class LookupRequest(BaseModel):
    image_base64: Optional[str] = None
    title: Optional[str] = None
    author: Optional[str] = None


# ---------- Routes ----------


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/auth/token")
async def create_token(body: TokenRequest):
    """
    Issues a JWT. Replace the stub credential check with a real user store
    before deploying to production.
    """
    import os

    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "changeme")

    if body.username != admin_user or body.password != admin_pass:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(sub=body.username, is_free_tier=False)
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/extract-title")
async def extract_title(
    request: ExtractTitleRequest,
    identity: dict = Depends(get_current_identity),
):
    await check_and_increment(identity)
    try:
        return await extract_title_from_image(request.image_base64)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Vision extraction failed: {exc}")


@app.post("/api/lookup")
async def lookup_book(
    request: LookupRequest,
    identity: dict = Depends(get_current_identity),
):
    await check_and_increment(identity)

    title = request.title
    author = request.author or ""

    if request.image_base64 and not title:
        try:
            extracted = await extract_title_from_image(request.image_base64)
            title = extracted.get("title", "")
            author = extracted.get("author", "") or author
        except Exception as exc:
            raise HTTPException(
                status_code=422, detail=f"Could not extract book title from image: {exc}"
            )

    if not title:
        raise HTTPException(
            status_code=422, detail="Provide either image_base64 or title"
        )

    book = await get_book_data(title, author)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    return book
