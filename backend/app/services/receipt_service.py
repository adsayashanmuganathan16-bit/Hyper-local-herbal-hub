from html import escape
from zoneinfo import ZoneInfo


SRI_LANKA = ZoneInfo("Asia/Colombo")


async def payout_receipt_context(db, payout: dict) -> dict:
    order = await db.orders.find_one({"_id": __import__("bson").ObjectId(payout["order_id"])})
    seller = await db.sellers.find_one({"_id": __import__("bson").ObjectId(payout["seller_id"])})
    return {"payout": payout, "order": order or {}, "seller": seller or {}}


def render_payout_receipt(context: dict) -> str:
    payout, order, seller = context["payout"], context["order"], context["seller"]
    created_at = payout.get("created_at")
    paid_at = payout.get("paid_at")
    local_text = lambda value: value.replace(tzinfo=ZoneInfo("UTC")).astimezone(SRI_LANKA).strftime("%d %b %Y, %I:%M %p") if value else "—"
    value = lambda key: f"LKR {float(payout.get(key, 0)):,.2f}"
    delivery = f"LKR {float(payout.get('delivery_amount', order.get('delivery_charge', 0))):,.2f}"
    payment_status = escape(str(payout.get("payment_status", "PAID")))
    payout_status = escape(str(payout.get("payout_status", payout.get("status", "PENDING"))))
    return f"""<!doctype html><html><head><meta charset='utf-8'><title>Payout Receipt</title>
<style>body{{font-family:Arial,sans-serif;color:#173d2b;margin:40px}}.receipt{{max-width:760px;margin:auto;border:1px solid #ccd9d1;border-radius:16px;padding:34px}}h1{{margin:0}}.muted{{color:#66756d}}table{{width:100%;border-collapse:collapse;margin:28px 0}}td{{padding:12px;border-bottom:1px solid #e5ece7}}td:last-child{{text-align:right;font-weight:bold}}.total{{font-size:19px}}.note{{background:#f2f7f3;padding:14px;border-radius:8px}}button{{padding:10px 18px;background:#245f43;color:white;border:0;border-radius:7px}}@media print{{button{{display:none}}body{{margin:0}}.receipt{{border:0}}}}</style></head><body><div class='receipt'>
<h1>Herbal Hub</h1><p class='muted'>Official Seller Bank Payout Receipt</p>
<p><strong>Receipt / Transaction ID:</strong> {escape(str(payout['_id']))}<br><strong>Order ID:</strong> {escape(payout['order_id'])}<br><strong>Seller:</strong> {escape(seller.get('business_name') or seller.get('name') or 'Seller')}<br><strong>Transaction date:</strong> {local_text(created_at)}<br><strong>Payment status:</strong> {payment_status}<br><strong>Payout status:</strong> {payout_status}<br><strong>Payout reference:</strong> {escape(payout.get('transaction_reference') or 'Pending transfer')}<br><strong>Paid date:</strong> {local_text(paid_at)}</p>
<table><tr><td>Gross seller earning</td><td>{value('gross_amount')}</td></tr><tr><td>Platform commission ({escape(str(payout.get('commission_rate', 0)))}%)</td><td>- {value('commission_amount')}</td></tr><tr class='total'><td>Net seller earning</td><td>{value('net_amount')}</td></tr></table>
<p class='note'>Delivery fee handled by the platform: {delivery}. It is excluded from seller gross earnings, commission and net payout.</p><button onclick='window.print()'>Print / Save as PDF</button>
</div></body></html>"""
