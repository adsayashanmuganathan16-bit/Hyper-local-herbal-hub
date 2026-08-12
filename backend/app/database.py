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
    logger.info("Connecting to MongoDB database '%s'...", settings.DB_NAME)
    new_client = None
    try:
        new_client = AsyncIOMotorClient(settings.MONGODB_URI)
        # Force a network round trip. Creating Motor's client alone does not
        # establish a connection, so without this ping a misleading startup
        # message could be printed while MongoDB is unavailable.
        await new_client.admin.command("ping")
    except Exception as exc:
        logger.error("MongoDB connection failed: %s", exc)
        if new_client:
            new_client.close()
        client = None
        raise

    client = new_client
    logger.info("MongoDB connected successfully (database: %s)", settings.DB_NAME)
    # Create indexes on startup
    db = client[settings.DB_NAME]
    await db.users.create_index("email", unique=True)
    # OAuth accounts do not have a phone number until profile completion.
    # A non-sparse unique index treats every missing phone as the same null
    # value, allowing only one such account, so migrate the legacy index.
    user_indexes = await db.users.index_information()
    phone_index = user_indexes.get("phone_1")
    if phone_index and not phone_index.get("sparse"):
        await db.users.drop_index("phone_1")
    await db.users.create_index("phone", unique=True, sparse=True)
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
    await db.user_bank_accounts.create_index("user_id", unique=True)
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
    # Legacy manual payouts may legitimately reuse a bank reference. New
    # application-generated PAY-* references use a dedicated unique field so
    # existing financial history never prevents startup migrations.
    await db.payouts.create_index(
        "payout_reference", unique=True,
        partialFilterExpression={"payout_reference": {"$type": "string"}},
    )
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
    admin_account = {"name": "Adsaya Shanmuganathan", "email": "herbalhub@gmail.com",
                     "phone": "0700000001", "password": "Admin@2006", "role": "admin"}
    existing_admin = await db.users.find_one({"email": admin_account["email"]})
    if not existing_admin:
        existing_admin = await db.users.find_one({"role": "admin"})
    if existing_admin:
        await db.users.update_one({"_id": existing_admin["_id"]}, {"$set": {
            "name": admin_account["name"], "email": admin_account["email"],
            "password": hash_password(admin_account["password"]), "role": "admin",
            "is_active": True, "email_verified": True, "updated_at": now,
        }})
    else:
        await db.users.insert_one({**admin_account, "password": hash_password(admin_account["password"]),
            "is_active": True, "email_verified": True, "address": None, "profile_image": None,
            "created_at": now, "updated_at": now})
    logger.info("MongoDB startup initialization completed")


async def disconnect_db():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")


def get_db():
    """Get database instance."""
    return client[settings.DB_NAME]
