"""
Agent 2 — Accounts Receivable (AR) & Reconciliation Agent
==========================================================
Responsibilities:
  1. Monitor incoming bank payments (credit transactions).
  2. Match payments to open customer invoices using multiple matching strategies:
       a. Exact amount + reference match
       b. Fuzzy counterparty name match
       c. Partial payment detection
  3. Flag unmatched or ambiguous payments for human review.
  4. Poll the CRM for new sales invoices and push them to the ERP.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from models import Invoice, InvoiceStatus, InvoiceType, Payment, PaymentStatus
from integrations.erp import ERPClient
from integrations.bank import BankClient
from integrations.crm import CRMClient

logger = logging.getLogger(__name__)

# Tolerance for fuzzy amount matching (e.g. minor bank charges deducted)
AMOUNT_TOLERANCE = Decimal("0.05")   # 5 cents / cents equivalent


class ARAgent:
    """
    Accounts Receivable & Reconciliation Agent.

    Typical execution flow (triggered by scheduler):
        agent.run()
          ├─ sync_crm_invoices_to_erp()
          └─ reconcile_bank_payments()
               ├─ fetch_open_invoices()
               ├─ fetch_new_bank_transactions()
               ├─ match_payments_to_invoices()
               └─ flag_unmatched_payments()
    """

    LOOKBACK_DAYS = 3   # how many days back to fetch bank transactions on each run

    def __init__(
        self,
        erp_client: ERPClient,
        bank_client: BankClient,
        crm_client: CRMClient,
        bank_account_id: str,
        review_email: str,
    ) -> None:
        self.erp = erp_client
        self.bank = bank_client
        self.crm = crm_client
        self.bank_account_id = bank_account_id
        self.review_email = review_email   # destination for unmatched payment alerts
        self._crm_sync_cursor: Optional[str] = None   # ISO timestamp of last CRM poll
        self._flagged_payments: list[Payment] = []
        logger.info("ARAgent initialised (account=%s)", bank_account_id)

    # ------------------------------------------------------------------ #
    # Main entry point                                                     #
    # ------------------------------------------------------------------ #

    def run(self) -> dict:
        """Full AR cycle: CRM sync → bank reconciliation. Returns summary dict."""
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
        """
        Fetch new sales invoices from the CRM and push them to the ERP.
        Uses a cursor (last sync timestamp) to avoid reprocessing.
        Returns the count of invoices pushed.
        """
        invoices = self.crm.get_new_sales_invoices(since_timestamp=self._crm_sync_cursor)
        pushed = 0
        for invoice in invoices:
            try:
                erp_id = self.push_invoice_to_erp(invoice)
                # Mark synced on the CRM side so it won't appear again
                self.crm.mark_invoice_synced_to_erp(
                    crm_invoice_id=invoice.id, erp_id=erp_id
                )
                pushed += 1
            except Exception as exc:
                logger.error(
                    "Failed to push CRM invoice %s to ERP: %s", invoice.invoice_number, exc
                )
        # Advance cursor to now so next run only fetches newer records
        from datetime import datetime
        self._crm_sync_cursor = datetime.utcnow().isoformat()
        logger.info("CRM sync: %d invoice(s) pushed to ERP", pushed)
        return pushed

    def push_invoice_to_erp(self, invoice: Invoice) -> str:
        """Push a single customer invoice to the ERP and return its ERP ID."""
        erp_id = self.erp.create_customer_invoice(invoice)
        invoice.erp_id = erp_id
        invoice.status = InvoiceStatus.SENT
        logger.info(
            "Invoice pushed to ERP: crm=%s erp=%s", invoice.invoice_number, erp_id
        )
        return erp_id

    # ------------------------------------------------------------------ #
    # Bank reconciliation                                                  #
    # ------------------------------------------------------------------ #

    def reconcile_bank_payments(self) -> tuple[int, int]:
        """
        Fetch recent bank transactions, attempt to match them to open invoices,
        and flag anything unresolved.
        Returns (matched_count, unmatched_count).
        """
        open_invoices = self.erp.get_open_customer_invoices()
        since = date.today() - timedelta(days=self.LOOKBACK_DAYS)
        payments = self.bank.get_new_transactions(self.bank_account_id, since)

        matched = 0
        unmatched = 0
        for payment in payments:
            invoice = self.match_payment_to_invoice(payment, open_invoices)
            if invoice:
                self._apply_match(payment, invoice)
                matched += 1
            else:
                self.flag_unmatched_payment(payment)
                unmatched += 1

        logger.info(
            "Reconciliation: %d matched, %d flagged", matched, unmatched
        )
        return matched, unmatched

    def match_payment_to_invoice(
        self,
        payment: Payment,
        open_invoices: list[Invoice],
    ) -> Optional[Invoice]:
        """
        Try to match a bank payment to one of the open invoices.
        Matching strategy (in priority order):
          1. Exact reference match (payment reference contains invoice number).
          2. Exact amount + counterparty name match.
          3. Fuzzy amount match within AMOUNT_TOLERANCE + counterparty match.
        Returns the matched Invoice or None.
        """
        # Strategy 1: reference-based
        if payment.reference:
            for invoice in open_invoices:
                if invoice.invoice_number.lower() in payment.reference.lower():
                    logger.debug(
                        "Reference match: payment=%s invoice=%s",
                        payment.transaction_id,
                        invoice.invoice_number,
                    )
                    return invoice

        # Strategy 2: exact amount + counterparty
        for invoice in open_invoices:
            if (
                payment.amount == invoice.amount
                and payment.currency == invoice.currency
                and self._names_similar(payment.counterparty, invoice.vendor_or_customer)
            ):
                logger.debug(
                    "Exact-amount match: payment=%s invoice=%s",
                    payment.transaction_id,
                    invoice.invoice_number,
                )
                return invoice

        # Strategy 3: fuzzy amount
        for invoice in open_invoices:
            diff = abs(payment.amount - invoice.amount)
            if (
                diff <= AMOUNT_TOLERANCE
                and payment.currency == invoice.currency
                and self._names_similar(payment.counterparty, invoice.vendor_or_customer)
            ):
                logger.debug(
                    "Fuzzy-amount match (diff=%s): payment=%s invoice=%s",
                    diff,
                    payment.transaction_id,
                    invoice.invoice_number,
                )
                return invoice

        return None

    @staticmethod
    def _names_similar(name_a: str, name_b: str) -> bool:
        """
        Simple substring / token-based name similarity check.
        TODO: replace with a proper fuzzy-matching library (e.g. rapidfuzz).
        """
        a = name_a.lower().strip()
        b = name_b.lower().strip()
        return a in b or b in a or a.split()[0] == b.split()[0]

    def _apply_match(self, payment: Payment, invoice: Invoice) -> None:
        """Apply a confirmed match: update both payment and invoice objects and ERP."""
        payment.matched_invoice_ids.append(invoice.id)

        if payment.amount >= invoice.amount:
            payment.status = PaymentStatus.MATCHED
            invoice.status = InvoiceStatus.MATCHED
            self.erp.mark_invoice_paid(
                invoice.erp_id,
                payment.amount,
                payment.transaction_id,
            )
            logger.info(
                "Payment matched and invoice closed: payment=%s invoice=%s",
                payment.transaction_id,
                invoice.invoice_number,
            )
        else:
            # Partial payment
            payment.status = PaymentStatus.PARTIALLY_MATCHED
            invoice.status = InvoiceStatus.PARTIALLY_PAID
            self.erp.mark_invoice_paid(
                invoice.erp_id,
                payment.amount,
                payment.transaction_id,
            )
            logger.info(
                "Partial payment matched: payment=%s invoice=%s paid=%s outstanding=%s",
                payment.transaction_id,
                invoice.invoice_number,
                payment.amount,
                invoice.amount - payment.amount,
            )

    def flag_unmatched_payment(self, payment: Payment) -> None:
        """
        Mark payment as requiring human review and record it internally.
        In production, also send a notification to the finance team.
        """
        payment.status = PaymentStatus.FLAGGED_FOR_REVIEW
        self._flagged_payments.append(payment)
        logger.warning(
            "Unmatched payment flagged for review: id=%s counterparty=%s amount=%s %s",
            payment.transaction_id,
            payment.counterparty,
            payment.currency,
            payment.amount,
        )
        # TODO: send alert email to self.review_email with payment details

    # ------------------------------------------------------------------ #
    # Observability helpers                                               #
    # ------------------------------------------------------------------ #

    def get_flagged_payments(self) -> list[Payment]:
        return list(self._flagged_payments)
