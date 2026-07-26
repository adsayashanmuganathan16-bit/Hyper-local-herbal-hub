from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any



@dataclass(frozen=True)
class PayoutResult:
    successful: bool
    status: str
    reference: str | None = None
    error: str | None = None


class PayoutService(ABC):
    @abstractmethod
    async def create_payout(self, payout: dict[str, Any]) -> PayoutResult: ...


class ManualBankTransferPayoutService(PayoutService):
    async def create_payout(self, payout: dict[str, Any]) -> PayoutResult:
        return PayoutResult(successful=True, status="READY_FOR_MANUAL_TRANSFER")


class AutomaticPayoutService(PayoutService):
    async def create_payout(self, payout: dict[str, Any]) -> PayoutResult:
        return PayoutResult(successful=False, status="FAILED", error="No licensed automatic payout provider is configured")


def get_payout_service(mode: str) -> PayoutService:
    return ManualBankTransferPayoutService() if mode == "manual" else AutomaticPayoutService()
