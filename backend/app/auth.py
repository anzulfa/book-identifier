import os
from fastapi import Header, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import User

JWT_SECRET = os.environ["JWT_SECRET"]
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

security = HTTPBearer(auto_error=False)
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenRequest(BaseModel):
    username: str
    password: str


# ---------- Password helpers ----------

def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ---------- Token ----------

def create_access_token(sub: str, user_id: int | None = None, is_premium: bool = False, name: str | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": sub, "exp": expire, "is_premium": is_premium}
    if user_id is not None:
        payload["user_id"] = user_id
    if name:
        payload["name"] = name
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


# ---------- User DB helpers ----------

async def get_or_create_google_user(session: AsyncSession, google_id: str, email: str, name: str | None, picture: str | None) -> User:
    result = await session.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()
    if user:
        user.name = name
        user.picture_url = picture
        await session.commit()
        return user
    # Check if email already exists (linked to a password account)
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        user.google_id = google_id
        user.picture_url = picture
        if name:
            user.name = name
        await session.commit()
        return user
    user = User(email=email, name=name, google_id=google_id, picture_url=picture)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def create_email_user(session: AsyncSession, email: str, password: str, name: str | None = None) -> User:
    result = await session.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(email=email, name=name, hashed_password=hash_password(password))
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def authenticate_email_user(session: AsyncSession, email: str, password: str) -> User:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return user


# ---------- Identity ----------

async def get_current_identity(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_device_id: str = Header(None),
) -> dict:
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[ALGORITHM])
            user_id = payload.get("user_id")
            if user_id is not None:
                return {
                    "type": "user",
                    "id": user_id,
                    "is_premium": payload.get("is_premium", False),
                }
            return {
                "type": "user",
                "id": payload["sub"],
                "is_premium": payload.get("is_premium", False),
            }
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

    if x_device_id:
        return {"type": "device", "id": x_device_id, "is_premium": False}

    raise HTTPException(
        status_code=401,
        detail="Authentication required: provide Authorization: Bearer <token> or X-Device-ID header",
    )
