from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional
import uuid


class JournalEntryType(Enum):
    INVESTMENT_REVALUATION = "investment_revaluation"
    FX_DIFFERENCE = "fx_difference"
    DEPRECIATION = "depreciation"
    PAYROLL = "payroll"
    ACCRUAL = "accrual"
    MANUAL = "manual"


@dataclass
class JournalLine:
    account_code: str
    account_name: str
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    description: Optional[str] = None
    cost_centre: Optional[str] = None

    def __post_init__(self) -> None:
        if self.debit != 0 and self.credit != 0:
            raise ValueError("A journal line cannot have both debit and credit.")


@dataclass
class JournalEntry:
    entry_type: JournalEntryType
    entry_date: date
    description: str
    lines: list[JournalLine] = field(default_factory=list)
    period: Optional[str] = None          # e.g. "2026-02"
    source_file: Optional[str] = None
    erp_id: Optional[str] = None
    posted: bool = False
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

    @property
    def is_balanced(self) -> bool:
        total_debit = sum(ln.debit for ln in self.lines)
        total_credit = sum(ln.credit for ln in self.lines)
        return total_debit == total_credit

    def total_amount(self) -> Decimal:
        return sum(ln.debit for ln in self.lines)

    def __repr__(self) -> str:
        return (
            f"<JournalEntry {self.entry_type.value} | {self.entry_date} | "
            f"{self.description} | balanced={self.is_balanced}>"
        )
