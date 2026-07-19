from fastapi import APIRouter, Depends, Query
from datetime import datetime, timedelta
from app.database import get_db
from app.middleware.auth_middleware import require_admin

router = APIRouter(prefix="/api/analytics", tags=["Reports & Analytics"])


@router.get("/sales")
async def get_sales_analytics(
    period: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    current_user: dict = Depends(require_admin),
):
    """Get sales analytics for a time period."""
    db = get_db()

    period_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = period_map.get(period, 30)
    start_date = datetime.utcnow() - timedelta(days=days)

    # Daily sales
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}, "payment_status": "completed"}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "revenue": {"$sum": "$final_amount"},
            "orders": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    daily_sales = await db.orders.aggregate(pipeline).to_list(length=None)

    # Top selling medicines
    top_medicines_pipeline = [
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.medicine_id",
            "name": {"$first": "$items.name"},
            "total_sold": {"$sum": "$items.quantity"},
            "revenue": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}},
        }},
        {"$sort": {"total_sold": -1}},
        {"$limit": 10},
    ]
    top_medicines = await db.orders.aggregate(top_medicines_pipeline).to_list(length=None)

    # Category distribution
    category_pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    category_dist = await db.medicines.aggregate(category_pipeline).to_list(length=None)

    return {
        "period": period,
        "daily_sales": daily_sales,
        "top_medicines": top_medicines,
        "category_distribution": category_dist,
    }


@router.get("/users")
async def get_user_analytics(current_user: dict = Depends(require_admin)):
    """Get user analytics."""
    db = get_db()

    # User growth over last 6 months
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    pipeline = [
        {"$match": {"created_at": {"$gte": six_months_ago}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    user_growth = await db.users.aggregate(pipeline).to_list(length=None)

    # User role distribution
    role_pipeline = [
        {"$group": {"_id": "$role", "count": {"$sum": 1}}},
    ]
    role_dist = {doc["_id"]: doc["count"] for doc in await db.users.aggregate(role_pipeline).to_list(length=None)}

    return {"user_growth": user_growth, "role_distribution": role_dist}


@router.get("/export/orders")
async def export_orders(
    format: str = Query("json", regex="^(json|csv)$"),
    current_user: dict = Depends(require_admin),
):
    """Export orders data."""
    db = get_db()
    cursor = db.orders.find().sort([("created_at", -1)])
    orders = await cursor.to_list(length=None)

    from app.utils.helpers import serialize_doc
    orders = [serialize_doc(o) for o in orders]

    if format == "csv":
        import io, csv
        output = io.StringIO()
        if orders:
            writer = csv.DictWriter(output, fieldnames=orders[0].keys())
            writer.writeheader()
            writer.writerows(orders)
        return {"format": "csv", "data": output.getvalue()}

    return {"format": "json", "data": orders, "total": len(orders)}
