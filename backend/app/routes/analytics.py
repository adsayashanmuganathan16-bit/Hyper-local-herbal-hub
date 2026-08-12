from app.utils.time import utc_now
from fastapi import APIRouter, Depends, Query
from datetime import datetime, timedelta
from app.database import get_db
from app.middleware.auth_middleware import require_admin

router = APIRouter(prefix="/api/analytics", tags=["Reports & Analytics"])


@router.get("/sales")
async def get_sales_analytics(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: dict = Depends(require_admin),
):
    """Get sales analytics for a time period."""
    db = get_db()

    period_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = period_map.get(period, 30)
    start_date = utc_now() - timedelta(days=days)
    paid_period_match = {"created_at": {"$gte": start_date}, "payment_status": "completed"}
    date_format = "%Y-%m" if period == "1y" else "%Y-%m-%d"

    # Daily sales
    pipeline = [
        {"$match": paid_period_match},
        {"$group": {
            "_id": {"$dateToString": {"format": date_format, "date": "$created_at"}},
            "revenue": {"$sum": "$final_amount"},
            "orders": {"$sum": 1},
            "items_sold": {"$sum": {"$sum": "$items.quantity"}},
        }},
        {"$sort": {"_id": 1}},
    ]
    daily_sales = await db.orders.aggregate(pipeline).to_list(length=None)

    summary_rows = await db.orders.aggregate([
        {"$match": paid_period_match},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$final_amount"},
                     "total_orders": {"$sum": 1},
                     "items_sold": {"$sum": {"$sum": "$items.quantity"}}}},
    ]).to_list(length=1)
    summary = summary_rows[0] if summary_rows else {
        "total_revenue": 0, "total_orders": 0, "items_sold": 0,
    }
    summary.pop("_id", None)
    summary["average_order_value"] = (
        summary["total_revenue"] / summary["total_orders"] if summary["total_orders"] else 0
    )

    # Top selling medicines
    top_medicines_pipeline = [
        {"$match": paid_period_match},
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

    order_status = await db.orders.aggregate([
        {"$match": paid_period_match},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(length=None)

    # Category distribution
    category_pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    category_dist = await db.medicines.aggregate(category_pipeline).to_list(length=None)

    return {
        "period": period,
        "summary": summary,
        "daily_sales": daily_sales,
        "top_medicines": top_medicines,
        "category_distribution": category_dist,
        "order_status": order_status,
    }


@router.get("/users")
async def get_user_analytics(current_user: dict = Depends(require_admin)):
    """Get user analytics."""
    db = get_db()

    # User growth over last 6 months
    six_months_ago = utc_now() - timedelta(days=180)
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

    total_users = sum(role_dist.values())
    active_users = await db.users.count_documents({"is_active": True})
    new_users = await db.users.count_documents({"created_at": {"$gte": six_months_ago}})
    return {"user_growth": user_growth, "role_distribution": role_dist,
            "summary": {"total_users": total_users, "active_users": active_users,
                        "new_users_6_months": new_users}}


@router.get("/export/orders")
async def export_orders(
    format: str = Query("json", pattern="^(json|csv)$"),
    current_user: dict = Depends(require_admin),
):
    """Export orders data."""
    db = get_db()
    cursor = db.orders.find().sort([("created_at", -1)])
    orders = await cursor.to_list(length=None)

    from app.utils.helpers import serialize_doc
    orders = [serialize_doc(o) for o in orders]

    if format == "csv":
        import io, csv, json
        output = io.StringIO()
        if orders:
            fieldnames = sorted({key for order in orders for key in order})
            writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows({key: json.dumps(value, default=str) if isinstance(value, (dict, list)) else value
                              for key, value in order.items()} for order in orders)
        return {"format": "csv", "data": output.getvalue()}

    return {"format": "json", "data": orders, "total": len(orders)}
