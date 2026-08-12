from bson import ObjectId

from app.routes.seller import seller_order_view


def test_seller_order_view_excludes_other_seller_and_gateway_details():
    order = {
        "_id": ObjectId(),
        "user_id": "customer-private-id",
        "seller_id": "seller-a",
        "seller_ids": ["seller-a", "seller-b"],
        "seller_locations": [
            {"seller_id": "seller-a", "latitude": 9.3, "longitude": 80.3},
            {"seller_id": "seller-b", "latitude": 9.4, "longitude": 80.4},
        ],
        "items": [{"medicine_id": "owned-product", "name": "Owned", "price": 120, "quantity": 2}],
        "total_amount": 999,
        "final_amount": 1100,
        "payment_id": "gateway-private-id",
        "payment": {"status": "PAID", "paid_at": None,
                    "transaction_id": "private-transaction", "stripe_payment_intent_id": "pi_private"},
        "customer": {"name": "Customer", "phone": "0770000000"},
    }

    view = seller_order_view(order)

    assert view["total_amount"] == 240
    assert view["final_amount"] == 240
    assert view["seller_total"] == 240
    assert view["payment"] == {"status": "PAID"}
    assert "seller_ids" not in view
    assert "seller_locations" not in view
    assert "seller_id" not in view
    assert "user_id" not in view
    assert "payment_id" not in view
    assert "transaction_id" not in str(view)


def test_seller_order_total_uses_only_items_already_scoped_to_seller():
    view = seller_order_view({
        "items": [
            {"medicine_id": "one", "price": 50, "quantity": 1},
            {"medicine_id": "two", "price": 25, "quantity": 3},
        ],
        "payment": {},
    })
    assert view["seller_total"] == 125
