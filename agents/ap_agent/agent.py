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
Persistence is handled by InvoiceRepository and ApprovalRepository (Supabase).
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional

from models import Invoice, InvoiceStatus, InvoiceType, ApprovalRequest, ApprovalStatus
from models.approval import ApprovalDecision
from integrations.business_central import BusinessCentralClient
from integrations.email_client import EmailClient, EmailMessage
from integrations.file_storage import FileStorageClient
from db.repositories import InvoiceRepository, ApprovalRepository

logger = logging.getLogger(__name__)


class APAgent:
    """
    Accounts Payable Agent.

    Typical execution flow (triggered by scheduler or webhook):
        agent.run()
          └─ ingest_invoices()
               ├─ ingest_from_email()
               └─ ingest_from_folder()
          └─ process_approved_invoices()

    Approval decisions are recorded via ``record_approval_decision()``,
    called by a webhook handler or UI backend.
    """

    SUPPORTED_EXTENSIONS = (".pdf", ".xml", ".csv", ".png", ".jpg", ".jpeg")
    INVOICE_SUBFOLDER = "incoming_invoices"

    def __init__(
        self,
        erp_client: BusinessCentralClient,
        email_client: EmailClient,
        storage_client: FileStorageClient,
        approver_emails: list[str],
        invoice_repo: InvoiceRepository,
        approval_repo: ApprovalRepository,
    ) -> None:
        self.erp = erp_client
        self.email = email_client
        self.storage = storage_client
        self.approver_emails = approver_emails
        self.invoice_repo = invoice_repo
        self.approval_repo = approval_repo
        logger.info(
            "APAgent initialised with %d configured approvers", len(approver_emails)
        )

    # ------------------------------------------------------------------ #
    # Main entry point                                                     #
    # ------------------------------------------------------------------ #

    def run(self) -> dict:
        """Full AP cycle: ingest → extract → draft → route → queue."""
        logger.info("=== AP Agent run started ===")
        ingested = self.ingest_invoices()
        queued = self.process_approved_invoices()
        pending = self.approval_repo.get_pending()
        summary = {
            "invoices_ingested": len(ingested),
            "invoices_queued_for_payment": queued,
            "pending_approvals": len(pending),
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
                    logger.error("Failed to process email attachment %s: %s", attachment["filename"], exc)
        logger.info("Ingested %d invoice(s) from email", len(invoices))
        return invoices

    def ingest_from_folder(self) -> list[Invoice]:
        """Pick up new invoice files from the shared folder."""
        files = self.storage.list_new_files(self.INVOICE_SUBFOLDER, self.SUPPORTED_EXTENSIONS)
        invoices: list[Invoice] = []
        for file_path in files:
            try:
                raw_data = self.storage.read_file(file_path)
                invoice = self._process_single_invoice(
                    raw_data=raw_data, filename=file_path.name, source="shared_folder"
                )
                invoices.append(invoice)
                self.storage.mark_as_processed(file_path)
            except Exception as exc:
                logger.error("Failed to process file %s: %s", file_path, exc)
        logger.info("Ingested %d invoice(s) from shared folder", len(invoices))
        return invoices

    def _process_single_invoice(self, raw_data: bytes, filename: str, source: str) -> Invoice:
        """Extract → save to DB → draft in ERP → route for approval."""
        invoice = self.extract_invoice_data(raw_data, filename, source)
        # Persist to Supabase immediately
        self.invoice_repo.save(invoice)
        erp_id = self.create_draft_entry(invoice)
        invoice.erp_id = erp_id
        self.invoice_repo.update_erp_id(invoice.id, erp_id)
        self.route_for_approval(invoice)
        return invoice

    # ------------------------------------------------------------------ #
    # Step 2 — Extraction                                                  #
    # ------------------------------------------------------------------ #

    def extract_invoice_data(self, raw_data: bytes, filename: str, source: str) -> Invoice:
        """
        Parse raw file bytes and return a populated Invoice object.

        TODO: replace with a real OCR/parser pipeline:
          - PDF → pdfplumber / pytesseract / AWS Textract / Azure Form Recognizer
          - XML (ZUGFeRD / UBL) → lxml parser
          - Structured CSV → pandas
        """
        logger.info("[AP PLACEHOLDER] extract_invoice_data: file=%s source=%s", filename, source)
        invoice = Invoice(
            invoice_type=InvoiceType.SUPPLIER,
            vendor_or_customer="Placeholder Vendor GmbH",
            invoice_number=f"INV-{filename[:8].upper()}",
            amount=Decimal("1000.00"),
            currency="EUR",
            invoice_date=datetime.utcnow().date(),
            due_date=datetime.utcnow().date().replace(day=28),
            line_items=[{"description": "Services rendered", "quantity": 1, "unit_price": 1000.00}],
            source=source,
            raw_file_path=filename,
        )
        logger.info("Extracted invoice: %s", invoice)
        return invoice

    # ------------------------------------------------------------------ #
    # Step 3 — ERP draft creation                                         #
    # ------------------------------------------------------------------ #

    def create_draft_entry(self, invoice: Invoice) -> str:
        """Create a draft supplier invoice in the ERP and persist status to DB."""
        erp_id = self.erp.create_supplier_invoice_draft(invoice)
        invoice.status = InvoiceStatus.PENDING_APPROVAL
        self.erp.update_invoice_status(erp_id, InvoiceStatus.PENDING_APPROVAL)
        self.invoice_repo.update_status(invoice.id, InvoiceStatus.PENDING_APPROVAL)
        logger.info("Draft created in ERP: erp_id=%s invoice=%s", erp_id, invoice.id)
        return erp_id

    # ------------------------------------------------------------------ #
    # Step 4 — Approval routing (4-eyes)                                  #
    # ------------------------------------------------------------------ #

    def route_for_approval(self, invoice: Invoice) -> ApprovalRequest:
        """Create an ApprovalRequest in Supabase and notify configured approvers."""
        request = ApprovalRequest(
            subject_id=invoice.id,
            subject_type="supplier_invoice",
            requested_by="ap_agent",
            amount_hint=f"{invoice.currency} {invoice.amount}",
        )
        self.approval_repo.save(request)
        logger.info(
            "Approval request created: request_id=%s invoice=%s amount=%s",
            request.id, invoice.id, request.amount_hint,
        )
        self._notify_approvers(request, invoice)
        return request

    def _notify_approvers(self, request: ApprovalRequest, invoice: Invoice) -> None:
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
        Record a human approver's decision (called by webhook / UI backend).
        Loads the ApprovalRequest from Supabase, applies the decision, saves back.
        """
        request = self.approval_repo.get_by_id(approval_id)
        if request is None:
            raise KeyError(f"ApprovalRequest {approval_id} not found")

        decision = ApprovalDecision(
            approver_id=approver_id,
            approver_name=approver_name,
            decision=ApprovalStatus.APPROVED if approved else ApprovalStatus.REJECTED,
            comment=comment,
        )
        request.add_decision(decision)
        # Persist the updated decisions + status
        self.approval_repo.save(request)

        logger.info(
            "Decision recorded: approval=%s approver=%s decision=%s approvals=%d/2",
            approval_id, approver_id, decision.decision.value, request.approvals_received,
        )

        if request.status == ApprovalStatus.REJECTED:
            self._handle_rejection(request)
        elif request.is_fully_approved:
            self._handle_full_approval(request)
        return request

    def _handle_full_approval(self, request: ApprovalRequest) -> None:
        """Both approvers approved — mark invoice APPROVED in DB and ERP."""
        invoice_row = self.invoice_repo.get_by_id(request.subject_id)
        if invoice_row is None:
            logger.error("Invoice %s not found in DB", request.subject_id)
            return
        self.invoice_repo.update_status(request.subject_id, InvoiceStatus.APPROVED)
        if invoice_row.get("erp_id"):
            self.erp.update_invoice_status(invoice_row["erp_id"], InvoiceStatus.APPROVED)
        self.approval_repo.delete(request.id)
        logger.info("Invoice %s fully approved (4-eyes satisfied)", request.subject_id)

    def _handle_rejection(self, request: ApprovalRequest) -> None:
        """Any approver rejected — mark invoice REJECTED in DB and ERP."""
        invoice_row = self.invoice_repo.get_by_id(request.subject_id)
        if invoice_row is None:
            return
        self.invoice_repo.update_status(request.subject_id, InvoiceStatus.REJECTED)
        if invoice_row.get("erp_id"):
            self.erp.update_invoice_status(invoice_row["erp_id"], InvoiceStatus.REJECTED)
        self.approval_repo.delete(request.id)
        logger.warning("Invoice %s rejected by approver", request.subject_id)

    # ------------------------------------------------------------------ #
    # Step 5 — Payment queuing                                            #
    # ------------------------------------------------------------------ #

    def process_approved_invoices(self) -> int:
        """Queue all DB-approved invoices for payment in the ERP."""
        approved_rows = self.invoice_repo.get_by_status(["approved"])
        queued = 0
        for row in approved_rows:
            if not row.get("erp_id"):
                continue
            self.erp.queue_payment(row["erp_id"], row["due_date"])
            self.invoice_repo.update_status(row["id"], InvoiceStatus.QUEUED_FOR_PAYMENT)
            self.erp.update_invoice_status(row["erp_id"], InvoiceStatus.QUEUED_FOR_PAYMENT)
            logger.info("Invoice queued for payment: erp_id=%s due=%s", row["erp_id"], row["due_date"])
            queued += 1
        return queued

    # ------------------------------------------------------------------ #
    # Observability helpers                                               #
    # ------------------------------------------------------------------ #

    def get_pending_approvals(self) -> list[ApprovalRequest]:
        return self.approval_repo.get_pending()

    def get_invoice_registry(self) -> list[dict]:
        return self.invoice_repo.get_all()
