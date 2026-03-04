from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional
import uuid


class PaymentStatus(Enum):
    UNMATCHED = "unmatched"
    MATCHED = "matched"
    PARTIALLY_MATCHED = "partially_matched"
    FLAGGED_FOR_REVIEW = "flagged_for_review"
    RECONCILED = "reconciled"


@dataclass
class Payment:
    """Represents a bank transaction (credit = money received, debit = money sent)."""

    transaction_id: str
    amount: Decimal
    currency: str
    value_date: date
    counterparty: str
    reference: Optional[str] = None       # bank reference / payment note
    matched_invoice_ids: list[str] = field(default_factory=list)
    status: PaymentStatus = PaymentStatus.UNMATCHED
    bank_account: Optional[str] = None
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def __repr__(self) -> str:
        return (
            f"<Payment {self.transaction_id} | {self.counterparty} | "
            f"{self.currency} {self.amount} | {self.status.value}>"
        )
