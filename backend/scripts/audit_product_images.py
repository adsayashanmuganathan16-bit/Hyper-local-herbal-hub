#!/usr/bin/env python3
"""Report whether product image records resolve to existing S3 objects."""

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env", override=True)

from app.config import settings  # noqa: E402
from app.services.s3_service import s3_service  # noqa: E402


async def audit() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        database = client[settings.DB_NAME]
        products = await database.medicines.find(
            {},
            {"name": 1, "images": 1, "image": 1, "image_url": 1, "imageUrl": 1},
        ).to_list(length=None)
        print(f"products: {len(products)}")
        for product in products:
            urls = product.get("images") or [
                product.get("image")
                or product.get("image_url")
                or product.get("imageUrl")
            ]
            url = next((value for value in urls if value), None)
            field = "images" if product.get("images") else "legacy" if url else "missing"
            result = "external_or_missing"
            if url and s3_service.is_bucket_object_url(url):
                key = s3_service.object_key(url)
                try:
                    s3_service.s3_client.head_object(
                        Bucket=s3_service.bucket_name,
                        Key=key,
                    )
                    result = "true"
                except Exception:
                    result = "false"
            print(f"{product.get('name')}: field={field}, s3_exists={result}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(audit())
