"""
Repository layer — thin wrappers around Supabase table operations.

Each repository converts between Python dataclasses and the flat dicts
that Supabase expects / returns.  Business logic stays in the agents;
the repositories only handle persistence.
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from models import Invoice, InvoiceStatus, Payment, PaymentStatus, JournalEntry, JournalLine
from models.approval import ApprovalRequest, ApprovalDecision, ApprovalStatus, REQUIRED_APPROVALS

logger = logging.getLogger(__name__)


# ── helpers ───────────────────────────────────────────────────────────────────

def _decimal_str(v: Any) -> str:
    """Supabase returns NUMERIC as strings in some drivers — normalise to str."""
    return str(v) if v is not None else "0"


def _to_iso(d: Any) -> Optional[str]:
    if d is None:
        return None
    if isinstance(d, (date, datetime)):
        return d.isoformat()
    return str(d)


# =============================================================================
# InvoiceRepository
# =============================================================================

class InvoiceRepository:
    TABLE = "invoices"

    def __init__(self, client) -> None:
        self._db = client

    # ── write ─────────────────────────────────────────────────────────────

    def save(self, invoice: Invoice) -> None:
        """Insert or update an invoice row."""
        row = {
            "id":                 invoice.id,
            "invoice_type":       invoice.invoice_type.value,
            "vendor_or_customer": invoice.vendor_or_customer,
            "invoice_number":     invoice.invoice_number,
            "amount":             str(invoice.amount),
            "currency":           invoice.currency,
            "invoice_date":       _to_iso(invoice.invoice_date),
            "due_date":           _to_iso(invoice.due_date),
            "status":             invoice.status.value,
            "erp_id":             invoice.erp_id,
            "source":             invoice.source,
            "raw_file_path":      invoice.raw_file_path,
            "notes":              invoice.notes,
            "line_items":         invoice.line_items,
        }
        self._db.table(self.TABLE).upsert(row).execute()
        logger.debug("InvoiceRepository.save: %s", invoice.id)

    def update_status(self, invoice_id: str, status: InvoiceStatus) -> None:
        self._db.table(self.TABLE).update({"status": status.value}).eq("id", invoice_id).execute()
        logger.debug("InvoiceRepository.update_status: %s → %s", invoice_id, status.value)

    def update_erp_id(self, invoice_id: str, erp_id: str) -> None:
        self._db.table(self.TABLE).update({"erp_id": erp_id}).eq("id", invoice_id).execute()

    # ── read ──────────────────────────────────────────────────────────────

    def get_by_id(self, invoice_id: str) -> Optional[dict]:
        res = (
            self._db.table(self.TABLE)
            .select("*")
            .eq("id", invoice_id)
            .maybe_single()
            .execute()
        )
        return res.data

    def get_by_status(self, statuses: list[str]) -> list[dict]:
        res = (
            self._db.table(self.TABLE)
            .select("*")
            .in_("status", statuses)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def get_open_supplier_invoices(self) -> list[dict]:
        return self.get_by_status(
            ["draft", "pending_approval", "approved", "queued_for_payment", "overdue"]
        )

    def get_open_customer_invoices(self) -> list[dict]:
        return self.get_by_status(["sent", "partially_paid", "unmatched"])

    def get_all(self, limit: int = 100) -> list[dict]:
        res = (
            self._db.table(self.TABLE)
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []


# =============================================================================
# ApprovalRepository
# =============================================================================

class ApprovalRepository:
    TABLE = "approval_requests"

    def __init__(self, client) -> None:
        self._db = client

    # ── serialisation ─────────────────────────────────────────────────────

    @staticmethod
    def _to_row(request: ApprovalRequest) -> dict:
        return {
            "id":           request.id,
            "invoice_id":   request.subject_id,
            "subject_type": request.subject_type,
            "requested_by": request.requested_by,
            "amount_hint":  request.amount_hint,
            "status":       request.status.value,
            "decisions": [
                {
                    "approver_id":   d.approver_id,
                    "approver_name": d.approver_name,
                    "decision":      d.decision.value,
                    "timestamp":     d.timestamp.isoformat(),
                    "comment":       d.comment,
                }
                for d in request.decisions
            ],
        }

    @staticmethod
    def _from_row(row: dict) -> ApprovalRequest:
        req = ApprovalRequest(
            subject_id=row["invoice_id"],
            subject_type=row["subject_type"],
            requested_by=row["requested_by"],
            amount_hint=row.get("amount_hint"),
        )
        req.id = row["id"]
        req.status = ApprovalStatus(row["status"])
        req.decisions = [
            ApprovalDecision(
                approver_id=d["approver_id"],
                approver_name=d["approver_name"],
                decision=ApprovalStatus(d["decision"]),
                comment=d.get("comment"),
            )
            for d in (row.get("decisions") or [])
        ]
        return req

    # ── write ─────────────────────────────────────────────────────────────

    def save(self, request: ApprovalRequest) -> None:
        self._db.table(self.TABLE).upsert(self._to_row(request)).execute()
        logger.debug("ApprovalRepository.save: %s", request.id)

    def delete(self, approval_id: str) -> None:
        self._db.table(self.TABLE).delete().eq("id", approval_id).execute()
        logger.debug("ApprovalRepository.delete: %s", approval_id)

    # ── read ──────────────────────────────────────────────────────────────

    def get_by_id(self, approval_id: str) -> Optional[ApprovalRequest]:
        res = (
            self._db.table(self.TABLE)
            .select("*")
            .eq("id", approval_id)
            .maybe_single()
            .execute()
        )
        return self._from_row(res.data) if res.data else None

    def get_pending(self) -> list[ApprovalRequest]:
        res = (
            self._db.table(self.TABLE)
            .select("*")
            .eq("status", "pending")
            .order("created_at", desc=False)
            .execute()
        )
        return [self._from_row(r) for r in (res.data or [])]


# =============================================================================
# PaymentRepository
# =============================================================================

class PaymentRepository:
    TABLE = "payments"

    def __init__(self, client) -> None:
        self._db = client

    @staticmethod
    def _to_row(payment: Payment) -> dict:
        return {
            "id":                  payment.id,
            "transaction_id":      payment.transaction_id,
            "amount":              str(payment.amount),
            "currency":            payment.currency,
            "value_date":          _to_iso(payment.value_date),
            "counterparty":        payment.counterparty,
            "reference":           payment.reference,
            "bank_account":        payment.bank_account,
            "status":              payment.status.value,
            "matched_invoice_ids": payment.matched_invoice_ids,
        }

    # ── write ─────────────────────────────────────────────────────────────

    def save(self, payment: Payment) -> None:
        self._db.table(self.TABLE).upsert(self._to_row(payment)).execute()
        logger.debug("PaymentRepository.save: %s", payment.id)

    def update(self, payment: Payment) -> None:
        self._db.table(self.TABLE).update({
            "status":              payment.status.value,
            "matched_invoice_ids": payment.matched_invoice_ids,
        }).eq("id", payment.id).execute()

    # ── read ──────────────────────────────────────────────────────────────

    def get_flagged(self) -> list[dict]:
        res = (
            self._db.table(self.TABLE)
            .select("*")
            .eq("status", "flagged_for_review")
            .order("value_date", desc=True)
            .execute()
        )
        return res.data or []

    def get_all(self, limit: int = 100) -> list[dict]:
        res = (
            self._db.table(self.TABLE)
            .select("*")
            .order("value_date", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []


# =============================================================================
# JournalEntryRepository
# =============================================================================

class JournalEntryRepository:
    TABLE = "journal_entries"

    def __init__(self, client) -> None:
        self._db = client

    @staticmethod
    def _lines_to_json(entry: JournalEntry) -> list[dict]:
        return [
            {
                "account_code":  ln.account_code,
                "account_name":  ln.account_name,
                "debit":         str(ln.debit),
                "credit":        str(ln.credit),
                "description":   ln.description,
                "cost_centre":   ln.cost_centre,
            }
            for ln in entry.lines
        ]

    # ── write ─────────────────────────────────────────────────────────────

    def save(self, entry: JournalEntry) -> None:
        row = {
            "id":          entry.id,
            "entry_type":  entry.entry_type.value,
            "entry_date":  _to_iso(entry.entry_date),
            "description": entry.description,
            "period":      entry.period,
            "source_file": entry.source_file,
            "erp_id":      entry.erp_id,
            "posted":      entry.posted,
            "lines":       self._lines_to_json(entry),
        }
        self._db.table(self.TABLE).upsert(row).execute()
        logger.debug("JournalEntryRepository.save: %s", entry.id)

    def mark_posted(self, entry_id: str, erp_id: str) -> None:
        self._db.table(self.TABLE).update({
            "posted": True,
            "erp_id": erp_id,
        }).eq("id", entry_id).execute()

    # ── read ──────────────────────────────────────────────────────────────

    def get_by_period(self, period: str) -> list[dict]:
        res = (
            self._db.table(self.TABLE)
            .select("*")
            .eq("period", period)
            .order("entry_date", desc=True)
            .execute()
        )
        return res.data or []

    def get_all(self, limit: int = 100) -> list[dict]:
        res = (
            self._db.table(self.TABLE)
            .select("*")
            .order("entry_date", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []


# =============================================================================
# CFOReportRepository
# =============================================================================

class CFOReportRepository:
    TABLE = "cfo_reports"

    def __init__(self, client) -> None:
        self._db = client

    def save(self, report_dict: dict) -> str:
        """
        Persist a CFO report.  ``report_dict`` should be the result of
        ``dataclasses.asdict(report)`` (the CFOReport dataclass).
        Returns the new row's id.
        """
        row = {
            "period":               report_dict.get("period"),
            "as_of_date":           report_dict.get("as_of_date"),
            "generated_at":         report_dict.get("generated_at"),
            "financial_snapshot":   report_dict.get("financial_snapshot", {}),
            "ap_summary":           report_dict.get("ap_summary", {}),
            "ar_summary":           report_dict.get("ar_summary", {}),
            "accounting_summary":   report_dict.get("accounting_summary", {}),
            "alerts":               report_dict.get("alerts", []),
        }
        res = self._db.table(self.TABLE).insert(row).execute()
        new_id = (res.data or [{}])[0].get("id", "")
        logger.info("CFOReportRepository.save: period=%s id=%s", row["period"], new_id)
        return new_id

    def get_latest(self, period: Optional[str] = None) -> Optional[dict]:
        query = self._db.table(self.TABLE).select("*").order("generated_at", desc=True)
        if period:
            query = query.eq("period", period)
        res = query.limit(1).maybe_single().execute()
        return res.data

    def list_periods(self) -> list[str]:
        res = (
            self._db.table(self.TABLE)
            .select("period")
            .order("period", desc=True)
            .execute()
        )
        seen: set[str] = set()
        periods = []
        for r in (res.data or []):
            p = r["period"]
            if p not in seen:
                seen.add(p)
                periods.append(p)
        return periods
