from decimal import Decimal


POSTAL_STATUS_TRANSITIONS = {
    "pending": {"accepted"},
    "accepted": {"packed"},
    "packed": {"shipped"},
    "shipped": {"in_transit"},
    "in_transit": {"delivered"},
    "delivered": set(),
}

ORDER_STATUS_BY_POSTAL_STATUS = {
    "pending": "placed",
    "accepted": "confirmed",
    "packed": "packed",
    "shipped": "shipped",
    "in_transit": "out_for_delivery",
    "delivered": "delivered",
}


def calculate_shipping_fee(parcel_weight_grams: int) -> Decimal:
    """Return the configured Sri Lanka Post fee for a parcel up to 2 kg."""
    if not isinstance(parcel_weight_grams, int) or isinstance(parcel_weight_grams, bool):
        raise ValueError("Parcel weight must be a whole number of grams")
    if parcel_weight_grams <= 0:
        raise ValueError("Parcel weight must be greater than zero")
    if parcel_weight_grams <= 250:
        return Decimal("180.00")
    if parcel_weight_grams <= 500:
        return Decimal("250.00")
    if parcel_weight_grams <= 1000:
        return Decimal("350.00")
    if parcel_weight_grams <= 2000:
        return Decimal("500.00")
    raise ValueError("Sri Lanka Post shipping supports parcels up to 2 kg")


def calculate_parcel_weight(items: list[dict]) -> int:
    total = 0
    for item in items:
        weight = item.get("weight_grams")
        quantity = item.get("quantity")
        if not isinstance(weight, int) or isinstance(weight, bool) or weight <= 0:
            raise ValueError(f"A valid product weight is required for {item.get('name', 'each item')}")
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
            raise ValueError("Product quantity must be a positive whole number")
        total += weight * quantity
    calculate_shipping_fee(total)
    return total


def validate_postal_transition(current_status: str, new_status: str) -> None:
    if current_status not in POSTAL_STATUS_TRANSITIONS:
        raise ValueError(f"Unknown current delivery status: {current_status}")
    if new_status not in POSTAL_STATUS_TRANSITIONS[current_status]:
        allowed = ", ".join(sorted(POSTAL_STATUS_TRANSITIONS[current_status])) or "none"
        raise ValueError(
            f"Cannot change delivery status from {current_status} to {new_status}. "
            f"Allowed next status: {allowed}"
        )
