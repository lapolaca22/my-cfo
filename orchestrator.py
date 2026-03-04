"""
Main Orchestrator
==================
Wires together all four agents and drives the full finance automation cycle.

Scheduling:
  - AP Agent:          run continuously / on webhook trigger
  - AR Agent:          run every N minutes (configurable)
  - Accounting Agent:  run_daily() once per day; run_monthly() on month-close trigger
  - Reporting Agent:   run once per day (or on demand for the CFO)
"""

import logging
from datetime import date
from typing import Any, Optional

from config import AppConfig
from integrations import ERPClient, BankClient, CRMClient, EmailClient, FileStorageClient
from agents import APAgent, ARAgent, AccountingAgent, ReportingAgent
from db import (
    get_supabase_client,
    InvoiceRepository,
    ApprovalRepository,
    PaymentRepository,
    JournalEntryRepository,
    CFOReportRepository,
)

logger = logging.getLogger(__name__)


class Orchestrator:
    """Finance automation orchestrator."""

    def __init__(self, config: AppConfig) -> None:
        self.config = config

        # ── Supabase client + repositories ──────────────────────────────
        db = get_supabase_client()
        invoice_repo  = InvoiceRepository(db)
        approval_repo = ApprovalRepository(db)
        payment_repo  = PaymentRepository(db)
        journal_repo  = JournalEntryRepository(db)
        report_repo   = CFOReportRepository(db)

        # ── Integration clients ──────────────────────────────────────────
        self.erp = ERPClient(
            base_url=config.erp.base_url,
            api_key=config.erp.api_key,
            company_id=config.erp.company_id,
        )
        self.bank = BankClient(
            base_url=config.bank.base_url,
            client_id=config.bank.client_id,
            client_secret=config.bank.client_secret,
        )
        self.crm = CRMClient(
            base_url=config.crm.base_url,
            api_key=config.crm.api_key,
        )
        self.email = EmailClient(
            host=config.email.host,
            username=config.email.username,
            password=config.email.password,
            inbox_folder=config.email.invoice_inbox,
        )
        self.storage = FileStorageClient(base_path=config.storage.base_path)

        # ── Agents (with injected repositories) ─────────────────────────
        self.ap_agent = APAgent(
            erp_client=self.erp,
            email_client=self.email,
            storage_client=self.storage,
            approver_emails=config.agents.ap_approver_emails,
            invoice_repo=invoice_repo,
            approval_repo=approval_repo,
        )
        self.ar_agent = ARAgent(
            erp_client=self.erp,
            bank_client=self.bank,
            crm_client=self.crm,
            bank_account_id=config.bank.account_id,
            review_email=config.agents.ar_review_email,
            invoice_repo=invoice_repo,
            payment_repo=payment_repo,
        )
        self.accounting_agent = AccountingAgent(
            erp_client=self.erp,
            storage_client=self.storage,
            journal_repo=journal_repo,
            base_currency=config.agents.base_currency,
        )
        self.reporting_agent = ReportingAgent(
            erp_client=self.erp,
            email_client=self.email,
            storage_client=self.storage,
            report_repo=report_repo,
            ap_agent=self.ap_agent,
            ar_agent=self.ar_agent,
            accounting_agent=self.accounting_agent,
        )

        logger.info("Orchestrator initialised — all agents ready")

    # ------------------------------------------------------------------ #
    # Composite run methods                                               #
    # ------------------------------------------------------------------ #

    def run_daily(self, report_recipients: Optional[list[str]] = None) -> dict[str, Any]:
        """Daily automation cycle: AP → AR → FX entries → CFO report."""
        logger.info("====== DAILY ORCHESTRATION CYCLE STARTED ======")
        results: dict[str, Any] = {}
        results["ap"] = self._safe_run("AP Agent", self.ap_agent.run)
        results["ar"] = self._safe_run("AR Agent", self.ar_agent.run)
        results["accounting_daily"] = self._safe_run(
            "Accounting Agent (daily)",
            lambda: self.accounting_agent.run_daily(date.today()),
        )
        recipients = report_recipients or self.config.agents.report_recipients
        results["reporting"] = self._safe_run(
            "Reporting Agent",
            lambda: self.reporting_agent.run(recipients=recipients),
        )
        logger.info("====== DAILY ORCHESTRATION CYCLE FINISHED ======")
        return results

    def run_monthly_close(
        self,
        period: Optional[str] = None,
        report_recipients: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Month-end closing cycle: accounting entries → month-end report."""
        today = date.today()
        if period is None:
            prev_month = today.month - 1 or 12
            prev_year = today.year if today.month > 1 else today.year - 1
            period = f"{prev_year}-{prev_month:02d}"

        logger.info("====== MONTHLY CLOSE CYCLE STARTED (period=%s) ======", period)
        results: dict[str, Any] = {}
        results["accounting_monthly"] = self._safe_run(
            "Accounting Agent (monthly)",
            lambda: self.accounting_agent.run_monthly(period),
        )
        recipients = report_recipients or self.config.agents.report_recipients
        results["reporting"] = self._safe_run(
            "Reporting Agent (month-end)",
            lambda: self.reporting_agent.run(period=period, recipients=recipients),
        )
        logger.info("====== MONTHLY CLOSE CYCLE FINISHED ======")
        return results

    def run_ap_only(self) -> dict[str, Any]:
        return self._safe_run("AP Agent", self.ap_agent.run)

    def run_ar_only(self) -> dict[str, Any]:
        return self._safe_run("AR Agent", self.ar_agent.run)

    def record_invoice_approval(
        self,
        approval_id: str,
        approver_id: str,
        approver_name: str,
        approved: bool,
        comment: Optional[str] = None,
    ) -> None:
        """Proxy: record a human approver's decision. Call from webhook handler."""
        self.ap_agent.record_approval_decision(
            approval_id=approval_id,
            approver_id=approver_id,
            approver_name=approver_name,
            approved=approved,
            comment=comment,
        )

    @staticmethod
    def _safe_run(agent_name: str, fn) -> Any:
        try:
            result = fn()
            logger.info("%s completed successfully", agent_name)
            return result
        except Exception as exc:
            logger.error("%s failed: %s", agent_name, exc, exc_info=True)
            return {"error": str(exc), "agent": agent_name}
