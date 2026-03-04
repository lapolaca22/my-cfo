"""
Microsoft Business Central Integration
=======================================
OAuth2 client-credentials authentication against Azure AD.
All API calls use the Business Central OData v4 REST API (v2.0).

Required environment variables (see .env.example):
    BC_TENANT_ID         – Azure AD tenant ID (GUID or domain)
    BC_CLIENT_ID         – App registration client ID (GUID)
    BC_CLIENT_SECRET     – App registration client secret
    BC_ENVIRONMENT       – BC environment name, e.g. 'sandbox' or 'production'
    BC_COMPANY_ID        – BC company ID (GUID from Admin Center)

Azure AD app registration requirements:
    - API permissions: Dynamics 365 Business Central → app permission: API.ReadWrite.All
    - Grant type: client_credentials (no user interaction required)
    - Supported account types: accounts in this organisational directory only

BC OData v4 API reference:
    https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/
"""

import logging
import time
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

import httpx

from models import Invoice, InvoiceStatus, InvoiceType, JournalEntry

logger = logging.getLogger(__name__)

# ── URL templates ─────────────────────────────────────────────────────────────

_AAD_TOKEN_URL = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
_BC_SCOPE      = "https://api.businesscentral.dynamics.com/.default"
_BC_API_V2     = (
    "https://api.businesscentral.dynamics.com/v2.0/{tenant_id}/{environment}/api/v2.0"
)

# Refresh the cached token 5 minutes before it actually expires
_TOKEN_BUFFER_SECS = 300


# ── Exceptions ────────────────────────────────────────────────────────────────

