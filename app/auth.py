import os
from fastapi import Header, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel

JWT_SECRET = os.environ["JWT_SECRET"]
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7

security = HTTPBearer(auto_error=False)


class TokenRequest(BaseModel):
    username: str
    password: str  # In production, verify against a real user store


def create_access_token(sub: str, is_free_tier: bool = True) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": sub, "exp": expire, "is_free_tier": is_free_tier}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


async def get_current_identity(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_device_id: str = Header(None),
) -> dict:
    """
    Returns {"type": "user"|"device", "id": str, "is_free_tier": bool}.
    Accepts a Bearer JWT token or an X-Device-ID header (free tier, no signup).
    """
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[ALGORITHM])
            return {
                "type": "user",
                "id": payload["sub"],
                "is_free_tier": payload.get("is_free_tier", True),
            }
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

    if x_device_id:
        return {"type": "device", "id": x_device_id, "is_free_tier": True}

    raise HTTPException(
        status_code=401,
        detail="Authentication required: provide Authorization: Bearer <token> or X-Device-ID header",
    )
