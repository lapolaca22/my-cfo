"""
Agent 2 — Accounts Receivable (AR) & Reconciliation Agent
==========================================================
Responsibilities:
  1. Monitor incoming bank payments (credit transactions).
  2. Match payments to open customer invoices using multiple matching strategies.
  3. Flag unmatched or ambiguous payments for human review.
  4. Poll the CRM for new sales invoices and push them to the ERP.

Persistence is handled by InvoiceRepository and PaymentRepository (Supabase).
"""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from models import Invoice, InvoiceStatus, InvoiceType, Payment, PaymentStatus
from integrations.business_central import BusinessCentralClient
from integrations.bank import BankClient
from integrations.crm import CRMClient
from db.repositories import InvoiceRepository, PaymentRepository

logger = logging.getLogger(__name__)

AMOUNT_TOLERANCE = Decimal("0.05")


class ARAgent:
    """
    Accounts Receivable & Reconciliation Agent.

    Typical execution flow:
        agent.run()
          ├─ sync_crm_invoices_to_erp()
          └─ reconcile_bank_payments()
    """

    LOOKBACK_DAYS = 3

    def __init__(
        self,
        erp_client: BusinessCentralClient,
        bank_client: BankClient,
        crm_client: CRMClient,
        bank_account_id: str,
        review_email: str,
        invoice_repo: InvoiceRepository,
        payment_repo: PaymentRepository,
    ) -> None:
        self.erp = erp_client
        self.bank = bank_client
        self.crm = crm_client
        self.bank_account_id = bank_account_id
        self.review_email = review_email
        self.invoice_repo = invoice_repo
        self.payment_repo = payment_repo
        self._crm_sync_cursor: Optional[str] = None
        logger.info("ARAgent initialised (account=%s)", bank_account_id)

    # ------------------------------------------------------------------ #
    # Main entry point                                                     #
    # ------------------------------------------------------------------ #

    def run(self) -> dict:
        """Full AR cycle: CRM sync → bank reconciliation."""
        logger.info("=== AR Agent run started ===")
        synced = self.sync_crm_invoices_to_erp()
        matched, unmatched = self.reconcile_bank_payments()
        summary = {
            "crm_invoices_synced": synced,
            "payments_matched": matched,
            "payments_flagged_for_review": unmatched,
        }
        logger.info("=== AR Agent run finished: %s ===", summary)
        return summary

    # ------------------------------------------------------------------ #
    # CRM → ERP invoice sync                                              #
    # ------------------------------------------------------------------ #

    def sync_crm_invoices_to_erp(self) -> int:
        """Fetch new CRM invoices, push to ERP, and persist to Supabase."""
        invoices = self.crm.get_new_sales_invoices(since_timestamp=self._crm_sync_cursor)
        pushed = 0
        for invoice in invoices:
            try:
                erp_id = self.push_invoice_to_erp(invoice)
                self.crm.mark_invoice_synced_to_erp(crm_invoice_id=invoice.id, erp_id=erp_id)
                pushed += 1
            except Exception as exc:
                logger.error("Failed to push CRM invoice %s to ERP: %s", invoice.invoice_number, exc)
        self._crm_sync_cursor = datetime.utcnow().isoformat()
        logger.info("CRM sync: %d invoice(s) pushed to ERP", pushed)
        return pushed

    def push_invoice_to_erp(self, invoice: Invoice) -> str:
        """Push a single customer invoice to ERP and persist to Supabase."""
        erp_id = self.erp.create_customer_invoice(invoice)
        invoice.erp_id = erp_id
        invoice.status = InvoiceStatus.SENT
        self.invoice_repo.save(invoice)
        logger.info("Invoice pushed to ERP: crm=%s erp=%s", invoice.invoice_number, erp_id)
        return erp_id

    # ------------------------------------------------------------------ #
    # Bank reconciliation                                                  #
    # ------------------------------------------------------------------ #

    def reconcile_bank_payments(self) -> tuple[int, int]:
        """Fetch bank transactions, match to open invoices, persist results."""
        # Read open invoices from Supabase instead of ERP placeholder
        open_invoice_rows = self.invoice_repo.get_open_customer_invoices()
        since = date.today() - timedelta(days=self.LOOKBACK_DAYS)
        payments = self.bank.get_new_transactions(self.bank_account_id, since)

        matched = 0
        unmatched = 0
        for payment in payments:
            match = self.match_payment_to_invoice_row(payment, open_invoice_rows)
            if match:
                self._apply_match(payment, match)
                matched += 1
            else:
                self.flag_unmatched_payment(payment)
                unmatched += 1

        logger.info("Reconciliation: %d matched, %d flagged", matched, unmatched)
        return matched, unmatched

    def match_payment_to_invoice_row(
        self, payment: Payment, open_invoice_rows: list[dict]
    ) -> Optional[dict]:
        """
        Match a bank payment to an open invoice row (dict from Supabase).
        Strategies (in priority order):
          1. Reference contains invoice number.
          2. Exact amount + counterparty match.
          3. Fuzzy amount within AMOUNT_TOLERANCE + counterparty match.
        """
        if payment.reference:
            for row in open_invoice_rows:
                if row["invoice_number"].lower() in payment.reference.lower():
                    return row

        for row in open_invoice_rows:
            if (
                payment.amount == Decimal(str(row["amount"]))
                and payment.currency == row["currency"]
                and self._names_similar(payment.counterparty, row["vendor_or_customer"])
            ):
                return row

        for row in open_invoice_rows:
            diff = abs(payment.amount - Decimal(str(row["amount"])))
            if (
                diff <= AMOUNT_TOLERANCE
                and payment.currency == row["currency"]
                and self._names_similar(payment.counterparty, row["vendor_or_customer"])
            ):
                return row

        return None

    @staticmethod
    def _names_similar(name_a: str, name_b: str) -> bool:
        """Simple substring / token-based similarity. TODO: use rapidfuzz."""
        a = name_a.lower().strip()
        b = name_b.lower().strip()
        return a in b or b in a or a.split()[0] == b.split()[0]

    def _apply_match(self, payment: Payment, invoice_row: dict) -> None:
        """Record a confirmed match — update payment and invoice in Supabase + ERP."""
        invoice_id = invoice_row["id"]
        payment.matched_invoice_ids.append(invoice_id)
        inv_amount = Decimal(str(invoice_row["amount"]))

        if payment.amount >= inv_amount:
            payment.status = PaymentStatus.MATCHED
            new_invoice_status = InvoiceStatus.MATCHED
        else:
            payment.status = PaymentStatus.PARTIALLY_MATCHED
            new_invoice_status = InvoiceStatus.PARTIALLY_PAID

        self.payment_repo.save(payment)
        self.invoice_repo.update_status(invoice_id, new_invoice_status)
        if invoice_row.get("erp_id"):
            self.erp.mark_invoice_paid(invoice_row["erp_id"], payment.amount, payment.transaction_id)

        logger.info(
            "Payment %s matched → invoice %s (status: %s)",
            payment.transaction_id, invoice_row["invoice_number"], new_invoice_status.value,
        )

    def flag_unmatched_payment(self, payment: Payment) -> None:
        """Mark payment as flagged and persist to Supabase."""
        payment.status = PaymentStatus.FLAGGED_FOR_REVIEW
        self.payment_repo.save(payment)
        logger.warning(
            "Unmatched payment flagged: id=%s counterparty=%s amount=%s %s",
            payment.transaction_id, payment.counterparty, payment.currency, payment.amount,
        )
        # TODO: send alert email to self.review_email

    # ------------------------------------------------------------------ #
    # Observability helpers                                               #
    # ------------------------------------------------------------------ #

    def get_flagged_payments(self) -> list[dict]:
        return self.payment_repo.get_flagged()
