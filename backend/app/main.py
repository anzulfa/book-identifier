from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from app.auth import (
    TokenRequest,
    authenticate_email_user,
    create_access_token,
    create_email_user,
    get_current_identity,
    get_or_create_google_user,
)
from app.database import AsyncSessionLocal, init_db
from app.rate_limit import check_and_increment
from app.services.book_pipeline import get_book_data
from app.services.claude_vision import extract_title_from_image
from app.services.google_oauth import get_google_user_info


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


class EmailAuthRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    access_token: str


# ---------- Routes ----------


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/auth/token")
async def create_token(body: TokenRequest):
    import os
    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "changeme")
    if body.username != admin_user or body.password != admin_pass:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(sub=body.username, is_premium=True)
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/auth/register")
async def register(body: EmailAuthRequest):
    async with AsyncSessionLocal() as session:
        user = await create_email_user(session, body.email, body.password, body.name)
        token = create_access_token(sub=user.email, user_id=user.id, is_premium=user.is_premium, name=user.name)
        return {"access_token": token, "token_type": "bearer", "email": user.email, "name": user.name, "is_premium": user.is_premium}


@app.post("/api/auth/login")
async def login(body: EmailAuthRequest):
    async with AsyncSessionLocal() as session:
        user = await authenticate_email_user(session, body.email, body.password)
        token = create_access_token(sub=user.email, user_id=user.id, is_premium=user.is_premium, name=user.name)
        return {"access_token": token, "token_type": "bearer", "email": user.email, "name": user.name, "is_premium": user.is_premium}


@app.post("/api/auth/google")
async def google_auth(body: GoogleAuthRequest):
    try:
        info = await get_google_user_info(body.access_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google access token.")
    async with AsyncSessionLocal() as session:
        user = await get_or_create_google_user(
            session,
            google_id=info["sub"],
            email=info["email"],
            name=info.get("name"),
            picture=info.get("picture"),
        )
        token = create_access_token(sub=user.email, user_id=user.id, is_premium=user.is_premium, name=user.name)
        return {
            "access_token": token,
            "token_type": "bearer",
            "email": user.email,
            "name": user.name,
            "picture": user.picture_url,
            "is_premium": user.is_premium,
        }


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
