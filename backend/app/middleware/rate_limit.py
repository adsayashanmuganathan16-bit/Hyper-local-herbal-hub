from fastapi import HTTPException, Request
from redis.asyncio import from_url
from redis.exceptions import RedisError

from app.config import settings


def limiter(bucket: str, limit: int, window_seconds: int):
    async def enforce(request: Request):
        client = from_url(settings.REDIS_URL, decode_responses=True)
        identity = request.client.host if request.client else "unknown"
        key = f"rate:{bucket}:{identity}"
        try:
            count = await client.incr(key)
            if count == 1:
                await client.expire(key, window_seconds)
            if count > limit:
                raise HTTPException(429, "Too many requests")
        except RedisError:
            # Availability fallback: gateway signature and idempotency checks still protect money movement.
            return
        finally:
            await client.aclose()
    return enforce


payment_request_limit = limiter("payment-request", 10, 60)
payment_webhook_limit = limiter("payment-webhook", 120, 60)
