"""
ERP Integration — placeholder implementation.

Replace the bodies of each method with real API calls to your ERP
(e.g. NetSuite, SAP, Xero, QuickBooks, Exact, etc.).
All public methods follow a consistent contract:
  - Inputs are typed Python objects or primitives.
  - Return values are typed Python objects or dicts.
  - Errors are raised as ERPError.
"""

import logging
from decimal import Decimal
from typing import Any, Optional

from models import Invoice, JournalEntry, InvoiceStatus

logger = logging.getLogger(__name__)


class ERPError(Exception):
    pass


class ERPClient:
    """Facade for all ERP operations used by the finance agents."""

    def __init__(self, base_url: str, api_key: str, company_id: str) -> None:
        self.base_url = base_url
        self.api_key = api_key
        self.company_id = company_id
        logger.info("ERPClient initialised (company=%s)", company_id)

    # ------------------------------------------------------------------ #
    # Invoices — AP                                                        #
    # ------------------------------------------------------------------ #

    def create_supplier_invoice_draft(self, invoice: Invoice) -> str:
        """
        Push a new supplier invoice as a draft to the ERP.
        Returns the ERP-assigned invoice ID.
        """
        logger.info("[ERP PLACEHOLDER] create_supplier_invoice_draft: %s", invoice)
        # TODO: POST /supplier-invoices with invoice payload
        return f"ERP-AP-{invoice.invoice_number}"

    def update_invoice_status(self, erp_id: str, status: InvoiceStatus) -> None:
        """Update the status of an existing invoice in the ERP."""
        logger.info("[ERP PLACEHOLDER] update_invoice_status: %s -> %s", erp_id, status.value)
        # TODO: PATCH /invoices/{erp_id} {"status": status.value}

    def queue_payment(self, erp_id: str, due_date: str) -> None:
        """Add an approved invoice to the payment run queue."""
        logger.info("[ERP PLACEHOLDER] queue_payment: %s due %s", erp_id, due_date)
        # TODO: POST /payment-queue {"invoice_id": erp_id, "due_date": due_date}

    # ------------------------------------------------------------------ #
    # Invoices — AR                                                        #
    # ------------------------------------------------------------------ #

    def create_customer_invoice(self, invoice: Invoice) -> str:
        """Push a new customer invoice from the CRM into the ERP."""
        logger.info("[ERP PLACEHOLDER] create_customer_invoice: %s", invoice)
        # TODO: POST /customer-invoices with invoice payload
        return f"ERP-AR-{invoice.invoice_number}"

    def get_open_customer_invoices(self) -> list[Invoice]:
        """Return all open (unpaid) customer invoices from the ERP."""
        logger.info("[ERP PLACEHOLDER] get_open_customer_invoices")
        # TODO: GET /customer-invoices?status=open
        return []

    def mark_invoice_paid(self, erp_id: str, amount: Decimal, payment_ref: str) -> None:
        """Mark a customer invoice as (fully or partially) paid."""
        logger.info(
            "[ERP PLACEHOLDER] mark_invoice_paid: %s amount=%s ref=%s",
            erp_id,
            amount,
            payment_ref,
        )
        # TODO: POST /customer-invoices/{erp_id}/payments

    # ------------------------------------------------------------------ #
    # Journal Entries                                                      #
    # ------------------------------------------------------------------ #

    def post_journal_entry(self, entry: JournalEntry) -> str:
        """Post a balanced journal entry to the ERP general ledger."""
        if not entry.is_balanced:
            raise ERPError(f"Journal entry {entry.id} is not balanced — cannot post.")
        logger.info("[ERP PLACEHOLDER] post_journal_entry: %s", entry)
        # TODO: POST /journal-entries with entry payload
        return f"ERP-JE-{entry.id[:8]}"

    # ------------------------------------------------------------------ #
    # Reporting                                                            #
    # ------------------------------------------------------------------ #

    def get_trial_balance(self, period: str) -> dict[str, Any]:
        """Return trial balance for the given period (e.g. '2026-02')."""
        logger.info("[ERP PLACEHOLDER] get_trial_balance: period=%s", period)
        # TODO: GET /reports/trial-balance?period={period}
        return {"period": period, "accounts": []}

    def get_open_supplier_invoices(self) -> list[Invoice]:
        """Return all open supplier invoices (awaiting payment)."""
        logger.info("[ERP PLACEHOLDER] get_open_supplier_invoices")
        # TODO: GET /supplier-invoices?status=open
        return []

    def get_cash_flow_summary(self, period: str) -> dict[str, Any]:
        """Return cash flow data for the given period."""
        logger.info("[ERP PLACEHOLDER] get_cash_flow_summary: period=%s", period)
        # TODO: GET /reports/cash-flow?period={period}
        return {"period": period, "inflows": 0, "outflows": 0}

    def get_pl_summary(self, period: str) -> dict[str, Any]:
        """Return P&L summary for the given period."""
        logger.info("[ERP PLACEHOLDER] get_pl_summary: period=%s", period)
        # TODO: GET /reports/profit-loss?period={period}
        return {"period": period, "revenue": 0, "expenses": 0, "net": 0}

    def get_balance_sheet(self, as_of_date: str) -> dict[str, Any]:
        """Return balance sheet as of a given date."""
        logger.info("[ERP PLACEHOLDER] get_balance_sheet: as_of=%s", as_of_date)
        # TODO: GET /reports/balance-sheet?as_of={as_of_date}
        return {"as_of": as_of_date, "assets": 0, "liabilities": 0, "equity": 0}

    def get_fixed_assets(self) -> list[dict[str, Any]]:
        """Return the fixed asset register."""
        logger.info("[ERP PLACEHOLDER] get_fixed_assets")
        # TODO: GET /fixed-assets
        return []
