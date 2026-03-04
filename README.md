# CFO Finance Automation System

A multi-agent finance automation skeleton for a startup CFO.
Four specialised agents handle the full AP/AR/Accounting/Reporting cycle,
each with clear ownership, typed interfaces, and placeholder ERP/bank/CRM calls
ready to be wired to real APIs.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Orchestrator                            │
│                          (main.py)                              │
└──────────┬──────────────┬───────────────┬───────────────────────┘
           │              │               │               │
     ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼──────┐
     │  Agent 1  │  │  Agent 2  │  │  Agent 3  │  │  Agent 4   │
     │  AP Agent │  │ AR Agent  │  │Accounting │  │ Reporting  │
     │           │  │  & Recon  │  │& Closing  │  │   Agent    │
     └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬──────┘
           │              │               │               │
           └──────────────┴───────────────┴───────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
        ┌─────▼─────┐        ┌──────▼──────┐      ┌──────▼──────┐
        │    ERP    │        │    Bank     │      │  CRM / Email│
        │  (NetSuite│        │  (PSD2 /   │      │  / Storage  │
        │  Xero etc)│        │  Open Bank)│      │             │
        └───────────┘        └─────────────┘      └─────────────┘
```

### Data Flow

```
Email / Folder
     │
     ▼
Agent 1 (AP)
  extract → draft ERP → 4-eyes approval → payment queue
                                │
                          ApprovalRequest
                          (2 approvers required)

CRM ──────────────────► Agent 2 (AR) ◄──── Bank transactions
                          CRM sync │ match payments to invoices
                                   └── flag unmatched → human review

Scheduled (daily/monthly)
     │
     ▼
Agent 3 (Accounting)
  FX revaluation │ investment revaluation │ depreciation │ payroll
  each produces a balanced JournalEntry → ERP GL

Agent 4 (Reporting)
  pulls from ERP + Agents 1–3 → CFO summary report → email / storage
```

---

## Project Structure

```
my-cfo/
├── main.py                     Entry point (CLI)
├── orchestrator.py             Wires all agents together
├── config.py                   Env-var-based configuration
├── requirements.txt
├── .env.example                Copy → .env and fill in credentials
│
├── agents/
│   ├── ap_agent/
│   │   └── agent.py            Agent 1: Accounts Payable
│   ├── ar_agent/
│   │   └── agent.py            Agent 2: AR & Reconciliation
│   ├── accounting_agent/
│   │   └── agent.py            Agent 3: Accounting & Closing
│   └── reporting_agent/
│       └── agent.py            Agent 4: CFO Reporting
│
├── integrations/
│   ├── erp.py                  ERP facade (all ERP calls in one place)
│   ├── bank.py                 Bank / open-banking facade
│   ├── crm.py                  CRM facade
│   ├── email_client.py         Email inbox + send facade
│   └── file_storage.py         Shared folder / S3 / SharePoint facade
│
└── models/
    ├── invoice.py              Invoice dataclass (AP + AR)
    ├── payment.py              Bank transaction dataclass
    ├── journal_entry.py        GL journal entry + lines
    └── approval.py             4-eyes ApprovalRequest state machine
