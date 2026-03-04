from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional
import uuid


class InvoiceStatus(Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    QUEUED_FOR_PAYMENT = "queued_for_payment"
    PAID = "paid"
    REJECTED = "rejected"
    OVERDUE = "overdue"
    # AR-side statuses
    SENT = "sent"
    PARTIALLY_PAID = "partially_paid"
    MATCHED = "matched"
    UNMATCHED = "unmatched"


class InvoiceType(Enum):
    SUPPLIER = "supplier"   # AP — money going out
    CUSTOMER = "customer"   # AR — money coming in


@dataclass
class Invoice:
    invoice_type: InvoiceType
    vendor_or_customer: str
    invoice_number: str
    amount: Decimal
    currency: str
    invoice_date: date
    due_date: date
    line_items: list[dict] = field(default_factory=list)
    status: InvoiceStatus = InvoiceStatus.DRAFT
    erp_id: Optional[str] = None
    source: Optional[str] = None          # e.g. "email", "shared_folder", "crm"
    raw_file_path: Optional[str] = None   # original attachment path
    notes: Optional[str] = None
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def is_overdue(self) -> bool:
        return date.today() > self.due_date and self.status not in (
            InvoiceStatus.PAID,
            InvoiceStatus.REJECTED,
        )

    def __repr__(self) -> str:
        return (
            f"<Invoice {self.invoice_number} | {self.vendor_or_customer} | "
            f"{self.currency} {self.amount} | {self.status.value}>"
        )