class BCError(Exception):
    """Raised when a Business Central API call fails."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response_body: str = "",
    ) -> None:
        super().__init__(message)
        self.status_code   = status_code
        self.response_body = response_body


# ── Client ────────────────────────────────────────────────────────────────────

class BusinessCentralClient:
    """
    Client for Microsoft Dynamics 365 Business Central OData v4 API.

    Authenticates with Azure AD using the OAuth2 client-credentials flow.
    Access tokens are cached in-process and auto-refreshed before expiry.

    Sandbox vs Production
    ---------------------
    Pass ``environment="sandbox"`` (or ``sandbox=True``) to hit the BC sandbox
    environment.  Set ``environment="production"`` for production.

    Usage
    -----
        client = BusinessCentralClient(
            tenant_id    = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            client_id    = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            client_secret= "your-secret",
            company_id   = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            environment  = "sandbox",
        )
        status = client.test_connection()
        invoices = client.get_purchase_invoices()
    """

    def __init__(
        self,
        tenant_id: str,
        client_id: str,
        client_secret: str,
        company_id: str,
        environment: str = "sandbox",
        sandbox: bool = False,          # convenience: True forces environment="sandbox"
        http_timeout: float = 30.0,
    ) -> None:
        self.tenant_id     = tenant_id
        self.client_id     = client_id
        self.client_secret = client_secret
        self.company_id    = company_id
        self.environment   = "sandbox" if sandbox else environment
        self.http_timeout  = http_timeout

        self._token: Optional[str] = None
        self._token_expiry: float  = 0.0   # Unix timestamp when the current token expires

        # Single persistent HTTP client; share across all requests for connection pooling
        self._http = httpx.Client(timeout=http_timeout)

        logger.info(
            "BusinessCentralClient initialised (env=%s, company=%s)",
            self.environment,
            self.company_id,
        )

    # ── OAuth2 ────────────────────────────────────────────────────────────────

    def _get_token(self) -> str:
        """Return a valid Bearer token, obtaining a new one from Azure AD if needed."""
        if self._token and time.time() < (self._token_expiry - _TOKEN_BUFFER_SECS):
            return self._token

        url  = _AAD_TOKEN_URL.format(tenant_id=self.tenant_id)
        resp = self._http.post(
            url,
            data={
                "grant_type":    "client_credentials",
                "client_id":     self.client_id,
                "client_secret": self.client_secret,
                "scope":         _BC_SCOPE,
            },
        )
        if resp.status_code != 200:
            raise BCError(
                f"Azure AD token request failed ({resp.status_code}): {resp.text[:400]}",
                status_code=resp.status_code,
                response_body=resp.text,
            )

        data               = resp.json()
        self._token        = data["access_token"]
        self._token_expiry = time.time() + int(data.get("expires_in", 3600))
        logger.debug("Azure AD token obtained; expires_in=%s", data.get("expires_in"))
        return self._token

    def _auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Accept":        "application/json",
            "Content-Type":  "application/json",
        }

    # ── URL helpers ───────────────────────────────────────────────────────────

    def _api_base(self) -> str:
        return _BC_API_V2.format(
            tenant_id=self.tenant_id,
            environment=self.environment,
        )

    def _company_url(self) -> str:
        return f"{self._api_base()}/companies({self.company_id})"

    # ── Generic HTTP wrappers ─────────────────────────────────────────────────

    def _get(self, endpoint: str, params: Optional[dict] = None) -> Any:
        url  = f"{self._company_url()}/{endpoint}"
        resp = self._http.get(url, headers=self._auth_headers(), params=params)
        self._check_response(resp, (200,))
        return resp.json()

    def _post(self, endpoint: str, payload: dict) -> Any:
        url  = f"{self._company_url()}/{endpoint}"
        resp = self._http.post(url, headers=self._auth_headers(), json=payload)
        self._check_response(resp, (200, 201))
        return resp.json()

    def _patch(self, endpoint: str, payload: dict, etag: str = "*") -> Any:
        headers = {**self._auth_headers(), "If-Match": etag}
        url     = f"{self._company_url()}/{endpoint}"
        resp    = self._http.patch(url, headers=headers, json=payload)
        self._check_response(resp, (200,))
        return resp.json()

    def _action(self, endpoint: str) -> None:
        """POST to a BC OData action endpoint that returns 204 No Content."""
        url  = f"{self._company_url()}/{endpoint}"
        resp = self._http.post(url, headers=self._auth_headers())
        self._check_response(resp, (200, 201, 204))

    @staticmethod
    def _check_response(
        resp: httpx.Response,
        expected: tuple[int, ...],
    ) -> None:
        if resp.status_code not in expected:
            raise BCError(
                f"BC API error {resp.status_code} at {resp.url}: {resp.text[:500]}",
                status_code=resp.status_code,
                response_body=resp.text,
            )

    # ── Connection probe ──────────────────────────────────────────────────────

    def test_connection(self) -> dict[str, Any]:
        """
        Validate credentials and return a connection-status dict.

        Calls the company metadata endpoint as a lightweight probe.

        Returns
        -------
        {
            "connected":    bool,
            "company_name": str | None,
            "environment":  str,
            "api_version":  "v2.0",
            "error":        str | None,
        }
        """
        try:
            url  = f"{self._api_base()}/companies({self.company_id})"
            resp = self._http.get(url, headers=self._auth_headers())
            if resp.status_code == 200:
                data = resp.json()
                logger.info(
                    "BC connection OK: company='%s' env=%s",
                    data.get("displayName"),
                    self.environment,
                )
                return {
                    "connected":    True,
                    "company_name": data.get("displayName"),
                    "environment":  self.environment,
                    "api_version":  "v2.0",
                    "error":        None,
                }
            return {
                "connected":    False,
                "company_name": None,
                "environment":  self.environment,
                "api_version":  "v2.0",
                "error":        f"HTTP {resp.status_code}: {resp.text[:300]}",
            }
        except BCError as exc:
            logger.error("BC connection test — auth failed: %s", exc)
            return {
                "connected":    False,
                "company_name": None,
                "environment":  self.environment,
                "api_version":  "v2.0",
                "error":        str(exc),
            }
        except Exception as exc:
            logger.error("BC connection test — unexpected error: %s", exc)
            return {
                "connected":    False,
                "company_name": None,
                "environment":  self.environment,
                "api_version":  "v2.0",
                "error":        str(exc),
            }

    # ── Vendors & Customers ───────────────────────────────────────────────────

    def get_vendors(self, top: int = 500) -> list[dict]:
        """Return all vendors from BC (GET /vendors)."""
        data = self._get("vendors", params={"$top": top})
        return data.get("value", [])

    def get_customers(self, top: int = 500) -> list[dict]:
        """Return all customers from BC (GET /customers)."""
        data = self._get("customers", params={"$top": top})
        return data.get("value", [])

    # ── Purchase Invoices (AP) ────────────────────────────────────────────────

    def get_purchase_invoices(
        self,
        status_filter: Optional[str] = None,
        top: int = 200,
    ) -> list[dict]:
        """
        Return purchase invoices from BC (GET /purchaseInvoices).

        ``status_filter`` maps to the OData ``status`` field.
        BC invoice statuses: "Draft", "In Review", "Open", "Released",
                             "Pending Approval", "Cancelled", "Paid".
        """
        params: dict[str, Any] = {"$top": top}
        if status_filter:
            params["$filter"] = f"status eq '{status_filter}'"
        data = self._get("purchaseInvoices", params=params)
        return data.get("value", [])

    def get_aged_payables(self) -> list[dict]:
        """Return aged accounts payable report from BC (GET /agedAccountsPayable)."""
        data = self._get("agedAccountsPayable")
        return data.get("value", [])

    def create_supplier_invoice_draft(self, invoice: Invoice) -> str:
        """
        Create a purchase invoice draft in BC (POST /purchaseInvoices).
        Returns the BC-assigned invoice GUID.
        """
        payload = self._build_purchase_invoice_payload(invoice)
        result  = self._post("purchaseInvoices", payload)
        bc_id   = result.get("id", "")
        logger.info(
            "BC purchase invoice created: bc_id=%s number=%s vendor=%s",
            bc_id, result.get("number"), invoice.vendor_or_customer,
        )
        return bc_id

    def update_invoice_status(self, bc_id: str, status: InvoiceStatus) -> None:
        """
        Update a BC purchase invoice status.

        BC draft invoices support direct ``status`` patching.
        Posted invoices require workflow actions (Microsoft.NAV.post / cancel).
        """
        # Map internal statuses to BC draft-invoice statuses
        draft_status_map = {
            InvoiceStatus.PENDING_APPROVAL:   "Draft",
            InvoiceStatus.APPROVED:           "Released",
            InvoiceStatus.REJECTED:           "Cancelled",
            InvoiceStatus.QUEUED_FOR_PAYMENT: "Released",
        }
        bc_status = draft_status_map.get(status)
        if bc_status:
            self._patch(
                f"purchaseInvoices({bc_id})",
                {"status": bc_status},
            )
            logger.info("BC invoice %s → status '%s'", bc_id, bc_status)
        else:
            logger.debug(
                "update_invoice_status: no BC mapping for %s — skipping",
                status.value,
            )

    def queue_payment(self, bc_id: str, due_date: str) -> None:
        """
        Mark a purchase invoice ready for payment by posting it in BC.
        Calls the Microsoft.NAV.post OData action.
        """
        self._action(f"purchaseInvoices({bc_id})/Microsoft.NAV.post")
        logger.info("BC purchase invoice %s posted for payment (due %s)", bc_id, due_date)

    def get_open_supplier_invoices(self) -> list[Invoice]:
        """Return open purchase invoices mapped to internal Invoice objects."""
        rows = self.get_purchase_invoices(status_filter="Open")
        return [self._bc_purchase_to_invoice(r) for r in rows]

    # ── Sales Invoices (AR) ───────────────────────────────────────────────────

    def get_sales_invoices(
        self,
        status_filter: Optional[str] = None,
        top: int = 200,
    ) -> list[dict]:
        """
        Return sales invoices from BC (GET /salesInvoices).

        BC invoice statuses: "Draft", "In Review", "Open", "Released",
                             "Pending Approval", "Cancelled", "Paid".
        """
        params: dict[str, Any] = {"$top": top}
        if status_filter:
            params["$filter"] = f"status eq '{status_filter}'"
        data = self._get("salesInvoices", params=params)
        return data.get("value", [])

    def get_aged_receivables(self) -> list[dict]:
        """Return aged accounts receivable report from BC (GET /agedAccountsReceivable)."""
        data = self._get("agedAccountsReceivable")
        return data.get("value", [])

    def create_customer_invoice(self, invoice: Invoice) -> str:
        """
        Create a sales invoice in BC (POST /salesInvoices).
        Returns the BC-assigned invoice GUID.
        """
        payload = self._build_sales_invoice_payload(invoice)
        result  = self._post("salesInvoices", payload)
        bc_id   = result.get("id", "")
        logger.info(
            "BC sales invoice created: bc_id=%s number=%s customer=%s",
            bc_id, result.get("number"), invoice.vendor_or_customer,
        )
        return bc_id

    def get_open_customer_invoices(self) -> list[Invoice]:
        """Return open sales invoices mapped to internal Invoice objects."""
        rows = self.get_sales_invoices(status_filter="Open")
        return [self._bc_sales_to_invoice(r) for r in rows]

    def mark_invoice_paid(
        self,
        bc_id: str,
        amount: Decimal,
        payment_ref: str,
    ) -> None:
        """
        Apply a cash receipt to a BC sales invoice via a payment journal line.

        Flow:
          1. Find (or use a fixed) cash-receipt journal batch.
          2. POST a new journal line applying the payment to the invoice.
          3. POST .../Microsoft.NAV.post to commit the journal.

        Note: The journal batch ``CASHRECEIPT`` must exist in BC or be created
        beforehand via the Admin Centre / chart of accounts configuration.
        """
        batch_code = "CASHRECEIPT"

        # Resolve the journal batch ID
        journals = self._get(
            "paymentJournals",
            params={"$filter": f"code eq '{batch_code}'"},
        ).get("value", [])

        if not journals:
            # Create the batch on first use
            journal = self._post(
                "paymentJournals",
                {"code": batch_code, "displayName": "Cash Receipts (Automation)"},
            )
            journal_id = journal["id"]
        else:
            journal_id = journals[0]["id"]

        # Add a payment journal line for this receipt
        line_payload = {
            "journalDisplayName": batch_code,
            "lineNumber":         10000,
            "accountType":        "Customer",
            "documentType":       "Payment",
            "postingDate":        date.today().isoformat(),
            "amount":             float(-amount),          # receipts are negative in BC
            "appliesToDocType":   "Invoice",
            "appliesToDocNo":     bc_id,
            "externalDocumentNo": payment_ref[:35],        # BC limits to 35 chars
        }
        self._post(
            f"paymentJournals({journal_id})/paymentJournalLines",
            line_payload,
        )

        # Post the journal
        self._action(f"paymentJournals({journal_id})/Microsoft.NAV.post")
        logger.info(
            "BC payment applied: invoice=%s amount=%s ref=%s",
            bc_id, amount, payment_ref,
        )

    # ── General Ledger & Reporting ────────────────────────────────────────────

    def get_general_ledger_entries(
        self,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        top: int = 1000,
    ) -> list[dict]:
        """
        Return GL entries (GET /generalLedgerEntries).

        Dates should be ISO-8601 strings: '2026-01-01'.
        """
        params: dict[str, Any] = {"$top": top}
        filters: list[str] = []
        if from_date:
            filters.append(f"postingDate ge {from_date}")
        if to_date:
            filters.append(f"postingDate le {to_date}")
        if filters:
            params["$filter"] = " and ".join(filters)
        data = self._get("generalLedgerEntries", params=params)
        return data.get("value", [])

    def get_trial_balance(self, period: str) -> dict[str, Any]:
        """
        Return trial balance data (GET /trialBalance).

        ``period`` is informational only (e.g. '2026-02'); BC's trialBalance
        endpoint returns a snapshot of all G/L account balances.
        """
        data     = self._get("trialBalance")
        accounts = data.get("value", [])
        logger.info("BC trial balance: %d accounts", len(accounts))
        return {"period": period, "accounts": accounts}

    def get_bank_reconciliations(self) -> list[dict]:
        """Return bank account reconciliations (GET /bankAccountReconciliations)."""
        data = self._get("bankAccountReconciliations")
        return data.get("value", [])

    def get_fixed_assets(self) -> list[dict[str, Any]]:
        """
        Return fixed assets from BC (GET /fixedAssets), normalised to the
        internal format expected by AccountingAgent.process_depreciation().

        Internal keys required by the depreciation calculator:
            asset_id, name, cost, accumulated_depreciation,
            useful_life_months, residual_value, method.
        """
        data = self._get("fixedAssets")
        return [self._normalise_fixed_asset(a) for a in data.get("value", [])]

    def get_pl_summary(self, period: str) -> dict[str, Any]:
        """
        Derive P&L summary from BC's incomeStatement OData feed
        (GET /incomeStatement).

        Returns: {period, revenue, expenses, net}
        """
        data  = self._get("incomeStatement")
        lines = data.get("value", [])

        revenue  = sum(
            Decimal(str(l.get("netChange", 0)))
            for l in lines
            if str(l.get("accountType", "")).lower() in ("income", "revenue")
        )
        expenses = sum(
            Decimal(str(l.get("netChange", 0)))
            for l in lines
            if str(l.get("accountType", "")).lower() in ("expense", "cost of goods sold")
        )
        logger.info(
            "BC P&L: period=%s revenue=%s expenses=%s",
            period, revenue, expenses,
        )
        return {
            "period":   period,
            "revenue":  float(revenue),
            "expenses": float(abs(expenses)),   # BC stores expenses as negatives
            "net":      float(revenue - abs(expenses)),
        }

    def get_balance_sheet(self, as_of_date: str) -> dict[str, Any]:
        """
        Return balance sheet from BC's balanceSheet OData feed
        (GET /balanceSheet).

        Returns: {as_of, assets, liabilities, equity}
        """
        data  = self._get("balanceSheet")
        lines = data.get("value", [])

        assets      = sum(
            Decimal(str(l.get("balance", 0)))
            for l in lines
            if str(l.get("accountType", "")).lower() == "assets"
        )
        liabilities = sum(
            Decimal(str(l.get("balance", 0)))
            for l in lines
            if str(l.get("accountType", "")).lower() in ("liabilities", "liability")
        )
        equity = assets - abs(liabilities)
        logger.info(
            "BC balance sheet: as_of=%s assets=%s liabilities=%s equity=%s",
            as_of_date, assets, liabilities, equity,
        )
        return {
            "as_of":       as_of_date,
            "assets":      float(assets),
            "liabilities": float(abs(liabilities)),
            "equity":      float(equity),
        }

    def get_cash_flow_summary(self, period: str) -> dict[str, Any]:
        """
        Derive cash flow data from BC's cashFlowStatement OData feed
        (GET /cashFlowStatement).

        Returns: {period, inflows, outflows}
        """
        data  = self._get("cashFlowStatement")
        lines = data.get("value", [])

        inflows  = sum(
            Decimal(str(l.get("value", 0)))
            for l in lines
            if Decimal(str(l.get("value", 0))) > 0
        )
        outflows = sum(
            abs(Decimal(str(l.get("value", 0))))
            for l in lines
            if Decimal(str(l.get("value", 0))) < 0
        )
        return {
            "period":   period,
            "inflows":  float(inflows),
            "outflows": float(outflows),
        }

    # ── Journal Entries ───────────────────────────────────────────────────────

    def post_journal_entry(self, entry: JournalEntry) -> str:
        """
        Post a balanced journal entry to BC's general journal.

        Flow:
          1. Find or create the AUTOMATION general journal batch.
          2. POST one journalLine per entry line.
          3. POST .../Microsoft.NAV.post to commit all lines.

        Returns the journal batch code used (useful for audit trail).
        """
        if not entry.is_balanced:
            raise BCError(
                f"Journal entry {entry.id} is not balanced — refused to post."
            )

        batch_code = "AUTOMATION"

        # Resolve or create the general journal batch
        journals = self._get(
            "journals",
            params={"$filter": f"code eq '{batch_code}'"},
        ).get("value", [])

        if not journals:
            journal = self._post(
                "journals",
                {"code": batch_code, "displayName": "Finance Automation"},
            )
            journal_id = journal["id"]
        else:
            journal_id = journals[0]["id"]

        # Post each line
        for idx, line in enumerate(entry.lines, start=1):
            # In BC journals, debit is positive, credit is negative
            amount = float(line.debit - line.credit)
            line_payload = {
                "journalDisplayName":    batch_code,
                "lineNumber":            idx * 10_000,
                "accountType":           "G/L Account",
                "accountNumber":         line.account_code,
                "postingDate":           entry.entry_date.isoformat(),
                "documentNumber":        entry.id[:20],
                "description":           entry.description[:100],
                "amount":                amount,
                "externalDocumentNumber": entry.id[:35],
            }
            self._post(f"journals({journal_id})/journalLines", line_payload)

        # Commit the batch
        self._action(f"journals({journal_id})/Microsoft.NAV.post")

        logger.info(
            "BC journal posted: entry=%s lines=%d batch=%s",
            entry.id, len(entry.lines), batch_code,
        )
        return batch_code

    # ── Data-mapping helpers ──────────────────────────────────────────────────

    def _build_purchase_invoice_payload(self, invoice: Invoice) -> dict:
        """Map an internal Invoice to a BC purchaseInvoice POST payload."""
        lines = invoice.line_items or [
            {
                "description": "Invoice line",
                "quantity":    1,
                "unit_price":  float(invoice.amount),
            }
        ]
        return {
            "vendorInvoiceNumber": invoice.invoice_number,
            "invoiceDate":         invoice.invoice_date.isoformat(),
            "dueDate":             invoice.due_date.isoformat() if invoice.due_date else None,
            "currencyCode":        invoice.currency if invoice.currency != "EUR" else "",
            "purchaseInvoiceLines": [
                {
                    "lineType":    "Item",
                    "description": li.get("description", ""),
                    "quantity":    li.get("quantity", 1),
                    "unitCost":    float(li.get("unit_price", 0)),
                }
                for li in lines
            ],
        }

    def _build_sales_invoice_payload(self, invoice: Invoice) -> dict:
        """Map an internal Invoice to a BC salesInvoice POST payload."""
        lines = invoice.line_items or [
            {
                "description": "Invoice line",
                "quantity":    1,
                "unit_price":  float(invoice.amount),
            }
        ]
        return {
            "customerName":  invoice.vendor_or_customer,
            "invoiceDate":   invoice.invoice_date.isoformat(),
            "dueDate":       invoice.due_date.isoformat() if invoice.due_date else None,
            "currencyCode":  invoice.currency if invoice.currency != "EUR" else "",
            "salesInvoiceLines": [
                {
                    "lineType":    "Item",
                    "description": li.get("description", ""),
                    "quantity":    li.get("quantity", 1),
                    "unitPrice":   float(li.get("unit_price", 0)),
                }
                for li in lines
            ],
        }

    def _bc_purchase_to_invoice(self, row: dict) -> Invoice:
        """Map a BC purchaseInvoice record to an internal Invoice."""
        return Invoice(
            invoice_type=InvoiceType.SUPPLIER,
            vendor_or_customer=(
                row.get("vendorName") or row.get("vendorNumber", "Unknown Vendor")
            ),
            invoice_number=row.get("number") or row.get("id", ""),
            amount=Decimal(
                str(row.get("totalAmountIncludingTax") or row.get("totalAmountExcludingTax", 0))
            ),
            currency=row.get("currencyCode") or "EUR",
            invoice_date=self._parse_date(row.get("invoiceDate")),
            due_date=self._parse_date(row.get("dueDate")),
            erp_id=row.get("id", ""),
        )

    def _bc_sales_to_invoice(self, row: dict) -> Invoice:
        """Map a BC salesInvoice record to an internal Invoice."""
        return Invoice(
            invoice_type=InvoiceType.CUSTOMER,
            vendor_or_customer=(
                row.get("customerName") or row.get("customerNumber", "Unknown Customer")
            ),
            invoice_number=row.get("number") or row.get("id", ""),
            amount=Decimal(
                str(row.get("totalAmountIncludingTax") or row.get("totalAmountExcludingTax", 0))
            ),
            currency=row.get("currencyCode") or "EUR",
            invoice_date=self._parse_date(row.get("invoiceDate")),
            due_date=self._parse_date(row.get("dueDate")),
            erp_id=row.get("id", ""),
        )

    def _normalise_fixed_asset(self, row: dict) -> dict[str, Any]:
        """
        Map a BC fixedAsset record to the internal dict format used by
        AccountingAgent._calculate_depreciation().

        BC's OData v2 fixedAssets entity does not expose useful_life_months or
        depreciation method directly.  Retrieve these from the fixed asset ledger
        entries or custom extension fields and extend this mapping as needed.
        """
        return {
            "asset_id":                  row.get("id", ""),
            "name":                      row.get("displayName") or row.get("name", ""),
            "cost":                      float(row.get("acquisitionCost", 0)),
            "accumulated_depreciation":  float(row.get("bookValue", 0)),
            # These fields are not in the standard OData entity; provide sensible
            # defaults and extend via BC custom API pages / extension fields.
            "useful_life_months":        60,
            "residual_value":            0,
            "method":                    "straight_line",
        }

    @staticmethod
    def _parse_date(value: Optional[str]) -> Optional[date]:
        """Parse an ISO-8601 date string returned by BC into a Python date."""
        if not value:
            return None
        try:
            return datetime.fromisoformat(value).date()
        except (ValueError, TypeError):
            return None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def close(self) -> None:
        """Close the underlying HTTP client and release connections."""
        self._http.close()

    def __enter__(self) -> "BusinessCentralClient":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    def __del__(self) -> None:
        try:
            self._http.close()
        except Exception:
            pass
