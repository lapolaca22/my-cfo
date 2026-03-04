"""
Agent 3 — Accounting & Closing Agent
======================================
Responsibilities:
  DAILY triggers:
    - FX revaluation: compute unrealised FX differences on open foreign-currency
      balances and post the corresponding journal entry.

  MONTHLY triggers (run after books are soft-closed):
    - Investment revaluations: parse PDF or CSV statements from custodians/banks,
      compute fair-value adjustments, post journal entries.
    - Fixed asset depreciation: pull the asset register from the ERP, compute
      depreciation for the period using the asset's method, post journal entries.
    - Payroll entries: parse a payroll file delivered by the payroll provider,
      split gross salary / social charges / net pay and post to the GL.

All journal entries are validated for balance before posting.
"""

import csv
import io
import logging
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional

from models import JournalEntry, JournalLine, JournalEntryType
from integrations.erp import ERPClient
from integrations.file_storage import FileStorageClient
from db.repositories import JournalEntryRepository

logger = logging.getLogger(__name__)

# Account codes — adapt to your chart of accounts
ACCOUNTS = {
    # Assets
    "cash_eur": ("1010", "Bank EUR"),
    "cash_usd": ("1020", "Bank USD"),
    "investments": ("1500", "Financial Investments"),
    "fixed_assets": ("1700", "Fixed Assets"),
    "acc_depreciation": ("1750", "Accumulated Depreciation"),
    # Liabilities
    "payroll_payable": ("2100", "Payroll Payable"),
    "social_charges_payable": ("2110", "Social Charges Payable"),
    # Equity / P&L
    "fx_gain_loss": ("6100", "FX Gain / Loss"),
    "investment_revaluation": ("6200", "Investment Revaluation P&L"),
    "depreciation_expense": ("6300", "Depreciation Expense"),
    "salary_expense": ("6400", "Salary Expense"),
    "social_charges_expense": ("6410", "Social Charges Expense"),
}


