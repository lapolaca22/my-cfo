"""
Agent 1 — Accounts Payable (AP) Agent
======================================
Responsibilities:
  1. Ingest supplier invoices from email and/or a shared folder.
  2. Extract key data: vendor, amount, currency, invoice date, due date, line items.
  3. Create a draft entry in the ERP.
  4. Route the invoice for approval (4-eyes principle: 2 distinct approvers required).
  5. Once fully approved, queue the invoice for payment in the ERP.

4-eyes enforcement lives in models.ApprovalRequest — the agent only drives the workflow.
"""

import logging
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Optional

from models import Invoice, InvoiceStatus, InvoiceType, ApprovalRequest, ApprovalStatus
from models.approval import ApprovalDecision
from integrations.erp import ERPClient
from integrations.email_client import EmailClient, EmailMessage
from integrations.file_storage import FileStorageClient

logger = logging.getLogger(__name__)

# In-memory stores — replace with a database in production
_pending_approvals: dict[str, ApprovalRequest] = {}   # approval_id -> ApprovalRequest
_invoice_registry: dict[str, Invoice] = {}            # invoice.id -> Invoice


class APAgent:
    """
    Accounts Payable Agent.

    Typical execution flow (triggered by scheduler or webhook):
        agent.run()
          └─ ingest_invoices()
               ├─ ingest_from_email()
               └─ ingest_from_folder()
          └─ process_approved_invoices()

    The approval step is asynchronous: human approvers call
    ``record_approval_decision()`` via a webhook / UI action.
    """

    SUPPORTED_EXTENSIONS = (".pdf", ".xml", ".csv", ".png", ".jpg", ".jpeg")
    INVOICE_SUBFOLDER = "incoming_invoices"

    def __init__(
        self,
        erp_client: ERPClient,
        email_client: EmailClient,
        storage_client: FileStorageClient,
        approver_emails: list[str],
    ) -> None:
        self.erp = erp_client
        self.email = email_client
        self.storage = storage_client
        self.approver_emails = approver_emails  # used to notify approvers
        logger.info(
            "APAgent initialised with %d configured approvers", len(approver_emails)
        )

    # ------------------------------------------------------------------ #
    # Main entry point                                                     #
    # ------------------------------------------------------------------ #

    def run(self) -> dict:
        """
        Full AP cycle: ingest → extract → draft → route.
        Returns a summary dict for the orchestrator.
        """
        logger.info("=== AP Agent run started ===")
        ingested = self.ingest_invoices()
        queued = self.process_approved_invoices()
        summary = {
            "invoices_ingested": len(ingested),
            "invoices_queued_for_payment": queued,
            "pending_approvals": len(_pending_approvals),
        }
        logger.info("=== AP Agent run finished: %s ===", summary)
        return summary

    # ------------------------------------------------------------------ #
    # Step 1 — Ingestion                                                   #
    # ------------------------------------------------------------------ #

    def ingest_invoices(self) -> list[Invoice]:
        """Ingest invoices from all configured sources."""
        invoices: list[Invoice] = []
        invoices.extend(self.ingest_from_email())
        invoices.extend(self.ingest_from_folder())
        return invoices

    def ingest_from_email(self) -> list[Invoice]:
        """Fetch unread invoice emails and process each attachment."""
        messages: list[EmailMessage] = self.email.fetch_unread_invoice_emails()
        invoices: list[Invoice] = []
        for msg in messages:
            for attachment in msg.attachments:
                if not attachment["filename"].lower().endswith(self.SUPPORTED_EXTENSIONS):
                    logger.debug("Skipping unsupported attachment: %s", attachment["filename"])
                    continue
                try:
                    invoice = self._process_single_invoice(
                        raw_data=attachment["data"],
                        filename=attachment["filename"],
                        source="email",
                    )
                    invoices.append(invoice)
                    self.email.mark_as_processed(msg.message_id)
                except Exception as exc:
                    logger.error(
                        "Failed to process email attachment %s: %s",
                        attachment["filename"],
                        exc,
                    )
        logger.info("Ingested %d invoice(s) from email", len(invoices))
        return invoices

    def ingest_from_folder(self) -> list[Invoice]:
        """Pick up new invoice files from the shared folder."""
        files = self.storage.list_new_files(
            self.INVOICE_SUBFOLDER, self.SUPPORTED_EXTENSIONS
        )
        invoices: list[Invoice] = []
        for file_path in files:
            try:
                raw_data = self.storage.read_file(file_path)
                invoice = self._process_single_invoice(
                    raw_data=raw_data,
                    filename=file_path.name,
                    source="shared_folder",
                )
                invoices.append(invoice)
                self.storage.mark_as_processed(file_path)
            except Exception as exc:
                logger.error("Failed to process file %s: %s", file_path, exc)
        logger.info("Ingested %d invoice(s) from shared folder", len(invoices))
        return invoices

    def _process_single_invoice(
        self, raw_data: bytes, filename: str, source: str
    ) -> Invoice:
        """Extract → draft → route for a single invoice file."""
        invoice = self.extract_invoice_data(raw_data, filename, source)
        erp_id = self.create_draft_entry(invoice)
        invoice.erp_id = erp_id
        self.route_for_approval(invoice)
        return invoice

    # ------------------------------------------------------------------ #
    # Step 2 — Extraction                                                  #
    # ------------------------------------------------------------------ #

    def extract_invoice_data(
        self, raw_data: bytes, filename: str, source: str
    ) -> Invoice:
        """
        Parse raw file bytes and return a populated Invoice object.

        TODO: replace with a real OCR/parser pipeline:
          - PDF → pdfplumber / pytesseract / AWS Textract / Azure Form Recognizer
          - XML (ZUGFeRD / UBL) → lxml parser
          - Structured CSV → pandas
        """
        logger.info("[AP PLACEHOLDER] extract_invoice_data: file=%s source=%s", filename, source)

        # --- Placeholder extracted values ---
        invoice = Invoice(
            invoice_type=InvoiceType.SUPPLIER,
            vendor_or_customer="Placeholder Vendor GmbH",
            invoice_number=f"INV-{filename[:8].upper()}",
            amount=Decimal("1000.00"),
            currency="EUR",
            invoice_date=datetime.utcnow().date(),
            due_date=datetime.utcnow().date().replace(day=28),  # placeholder due date
            line_items=[
                {"description": "Services rendered", "quantity": 1, "unit_price": 1000.00}
            ],
            source=source,
            raw_file_path=filename,
        )
        logger.info("Extracted invoice: %s", invoice)
        _invoice_registry[invoice.id] = invoice
        return invoice

    # ------------------------------------------------------------------ #
    # Step 3 — ERP draft creation                                         #
    # ------------------------------------------------------------------ #

    def create_draft_entry(self, invoice: Invoice) -> str:
        """Create a draft supplier invoice in the ERP and return its ERP ID."""
        erp_id = self.erp.create_supplier_invoice_draft(invoice)
        invoice.status = InvoiceStatus.PENDING_APPROVAL
        self.erp.update_invoice_status(erp_id, InvoiceStatus.PENDING_APPROVAL)
        logger.info("Draft created in ERP: erp_id=%s invoice=%s", erp_id, invoice.id)
        return erp_id

    # ------------------------------------------------------------------ #
    # Step 4 — Approval routing (4-eyes)                                  #
    # ------------------------------------------------------------------ #

    def route_for_approval(self, invoice: Invoice) -> ApprovalRequest:
        """
        Create an ApprovalRequest for the invoice and notify configured approvers.
        The request requires REQUIRED_APPROVALS (2) distinct approvers.
        """
        request = ApprovalRequest(
            subject_id=invoice.id,
            subject_type="supplier_invoice",
            requested_by="ap_agent",
            amount_hint=f"{invoice.currency} {invoice.amount}",
        )
        _pending_approvals[request.id] = request
        logger.info(
            "Approval request created: request_id=%s invoice=%s amount=%s",
            request.id,
            invoice.id,
            request.amount_hint,
        )
        self._notify_approvers(request, invoice)
        return request

    def _notify_approvers(
        self, request: ApprovalRequest, invoice: Invoice
    ) -> None:
        """Send approval request notification to all configured approvers."""
        subject = (
            f"[Action Required] Approve supplier invoice {invoice.invoice_number} "
            f"— {invoice.currency} {invoice.amount}"
        )
        body = (
            f"A new supplier invoice requires your approval.\n\n"
            f"Vendor:         {invoice.vendor_or_customer}\n"
            f"Invoice No.:    {invoice.invoice_number}\n"
            f"Amount:         {invoice.currency} {invoice.amount}\n"
            f"Due Date:       {invoice.due_date}\n"
            f"Approval ID:    {request.id}\n\n"
            f"Please approve or reject via the finance portal."
        )
        for approver_email in self.approver_emails:
            self.email.send_notification(to=approver_email, subject=subject, body=body)

    def record_approval_decision(
        self,
        approval_id: str,
        approver_id: str,
        approver_name: str,
        approved: bool,
        comment: Optional[str] = None,
    ) -> ApprovalRequest:
        """
        Record a human approver's decision.
        Called by a webhook handler or UI backend.
        Raises KeyError if the approval_id is not found.
        """
        request = _pending_approvals[approval_id]
        decision = ApprovalDecision(
            approver_id=approver_id,
            approver_name=approver_name,
            decision=ApprovalStatus.APPROVED if approved else ApprovalStatus.REJECTED,
            comment=comment,
        )
        request.add_decision(decision)
        logger.info(
            "Decision recorded: approval=%s approver=%s decision=%s approvals=%d/%d",
            approval_id,
            approver_id,
            decision.decision.value,
            request.approvals_received,
            2,
        )
        if request.status == ApprovalStatus.REJECTED:
            self._handle_rejection(request)
        elif request.is_fully_approved:
            self._handle_full_approval(request)
        return request

    def _handle_full_approval(self, request: ApprovalRequest) -> None:
        """Called when both approvers have approved — queue for payment."""
        invoice = _invoice_registry.get(request.subject_id)
        if invoice is None:
            logger.error("Invoice %s not found in registry", request.subject_id)
            return
        invoice.status = InvoiceStatus.APPROVED
        self.erp.update_invoice_status(invoice.erp_id, InvoiceStatus.APPROVED)
        logger.info("Invoice %s fully approved (4-eyes satisfied)", invoice.id)
        del _pending_approvals[request.id]

    def _handle_rejection(self, request: ApprovalRequest) -> None:
        """Called when any approver rejects the invoice."""
        invoice = _invoice_registry.get(request.subject_id)
        if invoice is None:
            return
        invoice.status = InvoiceStatus.REJECTED
        self.erp.update_invoice_status(invoice.erp_id, InvoiceStatus.REJECTED)
        logger.warning("Invoice %s rejected by approver", invoice.id)
        del _pending_approvals[request.id]

    # ------------------------------------------------------------------ #
    # Step 5 — Payment queuing                                            #
    # ------------------------------------------------------------------ #

    def process_approved_invoices(self) -> int:
        """
        Scan the invoice registry for fully approved invoices and queue
        each one for payment in the ERP.
        Returns the count of invoices queued.
        """
        queued = 0
        for invoice in list(_invoice_registry.values()):
            if invoice.status == InvoiceStatus.APPROVED and invoice.erp_id:
                self.queue_for_payment(invoice)
                queued += 1
        return queued

    def queue_for_payment(self, invoice: Invoice) -> None:
        """Push an approved invoice to the ERP payment run queue."""
        self.erp.queue_payment(invoice.erp_id, str(invoice.due_date))
        invoice.status = InvoiceStatus.QUEUED_FOR_PAYMENT
        self.erp.update_invoice_status(invoice.erp_id, InvoiceStatus.QUEUED_FOR_PAYMENT)
        logger.info(
            "Invoice queued for payment: erp_id=%s due=%s", invoice.erp_id, invoice.due_date
        )

    # ------------------------------------------------------------------ #
    # Observability helpers                                               #
    # ------------------------------------------------------------------ #

    def get_pending_approvals(self) -> list[ApprovalRequest]:
        return list(_pending_approvals.values())

    def get_invoice_registry(self) -> dict[str, Invoice]:
        return dict(_invoice_registry)
