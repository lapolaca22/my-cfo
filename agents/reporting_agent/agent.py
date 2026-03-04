"""
Agent 4 — Reporting Agent
===========================
Responsibilities:
  - Pull data from the ERP (P&L, Balance Sheet, Cash Flow, Trial Balance).
  - Pull operational data from the other three agents (AP, AR, Accounting).
  - Compile a structured CFO summary report.
  - Export the report to JSON (machine-readable) and a human-readable text summary.
  - Deliver the report via email and/or save to file storage.
"""

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, List, Optional

from integrations.business_central import BusinessCentralClient
from integrations.email_client import EmailClient
from integrations.file_storage import FileStorageClient
from db.repositories import CFOReportRepository

if TYPE_CHECKING:
    from agents.ap_agent.agent import APAgent
    from agents.ar_agent.agent import ARAgent
    from agents.accounting_agent.agent import AccountingAgent

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
# Report data structures                                              #
# ------------------------------------------------------------------ #

@dataclass
class APSummary:
    invoices_ingested_today: int = 0
    pending_approval_count: int = 0
    queued_for_payment_count: int = 0
    total_payables_outstanding: str = "N/A"
    overdue_payables_count: int = 0


@dataclass
class ARSummary:
    open_invoices_count: int = 0
    total_receivables_outstanding: str = "N/A"
    overdue_receivables_count: int = 0
    unmatched_payments_count: int = 0
    crm_invoices_synced_today: int = 0


@dataclass
class AccountingSummary:
    journal_entries_posted_today: int = 0
    fx_entries_count: int = 0
    depreciation_entries_count: int = 0
    investment_entries_count: int = 0
    payroll_entries_count: int = 0


@dataclass
class FinancialSnapshot:
    period: str
    revenue: str = "N/A"
    expenses: str = "N/A"
    net_income: str = "N/A"
    total_assets: str = "N/A"
    total_liabilities: str = "N/A"
    equity: str = "N/A"
    cash_inflows: str = "N/A"
    cash_outflows: str = "N/A"
    net_cash: str = "N/A"


@dataclass
class CFOReport:
    generated_at: str
    as_of_date: str
    period: str
    financial_snapshot: FinancialSnapshot
    ap_summary: APSummary
    ar_summary: ARSummary
    accounting_summary: AccountingSummary
    alerts: list[str] = field(default_factory=list)
    raw_erp_data: dict[str, Any] = field(default_factory=dict)


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)


# ------------------------------------------------------------------ #
# Agent                                                               #
# ------------------------------------------------------------------ #

