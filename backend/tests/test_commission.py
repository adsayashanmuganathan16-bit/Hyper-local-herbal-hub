from decimal import Decimal

from app.services.commission_service import calculate_commission


def test_ten_percent_commission():
    commission, net = calculate_commission(Decimal("10000"), Decimal("10"))
    assert commission == Decimal("1000.00")
    assert net == Decimal("9000.00")


def test_money_rounding_is_half_up():
    commission, net = calculate_commission(Decimal("10.05"), Decimal("10"))
    assert commission == Decimal("1.01")
    assert commission + net == Decimal("10.05")