```

---

## Agent Responsibilities

### Agent 1 — AP Agent (`agents/ap_agent/agent.py`)

| Method | Description |
|---|---|
| `run()` | Full AP cycle: ingest → extract → draft → route |
| `ingest_from_email()` | Fetch unread invoice emails and process attachments |
| `ingest_from_folder()` | Pick up invoice files from shared folder |
| `extract_invoice_data()` | Parse raw bytes → Invoice (OCR / XML / CSV) |
| `create_draft_entry()` | Push draft to ERP |
| `route_for_approval()` | Create ApprovalRequest, notify approvers |
| `record_approval_decision()` | Record a human decision (webhook entry point) |
| `process_approved_invoices()` | Queue all fully-approved invoices for payment |

**4-eyes principle:** implemented in `models/approval.py`.
`ApprovalRequest` requires `REQUIRED_APPROVALS = 2` distinct approvers.
A single rejection immediately closes the request as REJECTED.
Any approver trying to vote twice raises a `ValueError`.

---

### Agent 2 — AR & Reconciliation Agent (`agents/ar_agent/agent.py`)

| Method | Description |
|---|---|
| `run()` | CRM sync + bank reconciliation |
| `sync_crm_invoices_to_erp()` | Poll CRM for new invoices, push to ERP |
| `push_invoice_to_erp()` | Create one customer invoice in ERP |
| `reconcile_bank_payments()` | Fetch bank transactions, match to open invoices |
| `match_payment_to_invoice()` | 3-strategy matching: reference / exact / fuzzy |
| `flag_unmatched_payment()` | Mark for human review, send alert |

**Matching strategies** (in priority order):
1. Payment reference contains invoice number (exact string match)
2. Exact amount + counterparty name match
3. Amount within `AMOUNT_TOLERANCE` (€0.05) + counterparty match

---

### Agent 3 — Accounting & Closing Agent (`agents/accounting_agent/agent.py`)

| Method | Trigger | Description |
|---|---|---|
| `run_daily()` | Daily cron | FX revaluation for all FCY balances |
| `run_monthly()` | Month-end | Investment revaluations + depreciation + payroll |
| `process_fx_differences()` | Daily | Compute unrealised FX gain/loss, post JE |
| `process_investment_revaluations()` | Monthly | Parse PDF/CSV statements, post fair-value JE |
| `process_depreciation()` | Monthly | Straight-line depreciation per asset, post JE |
| `process_payroll()` | Monthly | Parse payroll CSV, post split GL entry |

All journal entries are validated for balance (`entry.is_balanced`) before posting.
An unbalanced entry is logged as an error and skipped.

---

### Agent 4 — Reporting Agent (`agents/reporting_agent/agent.py`)

| Method | Description |
|---|---|
| `run()` | Generate + export + deliver report |
| `generate_cfo_report()` | Assemble CFOReport from ERP + agents |
| `pull_erp_data()` | Fetch trial balance, P&L, balance sheet, cash flow |
| `export_report()` | Write JSON and/or plain-text report to storage |
| `deliver_report()` | Email the report to configured recipients |

The `CFOReport` dataclass is fully serialisable to JSON via `dataclasses.asdict`.

---

## Models

| Model | Purpose |
|---|---|
| `Invoice` | Supplier (AP) or customer (AR) invoice |
| `Payment` | Incoming bank transaction |
| `JournalEntry` / `JournalLine` | Balanced GL journal entry |
| `ApprovalRequest` / `ApprovalDecision` | 4-eyes approval state machine |

---

## Integrations (Placeholder Layer)

All external calls are isolated behind facade classes in `integrations/`.
Each method contains a `# TODO` comment pointing to the real API endpoint.
Swapping a real implementation is a one-file change.

| Integration | File | Vendor examples |
|---|---|---|
| ERP | `integrations/erp.py` | NetSuite, Xero, SAP, QuickBooks, Exact |
| Bank | `integrations/bank.py` | Salt Edge, Plaid, TrueLayer, Finapi |
| CRM | `integrations/crm.py` | Salesforce, HubSpot, Pipedrive |
| Email | `integrations/email_client.py` | IMAP/SMTP, Microsoft Graph, Gmail API |
| File storage | `integrations/file_storage.py` | Local FS, SharePoint, Google Drive, S3 |

---

## Getting Started

### 1. Install dependencies

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure credentials

```bash
cp .env.example .env
# Edit .env — fill in ERP / bank / CRM / email credentials
```

### 3. Run

```bash
# Full daily cycle (AP + AR + FX entries + CFO report)
python main.py

# Month-end closing
python main.py --cycle monthly --period 2026-02

# AP Agent only (e.g. triggered by email webhook)
python main.py --cycle ap

# AR Agent only (e.g. on a 15-minute cron)
python main.py --cycle ar

# Override report recipients
python main.py --recipients "cfo@example.com,board@example.com"
```

---

## Approval Webhook

The AP Agent exposes `record_approval_decision()` for integration with your
approval UI or email-based approval links. Call it via the orchestrator:

```python
orchestrator.record_invoice_approval(
    approval_id="<uuid from ApprovalRequest>",
    approver_id="user-42",
    approver_name="Jane Smith",
    approved=True,
    comment="Looks good, within budget",
)
```

The 4-eyes rule is enforced: the invoice moves to `APPROVED` status only after
two distinct approvers vote `approved=True`. A single `approved=False` rejects it.

---

## Extending the System

### Add a real ERP integration

1. Open `integrations/erp.py`.
2. Each method has a `# TODO` comment with the endpoint.
3. Replace the placeholder `return` with your real HTTP call using `httpx` or `requests`.

### Add a new journal entry type

1. Add a new value to `JournalEntryType` in `models/journal_entry.py`.
2. Add a `process_*` method to `AccountingAgent`.
3. Call it from `run_daily()` or `run_monthly()`.

### Add a new report section

1. Add a new `@dataclass` section to `agents/reporting_agent/agent.py`.
2. Add a `_build_*` method that pulls data from ERP or agents.
3. Include it in `generate_cfo_report()` and `_render_text_report()`.

---

## Scheduling Recommendations

| Agent | Recommended trigger |
|---|---|
| AP Agent | On email webhook + 15-min poll fallback |
| AR Agent | Every 15–30 minutes |
| Accounting — daily | 06:00 UTC daily (before business opens) |
| Accounting — monthly | Day 1 of month, 02:00 UTC (after soft close) |
| Reporting | 07:00 UTC daily |

Use `APScheduler`, Celery, or a cloud scheduler (AWS EventBridge, GCP Cloud Scheduler)
to call the orchestrator methods on a schedule.
