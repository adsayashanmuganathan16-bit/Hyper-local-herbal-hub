import pytest
from pydantic import ValidationError

from app.models.medicine import MedicineCreate, MedicineUpdate
from app.services.postal_shipping_service import (
    calculate_parcel_weight,
    calculate_shipping_fee,
    validate_postal_transition,
)


@pytest.mark.parametrize(
    ("weight", "fee"),
    [(1, 180), (250, 180), (251, 250), (500, 250), (501, 350),
     (1000, 350), (1001, 500), (2000, 500)],
)
def test_sri_lanka_post_fee_boundaries(weight, fee):
    assert float(calculate_shipping_fee(weight)) == fee


@pytest.mark.parametrize("weight", [0, -1, 2001])
def test_sri_lanka_post_rejects_unsupported_weight(weight):
    with pytest.raises(ValueError):
        calculate_shipping_fee(weight)


def test_parcel_weight_uses_product_quantity():
    items = [
        {"name": "Tea", "weight_grams": 120, "quantity": 2},
        {"name": "Oil", "weight_grams": 80, "quantity": 1},
    ]
    assert calculate_parcel_weight(items) == 320


def test_product_weight_validation():
    valid = MedicineCreate(
        name="Herbal Tea", description="Tea", category="Ayurvedic",
        price=250, stock=4, weight_grams=100, manufacturer="Herbal Hub",
    )
    assert valid.weight_grams == 100
    with pytest.raises(ValidationError):
        MedicineUpdate(weight_grams=0)


def test_postal_status_transition_validation():
    flow = ["pending", "accepted", "packed", "shipped", "in_transit", "delivered"]
    for current, next_status in zip(flow, flow[1:]):
        validate_postal_transition(current, next_status)
    with pytest.raises(ValueError, match="Cannot change"):
        validate_postal_transition("pending", "delivered")


def test_postal_routes_are_registered():
    from app.main import app
    routes = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    assert ("/api/orders/{order_id}/shipping", "PUT") in routes
    assert ("/api/orders/{order_id}/delivery-status", "PUT") in routes
    assert ("/api/orders/{order_id}/postal-tracking", "GET") in routes
    assert ("/api/orders/{order_id}/confirm-received", "PUT") in routes
    assert ("/api/orders/{order_id}/report-not-received", "PUT") in routes