class ReportingAgent:
    """
    Reporting Agent.

    Typical usage:
        report = agent.generate_cfo_report(period="2026-02")
        agent.export_report(report, formats=["json", "text"])
        agent.deliver_report(report, recipients=["cfo@company.com"])
    """

    REPORTS_SUBFOLDER = "cfo_reports"

    def __init__(
        self,
        erp_client: BusinessCentralClient,
        email_client: EmailClient,
        storage_client: FileStorageClient,
        report_repo: CFOReportRepository,
        ap_agent: Optional["APAgent"] = None,
        ar_agent: Optional["ARAgent"] = None,
        accounting_agent: Optional["AccountingAgent"] = None,
    ) -> None:
        self.erp = erp_client
        self.email = email_client
        self.storage = storage_client
        self.report_repo = report_repo
        self.ap_agent = ap_agent
        self.ar_agent = ar_agent
        self.accounting_agent = accounting_agent
        logger.info("ReportingAgent initialised")

    # ------------------------------------------------------------------ #
    # Main entry point                                                    #
    # ------------------------------------------------------------------ #

    def run(
        self,
        period: Optional[str] = None,
        recipients: Optional[List[str]] = None,
    ) -> CFOReport:
        """
        Generate, export, and deliver the CFO report.
        Returns the CFOReport object.
        """
        period = period or self._current_period()
        logger.info("=== Reporting Agent run started (period=%s) ===", period)

        report = self.generate_cfo_report(period)
        # Persist to Supabase so the React dashboard can read it
        self.save_report(report)
        self.export_report(report, formats=["json", "text"])

        if recipients:
            self.deliver_report(report, recipients)

        logger.info("=== Reporting Agent run finished ===")
        return report

    # ------------------------------------------------------------------ #
    # Report generation                                                   #
    # ------------------------------------------------------------------ #

    def generate_cfo_report(self, period: str) -> CFOReport:
        """Assemble the full CFO report from all data sources."""
        logger.info("Generating CFO report for period=%s", period)

        financial_snapshot = self._build_financial_snapshot(period)
        ap_summary = self._build_ap_summary()
        ar_summary = self._build_ar_summary()
        accounting_summary = self._build_accounting_summary()
        alerts = self._generate_alerts(financial_snapshot, ap_summary, ar_summary)

        report = CFOReport(
            generated_at=datetime.utcnow().isoformat(),
            as_of_date=str(date.today()),
            period=period,
            financial_snapshot=financial_snapshot,
            ap_summary=ap_summary,
            ar_summary=ar_summary,
            accounting_summary=accounting_summary,
            alerts=alerts,
        )
        logger.info("CFO report compiled with %d alert(s)", len(alerts))
        return report

    # ------------------------------------------------------------------ #
    # ERP data pull                                                        #
    # ------------------------------------------------------------------ #

    def pull_erp_data(self, period: str) -> dict[str, Any]:
        """
        Pull all required financial data from the ERP for the given period.
        Returns a dict keyed by report section.
        """
        logger.info("Pulling ERP data for period=%s", period)
        return {
            "trial_balance": self.erp.get_trial_balance(period),
            "pl_summary": self.erp.get_pl_summary(period),
            "balance_sheet": self.erp.get_balance_sheet(str(date.today())),
            "cash_flow": self.erp.get_cash_flow_summary(period),
            "open_supplier_invoices": self.erp.get_open_supplier_invoices(),
            "open_customer_invoices": self.erp.get_open_customer_invoices(),
        }

    def _build_financial_snapshot(self, period: str) -> FinancialSnapshot:
        erp_data = self.pull_erp_data(period)
        pl = erp_data.get("pl_summary", {})
        bs = erp_data.get("balance_sheet", {})
        cf = erp_data.get("cash_flow", {})

        return FinancialSnapshot(
            period=period,
            revenue=str(pl.get("revenue", "N/A")),
            expenses=str(pl.get("expenses", "N/A")),
            net_income=str(pl.get("net", "N/A")),
            total_assets=str(bs.get("assets", "N/A")),
            total_liabilities=str(bs.get("liabilities", "N/A")),
            equity=str(bs.get("equity", "N/A")),
            cash_inflows=str(cf.get("inflows", "N/A")),
            cash_outflows=str(cf.get("outflows", "N/A")),
            net_cash=str(cf.get("inflows", 0) - cf.get("outflows", 0)),
        )

    # ------------------------------------------------------------------ #
    # Agent data pull                                                      #
    # ------------------------------------------------------------------ #

    def _build_ap_summary(self) -> APSummary:
        summary = APSummary()
        if self.ap_agent is None:
            return summary
        pending = self.ap_agent.get_pending_approvals()
        registry = self.ap_agent.get_invoice_registry()
        from models import InvoiceStatus
        summary.pending_approval_count = len(pending)
        summary.queued_for_payment_count = sum(
            1 for inv in registry.values()
            if inv.status == InvoiceStatus.QUEUED_FOR_PAYMENT
        )
        summary.overdue_payables_count = sum(
            1 for inv in registry.values() if inv.is_overdue()
        )
        return summary

    def _build_ar_summary(self) -> ARSummary:
        summary = ARSummary()
        if self.ar_agent is None:
            return summary
        flagged = self.ar_agent.get_flagged_payments()
        open_invoices = self.erp.get_open_customer_invoices()
        summary.unmatched_payments_count = len(flagged)
        summary.open_invoices_count = len(open_invoices)
        summary.overdue_receivables_count = sum(
            1 for inv in open_invoices if inv.is_overdue()
        )
        return summary

    def _build_accounting_summary(self) -> AccountingSummary:
        summary = AccountingSummary()
        if self.accounting_agent is None:
            return summary
        from models import JournalEntryType
        entries = self.accounting_agent.get_posted_entries()
        summary.journal_entries_posted_today = len(entries)
        summary.fx_entries_count = sum(
            1 for e in entries if e.entry_type == JournalEntryType.FX_DIFFERENCE
        )
        summary.depreciation_entries_count = sum(
            1 for e in entries if e.entry_type == JournalEntryType.DEPRECIATION
        )
        summary.investment_entries_count = sum(
            1 for e in entries if e.entry_type == JournalEntryType.INVESTMENT_REVALUATION
        )
        summary.payroll_entries_count = sum(
            1 for e in entries if e.entry_type == JournalEntryType.PAYROLL
        )
        return summary

    # ------------------------------------------------------------------ #
    # Alerts                                                              #
    # ------------------------------------------------------------------ #

    def _generate_alerts(
        self,
        snapshot: FinancialSnapshot,
        ap: APSummary,
        ar: ARSummary,
    ) -> list[str]:
        """
        Produce a list of human-readable alert strings for the CFO.
        Extend with business-rule thresholds as needed.
        """
        alerts: list[str] = []

        if ap.overdue_payables_count > 0:
            alerts.append(
                f"ALERT: {ap.overdue_payables_count} supplier invoice(s) are overdue."
            )
        if ap.pending_approval_count > 5:
            alerts.append(
                f"WARNING: {ap.pending_approval_count} invoices awaiting approval "
                f"(backlog risk)."
            )
        if ar.overdue_receivables_count > 0:
            alerts.append(
                f"ALERT: {ar.overdue_receivables_count} customer invoice(s) are overdue."
            )
        if ar.unmatched_payments_count > 0:
            alerts.append(
                f"ACTION REQUIRED: {ar.unmatched_payments_count} unmatched payment(s) "
                f"need manual review."
            )
        return alerts

    # ------------------------------------------------------------------ #
    # Export                                                              #
    # ------------------------------------------------------------------ #

    def export_report(
        self,
        report: CFOReport,
        formats: Optional[List[str]] = None,
    ) -> dict[str, Any]:
        """
        Export the report in the specified formats.
        Supported: 'json', 'text'.
        Returns a dict of {format: file_path}.
        """
        formats = formats or ["json", "text"]
        outputs: dict[str, Any] = {}
        slug = f"cfo_report_{report.period}_{report.as_of_date}"

        if "json" in formats:
            path = self._export_json(report, slug)
            outputs["json"] = path

        if "text" in formats:
            path = self._export_text(report, slug)
            outputs["text"] = path

        return outputs

    def _export_json(self, report: CFOReport, slug: str) -> Any:
        content = json.dumps(asdict(report), indent=2, cls=DecimalEncoder).encode("utf-8")
        path = self.storage.write_file(self.REPORTS_SUBFOLDER, f"{slug}.json", content)
        logger.info("Report exported to JSON: %s", path)
        return path

    def _export_text(self, report: CFOReport, slug: str) -> Any:
        text = self._render_text_report(report)
        path = self.storage.write_file(
            self.REPORTS_SUBFOLDER, f"{slug}.txt", text.encode("utf-8")
        )
        logger.info("Report exported to text: %s", path)
        return path

    @staticmethod
    def _render_text_report(report: CFOReport) -> str:
        """Render the CFO report as a human-readable text summary."""
        s = report.financial_snapshot
        ap = report.ap_summary
        ar = report.ar_summary
        ac = report.accounting_summary

        lines = [
            "=" * 60,
            f"  CFO SUMMARY REPORT — {report.period}",
            f"  Generated: {report.generated_at}",
            "=" * 60,
            "",
            "── FINANCIAL SNAPSHOT ──────────────────────────────────",
            f"  Revenue:           {s.revenue}",
            f"  Expenses:          {s.expenses}",
            f"  Net Income:        {s.net_income}",
            f"  Total Assets:      {s.total_assets}",
            f"  Total Liabilities: {s.total_liabilities}",
            f"  Equity:            {s.equity}",
            f"  Cash Inflows:      {s.cash_inflows}",
            f"  Cash Outflows:     {s.cash_outflows}",
            f"  Net Cash Position: {s.net_cash}",
            "",
            "── ACCOUNTS PAYABLE ────────────────────────────────────",
            f"  Invoices pending approval:   {ap.pending_approval_count}",
            f"  Invoices queued for payment: {ap.queued_for_payment_count}",
            f"  Overdue payables:            {ap.overdue_payables_count}",
            "",
            "── ACCOUNTS RECEIVABLE ─────────────────────────────────",
            f"  Open customer invoices:      {ar.open_invoices_count}",
            f"  Overdue receivables:         {ar.overdue_receivables_count}",
            f"  Unmatched bank payments:     {ar.unmatched_payments_count}",
            "",
            "── ACCOUNTING & CLOSING ────────────────────────────────",
            f"  Journal entries posted:      {ac.journal_entries_posted_today}",
            f"    - FX entries:              {ac.fx_entries_count}",
            f"    - Depreciation entries:    {ac.depreciation_entries_count}",
            f"    - Investment entries:      {ac.investment_entries_count}",
            f"    - Payroll entries:         {ac.payroll_entries_count}",
            "",
        ]

        if report.alerts:
            lines.append("── ALERTS & ACTION ITEMS ───────────────────────────────")
            for alert in report.alerts:
                lines.append(f"  • {alert}")
            lines.append("")

        lines.append("=" * 60)
        return "\n".join(lines)

    # ------------------------------------------------------------------ #
    # Supabase persistence                                               #
    # ------------------------------------------------------------------ #

    def save_report(self, report: CFOReport) -> str:
        """Persist the CFO report to Supabase. Returns the new row ID."""
        return self.report_repo.save(asdict(report))

    # ------------------------------------------------------------------ #
    # Delivery                                                            #
    # ------------------------------------------------------------------ #

    def deliver_report(self, report: CFOReport, recipients: list[str]) -> None:
        """Send the text report to the specified recipients via email."""
        subject = f"CFO Summary Report — {report.period} (as of {report.as_of_date})"
        body = self._render_text_report(report)
        for recipient in recipients:
            self.email.send_notification(to=recipient, subject=subject, body=body)
        logger.info("Report delivered to %d recipient(s)", len(recipients))

    # ------------------------------------------------------------------ #
    # Helpers                                                             #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _current_period() -> str:
        today = date.today()
        return f"{today.year}-{today.month:02d}"
