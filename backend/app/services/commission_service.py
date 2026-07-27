from decimal import Decimal, ROUND_HALF_UP

from app.config import settings

MONEY = Decimal("0.01")


def money(value: Decimal | str | int) -> Decimal:
    return Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_UP)


def calculate_commission(gross: Decimal, rate: Decimal) -> tuple[Decimal, Decimal]:
    gross = money(gross)
    commission = money(gross * Decimal(rate) / Decimal("100"))
    return commission, money(gross - commission)


async def current_commission_rate(db) -> Decimal:
    setting = await db.commission_settings.find_one(sort=[("effective_from", -1)])
    return Decimal(str(setting["percentage"])) if setting else Decimal(settings.DEFAULT_COMMISSION_PERCENT)