class AccountingAgent:
    """
    Accounting & Closing Agent.

    Usage:
        agent.run_daily(period_date=date.today())
        agent.run_monthly(period="2026-02")
    """

    PAYROLL_SUBFOLDER = "payroll"
    INVESTMENT_SUBFOLDER = "investment_statements"

    def __init__(
        self,
        erp_client: ERPClient,
        storage_client: FileStorageClient,
        journal_repo: JournalEntryRepository,
        base_currency: str = "EUR",
    ) -> None:
        self.erp = erp_client
        self.storage = storage_client
        self.journal_repo = journal_repo
        self.base_currency = base_currency
        logger.info("AccountingAgent initialised (base_currency=%s)", base_currency)

    # ------------------------------------------------------------------ #
    # Scheduled entry points                                              #
    # ------------------------------------------------------------------ #

    def run_daily(self, period_date: Optional[date] = None) -> dict:
        """Daily accounting tasks. Returns summary dict."""
        period_date = period_date or date.today()
        logger.info("=== Accounting Agent — DAILY run (%s) ===", period_date)
        fx_entries = self.process_fx_differences(period_date)
        summary = {"date": str(period_date), "fx_entries_posted": len(fx_entries)}
        logger.info("Daily run finished: %s", summary)
        return summary

    def run_monthly(self, period: Optional[str] = None) -> dict:
        """
        Monthly closing tasks.
        ``period`` format: 'YYYY-MM' (defaults to previous month).
        """
        if period is None:
            today = date.today()
            period = f"{today.year}-{today.month - 1:02d}" if today.month > 1 else f"{today.year - 1}-12"

        logger.info("=== Accounting Agent — MONTHLY run (period=%s) ===", period)
        inv_entries = self.process_investment_revaluations(period)
        dep_entries = self.process_depreciation(period)
        pay_entries = self.process_payroll(period)

        summary = {
            "period": period,
            "investment_entries_posted": len(inv_entries),
            "depreciation_entries_posted": len(dep_entries),
            "payroll_entries_posted": len(pay_entries),
        }
        logger.info("Monthly run finished: %s", summary)
        return summary

    # ------------------------------------------------------------------ #
    # Daily task: FX differences                                          #
    # ------------------------------------------------------------------ #

    def process_fx_differences(self, as_of: date) -> list[JournalEntry]:
        """
        Revalue foreign-currency bank balances and post unrealised FX gain/loss.

        Steps:
          1. Fetch current FX rates (placeholder).
          2. Fetch FCY account balances from the ERP.
          3. Compute the difference vs. last revaluation rate.
          4. Build and post a balanced journal entry.
        """
        logger.info("Processing FX differences as of %s", as_of)
        fx_rates = self._fetch_fx_rates(as_of)          # {currency: rate_to_base}
        balances = self._fetch_fcy_balances()            # {currency: (balance_fcy, book_value_base)}

        entries: list[JournalEntry] = []
        for currency, (balance_fcy, book_value_base) in balances.items():
            rate = fx_rates.get(currency)
            if rate is None:
                logger.warning("No FX rate for %s — skipping", currency)
                continue
            revalued_base = balance_fcy * rate
            diff = revalued_base - book_value_base
            if diff == 0:
                continue

            entry = self._build_fx_entry(currency, diff, as_of)
            self._post_entry(entry)
            entries.append(entry)

        logger.info("FX entries posted: %d", len(entries))
        return entries

    def _fetch_fx_rates(self, as_of: date) -> dict[str, Decimal]:
        """
        Fetch current FX rates from an external provider.
        TODO: integrate with ECB, Open Exchange Rates, or your bank's FX feed.
        """
        logger.info("[ACCOUNTING PLACEHOLDER] _fetch_fx_rates: as_of=%s", as_of)
        return {"USD": Decimal("0.92"), "GBP": Decimal("1.17"), "CHF": Decimal("1.05")}

    def _fetch_fcy_balances(self) -> dict[str, tuple[Decimal, Decimal]]:
        """
        Fetch foreign-currency account balances from the ERP.
        Returns {currency: (balance_in_fcy, book_value_in_base_currency)}.
        TODO: call ERP API for multi-currency account balances.
        """
        logger.info("[ACCOUNTING PLACEHOLDER] _fetch_fcy_balances")
        return {}   # {currency: (fcy_amount, base_book_value)}

    def _build_fx_entry(
        self, currency: str, diff: Decimal, as_of: date
    ) -> JournalEntry:
        """Build a balanced FX revaluation journal entry."""
        bank_account_code, bank_account_name = ACCOUNTS[f"cash_{currency.lower()}"]
        fx_code, fx_name = ACCOUNTS["fx_gain_loss"]

        if diff > 0:   # FX gain: Dr Bank, Cr FX Gain
            lines = [
                JournalLine(bank_account_code, bank_account_name, debit=diff),
                JournalLine(fx_code, fx_name, credit=diff),
            ]
        else:          # FX loss: Dr FX Loss, Cr Bank
            abs_diff = abs(diff)
            lines = [
                JournalLine(fx_code, fx_name, debit=abs_diff),
                JournalLine(bank_account_code, bank_account_name, credit=abs_diff),
            ]

        return JournalEntry(
            entry_type=JournalEntryType.FX_DIFFERENCE,
            entry_date=as_of,
            description=f"FX revaluation {currency}/{self.base_currency} as of {as_of}",
            lines=lines,
        )

    # ------------------------------------------------------------------ #
    # Monthly task: Investment revaluations                               #
    # ------------------------------------------------------------------ #

    def process_investment_revaluations(self, period: str) -> list[JournalEntry]:
        """
        Parse investment statements (PDF or CSV) and post fair-value adjustments.

        Steps:
          1. List new statement files in the investment subfolder.
          2. Parse each file to extract current NAV / market value.
          3. Compare to book value in ERP.
          4. Build and post revaluation journal entry.
        """
        logger.info("Processing investment revaluations for period=%s", period)
        files = self.storage.list_new_files(
            self.INVESTMENT_SUBFOLDER, (".pdf", ".csv", ".xlsx")
        )
        entries: list[JournalEntry] = []
        for file_path in files:
            try:
                raw = self.storage.read_file(file_path)
                statement = self._parse_investment_statement(file_path, raw)
                entry = self._build_investment_revaluation_entry(statement, period)
                self._post_entry(entry)
                entries.append(entry)
                self.storage.mark_as_processed(file_path)
            except Exception as exc:
                logger.error("Investment revaluation failed for %s: %s", file_path, exc)
        logger.info("Investment revaluation entries posted: %d", len(entries))
        return entries

    def _parse_investment_statement(
        self, file_path: Path, raw: bytes
    ) -> dict[str, Any]:
        """
        Parse a PDF or CSV investment statement.
        Returns a dict with at minimum:
          {fund_name, isin, quantity, market_price, market_value, currency, book_value}

        TODO:
          - PDF: use pdfplumber or camelot to extract tables.
          - CSV/XLSX: use csv.DictReader or pandas.
        """
        logger.info(
            "[ACCOUNTING PLACEHOLDER] _parse_investment_statement: %s", file_path
        )
        if file_path.suffix.lower() == ".csv":
            reader = csv.DictReader(io.StringIO(raw.decode("utf-8")))
            rows = list(reader)
            # Expected columns: fund_name, isin, quantity, price, market_value, book_value
            if rows:
                r = rows[0]
                return {
                    "fund_name": r.get("fund_name", "Unknown Fund"),
                    "isin": r.get("isin", ""),
                    "market_value": Decimal(r.get("market_value", "0")),
                    "book_value": Decimal(r.get("book_value", "0")),
                    "currency": r.get("currency", self.base_currency),
                    "source_file": str(file_path),
                }
        # Fallback / PDF placeholder
        return {
            "fund_name": "Placeholder Fund",
            "isin": "XX0000000000",
            "market_value": Decimal("0"),
            "book_value": Decimal("0"),
            "currency": self.base_currency,
            "source_file": str(file_path),
        }

    def _build_investment_revaluation_entry(
        self, statement: dict, period: str
    ) -> JournalEntry:
        """Build a balanced investment revaluation journal entry."""
        diff = statement["market_value"] - statement["book_value"]
        inv_code, inv_name = ACCOUNTS["investments"]
        rv_code, rv_name = ACCOUNTS["investment_revaluation"]
        as_of = date.fromisoformat(f"{period}-28")   # end-of-month proxy

        if diff >= 0:
            lines = [
                JournalLine(inv_code, inv_name, debit=diff if diff else Decimal("0")),
                JournalLine(rv_code, rv_name, credit=diff if diff else Decimal("0")),
            ]
        else:
            abs_diff = abs(diff)
            lines = [
                JournalLine(rv_code, rv_name, debit=abs_diff),
                JournalLine(inv_code, inv_name, credit=abs_diff),
            ]

        return JournalEntry(
            entry_type=JournalEntryType.INVESTMENT_REVALUATION,
            entry_date=as_of,
            period=period,
            description=f"Investment revaluation — {statement['fund_name']} ({period})",
            lines=lines,
            source_file=statement.get("source_file"),
        )

    # ------------------------------------------------------------------ #
    # Monthly task: Fixed asset depreciation                             #
    # ------------------------------------------------------------------ #

    def process_depreciation(self, period: str) -> list[JournalEntry]:
        """
        Compute and post depreciation for all active fixed assets.

        Supported depreciation methods (via asset.method field):
          - 'straight_line': annual_depreciation / 12
          - 'declining_balance': book_value * rate / 12  (TODO)

        Each asset generates one journal entry per period.
        """
        logger.info("Processing depreciation for period=%s", period)
        assets = self.erp.get_fixed_assets()
        entries: list[JournalEntry] = []

        for asset in assets:
            try:
                dep_amount = self._calculate_depreciation(asset, period)
                if dep_amount <= 0:
                    continue
                entry = self._build_depreciation_entry(asset, dep_amount, period)
                self._post_entry(entry)
                entries.append(entry)
            except Exception as exc:
                logger.error(
                    "Depreciation failed for asset %s: %s",
                    asset.get("asset_id"),
                    exc,
                )

        logger.info("Depreciation entries posted: %d", len(entries))
        return entries

    def _calculate_depreciation(
        self, asset: dict[str, Any], period: str
    ) -> Decimal:
        """
        Calculate monthly depreciation for a single asset.
        asset dict expected keys: asset_id, name, cost, accumulated_depreciation,
                                  useful_life_months, method, residual_value.
        TODO: handle declining balance, units-of-production, etc.
        """
        cost = Decimal(str(asset.get("cost", 0)))
        residual = Decimal(str(asset.get("residual_value", 0)))
        useful_life = int(asset.get("useful_life_months", 60))
        accumulated = Decimal(str(asset.get("accumulated_depreciation", 0)))
        net_book_value = cost - accumulated

        if net_book_value <= residual or useful_life == 0:
            return Decimal("0")   # fully depreciated

        method = asset.get("method", "straight_line")
        if method == "straight_line":
            monthly = (cost - residual) / useful_life
            return min(monthly, net_book_value - residual)
        # TODO: add other methods
        return Decimal("0")

    def _build_depreciation_entry(
        self, asset: dict, amount: Decimal, period: str
    ) -> JournalEntry:
        """Build a balanced depreciation journal entry for one asset."""
        dep_code, dep_name = ACCOUNTS["depreciation_expense"]
        acc_code, acc_name = ACCOUNTS["acc_depreciation"]
        as_of = date.fromisoformat(f"{period}-28")

        return JournalEntry(
            entry_type=JournalEntryType.DEPRECIATION,
            entry_date=as_of,
            period=period,
            description=f"Depreciation — {asset.get('name', 'Unknown Asset')} ({period})",
            lines=[
                JournalLine(dep_code, dep_name, debit=amount),
                JournalLine(acc_code, acc_name, credit=amount),
            ],
        )

    # ------------------------------------------------------------------ #
    # Monthly task: Payroll                                               #
    # ------------------------------------------------------------------ #

    def process_payroll(self, period: str) -> list[JournalEntry]:
        """
        Parse the payroll file for the period and post the payroll journal entry.

        Expected file in storage: payroll/<period>/payroll_<period>.csv
        CSV columns: employee_id, gross_salary, employer_social_charges, net_salary
        Produces one aggregated journal entry for the whole payroll run.
        """
        logger.info("Processing payroll for period=%s", period)
        files = self.storage.list_new_files(
            f"{self.PAYROLL_SUBFOLDER}/{period}", (".csv", ".xlsx", ".txt")
        )
        entries: list[JournalEntry] = []

        for file_path in files:
            try:
                raw = self.storage.read_file(file_path)
                payroll_data = self._parse_payroll_file(file_path, raw)
                entry = self._build_payroll_entry(payroll_data, period)
                self._post_entry(entry)
                entries.append(entry)
                self.storage.mark_as_processed(file_path)
            except Exception as exc:
                logger.error("Payroll processing failed for %s: %s", file_path, exc)

        logger.info("Payroll entries posted: %d", len(entries))
        return entries

    def _parse_payroll_file(
        self, file_path: Path, raw: bytes
    ) -> dict[str, Decimal]:
        """
        Parse payroll CSV/XLSX.
        Returns aggregated totals:
          {total_gross, total_employer_charges, total_net}

        TODO: handle XLSX via openpyxl/pandas, handle multi-entity payroll.
        """
        logger.info("[ACCOUNTING PLACEHOLDER] _parse_payroll_file: %s", file_path)
        totals: dict[str, Decimal] = {
            "total_gross": Decimal("0"),
            "total_employer_charges": Decimal("0"),
            "total_net": Decimal("0"),
        }
        if file_path.suffix.lower() == ".csv":
            reader = csv.DictReader(io.StringIO(raw.decode("utf-8")))
            for row in reader:
                totals["total_gross"] += Decimal(row.get("gross_salary", "0"))
                totals["total_employer_charges"] += Decimal(
                    row.get("employer_social_charges", "0")
                )
                totals["total_net"] += Decimal(row.get("net_salary", "0"))
        return totals

    def _build_payroll_entry(
        self, data: dict[str, Decimal], period: str
    ) -> JournalEntry:
        """
        Build the payroll journal entry.

        Dr Salary Expense          (gross)
        Dr Social Charges Expense  (employer charges)
          Cr Payroll Payable       (net take-home)
          Cr Social Charges Payable (total social charges = employee + employer)
        """
        gross = data["total_gross"]
        emp_charges = data["total_employer_charges"]
        net = data["total_net"]
        employee_charges = gross - net   # employee-side social charges deducted from gross
        total_social = employee_charges + emp_charges
        as_of = date.fromisoformat(f"{period}-28")

        sal_code, sal_name = ACCOUNTS["salary_expense"]
        sc_exp_code, sc_exp_name = ACCOUNTS["social_charges_expense"]
        pay_code, pay_name = ACCOUNTS["payroll_payable"]
        sc_pay_code, sc_pay_name = ACCOUNTS["social_charges_payable"]

        return JournalEntry(
            entry_type=JournalEntryType.PAYROLL,
            entry_date=as_of,
            period=period,
            description=f"Payroll accrual — {period}",
            lines=[
                JournalLine(sal_code, sal_name, debit=gross),
                JournalLine(sc_exp_code, sc_exp_name, debit=emp_charges),
                JournalLine(pay_code, pay_name, credit=net),
                JournalLine(sc_pay_code, sc_pay_name, credit=total_social),
            ],
        )

    # ------------------------------------------------------------------ #
    # Common helper                                                        #
    # ------------------------------------------------------------------ #

    def _post_entry(self, entry: JournalEntry) -> None:
        """Validate, post to ERP, and persist to Supabase."""
        if not entry.is_balanced:
            logger.error("Journal entry %s is not balanced — skipping post", entry.id)
            return
        erp_id = self.erp.post_journal_entry(entry)
        entry.erp_id = erp_id
        entry.posted = True
        # Persist to Supabase
        self.journal_repo.save(entry)
        logger.info("Journal entry posted: erp_id=%s type=%s", erp_id, entry.entry_type.value)

    # ------------------------------------------------------------------ #
    # Observability                                                        #
    # ------------------------------------------------------------------ #

    def get_posted_entries(self) -> list[dict]:
        """Return all posted journal entries from Supabase."""
        return self.journal_repo.get_all()
