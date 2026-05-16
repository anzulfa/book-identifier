import os
from datetime import date
from fastapi import HTTPException
import redis.asyncio as aioredis

REDIS_URL = os.environ["REDIS_URL"]
FREE_TIER_DAILY_LIMIT = 2

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis


async def check_and_increment(identity: dict) -> int:
    """
    Increments today's usage counter. Returns remaining lookups.
    Raises HTTP 429 when the free-tier daily limit is exceeded.
    Paid users (is_free_tier=False) are always allowed through.
    """
    if identity.get("is_premium"):
        return -1  # unlimited

    redis = await get_redis()
    today = date.today().isoformat()
    if identity["type"] == "user":
        key = f"rl:user:{identity['id']}:{today}"
    else:
        key = f"rl:device:{identity['id']}:{today}"

    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 86400)

    if count > FREE_TIER_DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Free tier daily limit of {FREE_TIER_DAILY_LIMIT} lookups reached. Try again tomorrow or subscribe to premium.",
        )

    return FREE_TIER_DAILY_LIMIT - count
