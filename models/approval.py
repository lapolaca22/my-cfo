from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
import uuid


class ApprovalStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"


REQUIRED_APPROVALS = 2  # 4-eyes principle: at least 2 distinct approvers


@dataclass
class ApprovalDecision:
    approver_id: str
    approver_name: str
    decision: ApprovalStatus          # APPROVED or REJECTED
    timestamp: datetime = field(default_factory=datetime.utcnow)
    comment: Optional[str] = None


@dataclass
class ApprovalRequest:
    """
    Enforces the 4-eyes principle: an item is considered approved only when
    ``REQUIRED_APPROVALS`` distinct approvers have each submitted an APPROVED decision.
    Any single REJECTED decision immediately rejects the whole request.
    """

    subject_id: str                   # ID of the invoice (or other object) under review
    subject_type: str                 # e.g. "supplier_invoice"
    requested_by: str
    amount_hint: Optional[str] = None
    decisions: list[ApprovalDecision] = field(default_factory=list)
    status: ApprovalStatus = ApprovalStatus.PENDING
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=datetime.utcnow)

    # ------------------------------------------------------------------ #
    # State machine                                                        #
    # ------------------------------------------------------------------ #

    def add_decision(self, decision: ApprovalDecision) -> None:
        """Record an approver's decision and update overall status."""
        approver_ids = {d.approver_id for d in self.decisions}
        if decision.approver_id in approver_ids:
            raise ValueError(
                f"Approver {decision.approver_id} has already submitted a decision."
            )
        self.decisions.append(decision)
        self._recompute_status()

    def _recompute_status(self) -> None:
        if any(d.decision == ApprovalStatus.REJECTED for d in self.decisions):
            self.status = ApprovalStatus.REJECTED
            return
        approvals = [d for d in self.decisions if d.decision == ApprovalStatus.APPROVED]
        if len(approvals) >= REQUIRED_APPROVALS:
            self.status = ApprovalStatus.APPROVED

    @property
    def is_fully_approved(self) -> bool:
        return self.status == ApprovalStatus.APPROVED

    @property
    def approvals_received(self) -> int:
        return sum(1 for d in self.decisions if d.decision == ApprovalStatus.APPROVED)

    @property
    def approvals_needed(self) -> int:
        return max(0, REQUIRED_APPROVALS - self.approvals_received)

    def __repr__(self) -> str:
        return (
            f"<ApprovalRequest {self.subject_id} | {self.status.value} | "
            f"{self.approvals_received}/{REQUIRED_APPROVALS} approvals>"
        )
