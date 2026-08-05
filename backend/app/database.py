from app.utils.time import utc_now
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from datetime import datetime

client: AsyncIOMotorClient = None
logger = logging.getLogger(__name__)


async def connect_db():
    """Initialize MongoDB connection."""
    global client
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    # Create indexes on startup
    db = client[settings.DB_NAME]
    await db.users.create_index("email", unique=True)
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("reset_token", sparse=True)
    await db.users.create_index("verification_token", sparse=True)
    await db.medicines.create_index("name")
    await db.medicines.create_index("category")
    await db.medicines.create_index([("price", 1)])
    # Backfill legacy catalog items so existing carts remain checkout-compatible.
    await db.medicines.update_many(
        {"$or": [{"weight_grams": {"$exists": False}}, {"weight_grams": {"$lte": 0}}]},
        {"$set": {"weight_grams": 100}},
    )
    await db.orders.create_index("user_id")
    await db.orders.create_index("status")
    tracking_indexes = await db.orders.index_information()
    tracking_index = tracking_indexes.get("tracking_number_1")
    tracking_filter = {"tracking_number": {"$type": "string"}}
    if tracking_index and tracking_index.get("partialFilterExpression") != tracking_filter:
        await db.orders.drop_index("tracking_number_1")
    await db.orders.create_index(
        "tracking_number",
        unique=True,
        partialFilterExpression=tracking_filter,
    )
    await db.orders.update_many(
        {"delivery_status": {"$exists": False}},
        {"$set": {
            "parcel_weight": 0,
            "shipping_fee": 0.0,
            "courier_service": None,
            "tracking_number": None,
            "shipping_date": None,
            "delivery_status": "pending",
            "last_status_updated": None,
        }},
    )
    await db.orders.update_many(
        {"customer_confirmed_received": {"$exists": False}},
        {"$set": {
            "customer_confirmed_received": False,
            "customer_received_at": None,
            "customer_reported_not_received": False,
            "not_received_reported_at": None,
        }},
    )
    await db.orders.update_many(
        {"customer_reported_not_received": {"$exists": False}},
        {"$set": {
            "customer_reported_not_received": False,
            "not_received_reported_at": None,
        }},
    )
    cart_indexes = await db.carts.index_information()
    if "userId_1" in cart_indexes:
        await db.carts.drop_index("userId_1")
    await db.carts.create_index("user_id", unique=True)
    await db.prescriptions.create_index("user_id")
    review_indexes = await db.reviews.index_information()
    # Older versions stored the reviewer as `userId`. That obsolete index
    # treats every current `user_id` review as null and rejects valid reviews.
    for index_name, index_spec in review_indexes.items():
        index_keys = dict(index_spec.get("key", []))
        if index_name != "_id_" and "userId" in index_keys:
            await db.reviews.drop_index(index_name)
    await db.reviews.create_index("medicine_id")
    await db.reviews.create_index([("rating", -1)])
    await db.reviews.create_index(
        [("medicine_id", 1), ("user_id", 1), ("order_id", 1)],
        unique=True,
        name="unique_order_item_review",
    )
    await db.newsletter_subscribers.create_index("email", unique=True)
    await db.newsletter_subscribers.create_index([("subscribed_at", -1)])
    await db.support_messages.create_index([("status", 1), ("created_at", -1)])
    await db.support_messages.create_index("email")
    # Financial ledger indexes (MongoDB is the single source of truth).
    await db.sellers.create_index("user_id", unique=True)
    await db.sellers.create_index("email", unique=True)
    await db.seller_bank_accounts.create_index("seller_id", unique=True)
    await db.wishlists.create_index([("user_id", 1), ("medicine_id", 1)], unique=True)
    await db.wishlists.create_index([("user_id", 1), ("created_at", -1)])
    await db.financial_orders.create_index("order_id", unique=True)
    await db.financial_orders.create_index("customer_id")
    await db.seller_order_allocations.create_index([("order_id", 1), ("seller_id", 1)], unique=True)
    await db.seller_customer_preferences.create_index(
        [("seller_user_id", 1), ("customer_user_id", 1)], unique=True
    )
    await db.payments.create_index("order_id", unique=True)
    # Only real gateway references are unique. Pending payments intentionally
    # have no transaction_id, so null/missing values must not enter this index.
    transaction_index = await db.payments.index_information()
    existing_transaction_index = transaction_index.get("transaction_id_1")
    desired_filter = {"transaction_id": {"$type": "string"}}
    if existing_transaction_index and existing_transaction_index.get("partialFilterExpression") != desired_filter:
        await db.payments.drop_index("transaction_id_1")
    await db.payments.create_index(
        "transaction_id", unique=True,
        partialFilterExpression=desired_filter,
    )
    await db.payments.create_index(
        "stripe_event_id", unique=True,
        partialFilterExpression={"stripe_event_id": {"$type": "string"}},
    )
    await db.payouts.create_index("allocation_id", unique=True)
    await db.payouts.create_index([("order_id", 1), ("seller_id", 1)], unique=True)
    await db.payouts.create_index(
        [("stripe_checkout_session_id", 1), ("seller_id", 1)],
        unique=True,
        partialFilterExpression={"stripe_checkout_session_id": {"$type": "string"}},
    )
    await db.payouts.create_index([("seller_id", 1), ("status", 1)])
    await db.payout_attempts.create_index([("payout_id", 1), ("attempt_number", 1)], unique=True)
    commission_indexes = await db.commission_settings.index_information()
    for index_name, index_spec in commission_indexes.items():
        index_keys = dict(index_spec.get("key", []))
        if (
            index_name != "_id_"
            and index_spec.get("unique")
            and {"scope", "targetId"}.issubset(index_keys)
        ):
            # Obsolete schema: missing fields were indexed as (null, null),
            # preventing the append-only commission history used now.
            await db.commission_settings.drop_index(index_name)
    await db.commission_settings.create_index("effective_from")
    await db.audit_logs.create_index([("entity_type", 1), ("entity_id", 1)])
    await db.delivery_staff.create_index("user_id", unique=True)
    await db.delivery_staff.create_index([("status", 1), ("is_active", 1)])
    await db.delivery_locations.create_index("staff_id", unique=True)
    await db.delivery_locations.create_index("order_id")
    await db.courier_locations.create_index("courier_user_id", unique=True)
    await db.courier_locations.create_index("order_id")
    await db.courier_locations.create_index([("order_id", 1), ("updated_at", -1)])
    await db.delivery_history.create_index([("order_id", 1), ("created_at", 1)])
    await db.seller_fulfillments.create_index([("order_id", 1), ("seller_user_id", 1)], unique=True)
    await db.seller_fulfillments.create_index([("seller_user_id", 1), ("status", 1)])
    await db.service_areas.create_index("name", unique=True)
    if not await db.service_areas.find_one({}):
        await db.service_areas.insert_one({"name": settings.INITIAL_SERVICE_AREA_NAME,
            "accepted_names": settings.INITIAL_SERVICE_AREA_ALIASES, "bbox": None, "polygon": None,
            "center_latitude": settings.INITIAL_SERVICE_AREA_LATITUDE,
            "center_longitude": settings.INITIAL_SERVICE_AREA_LONGITUDE,
            "is_active": True, "created_at": utc_now(), "updated_at": utc_now()})
    await db.service_areas.update_many({"center_latitude": {"$exists": False}}, {"$set": {
        "center_latitude": settings.INITIAL_SERVICE_AREA_LATITUDE,
        "center_longitude": settings.INITIAL_SERVICE_AREA_LONGITUDE}})
    active_area = await db.service_areas.find_one({"is_active": True})
    # Legacy demo sellers existed before location-aware checkout. Backfill only
    # those known demo profiles; real sellers must provide their actual pin.
    await db.sellers.update_many({"email": {"$regex": r"@herbalhub\.in$", "$options": "i"},
        "approval_status": "APPROVED", "$or": [{"latitude": None}, {"service_area_id": None}]}, {"$set": {
        "latitude": settings.INITIAL_SERVICE_AREA_LATITUDE, "longitude": settings.INITIAL_SERVICE_AREA_LONGITUDE,
        "service_area_id": str(active_area["_id"]), "updated_at": utc_now()}})
    from app.utils.helpers import hash_password
    now = utc_now()
    demo_accounts = [
        {"name": "Herbal Hub Admin", "email": "admin@herbalhub.com", "phone": "0700000001", "password": "Admin@123", "role": "admin"},
        {"name": "Demo Seller", "email": "seller@herbalhub.com", "phone": "0700000002", "password": "Seller@123", "role": "seller",
         "business_name": "Herbal Hub Demo Store", "store_name": "Herbal Hub Demo Store"},
        {"name": "Demo Customer", "email": "customer@herbalhub.com", "phone": "0700000003", "password": "Customer@123", "role": "customer"},
    ]
    for account in demo_accounts:
        if await db.users.find_one({"email": account["email"]}):
            continue
        password = account.pop("password")
        result = await db.users.insert_one({**account, "password": hash_password(password), "is_active": True,
            "email_verified": True, "address": None, "profile_image": None, "created_at": now, "updated_at": now})
        if account["role"] == "seller" and not await db.sellers.find_one({"user_id": str(result.inserted_id)}):
            area = await db.service_areas.find_one({"is_active": True})
            await db.sellers.insert_one({"user_id": str(result.inserted_id), "name": account["name"],
                "email": account["email"], "phone": account["phone"], "business_name": account["business_name"],
                "store_name": account["store_name"], "address": {"address_line1": "Kilinochchi Town"},
                "latitude": settings.INITIAL_SERVICE_AREA_LATITUDE, "longitude": settings.INITIAL_SERVICE_AREA_LONGITUDE,
                "service_area_id": str(area["_id"]), "approval_status": "APPROVED", "created_at": now, "updated_at": now})
    logger.info("Connected to MongoDB")


async def disconnect_db():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")


def get_db():
    """Get database instance."""
    return client[settings.DB_NAME]
