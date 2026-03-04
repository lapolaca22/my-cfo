-- =============================================================================
-- CFO Finance Automation — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Helper: auto-update updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- TABLE: invoices
-- Covers both AP (supplier) and AR (customer) invoices.
-- =============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_type        TEXT        NOT NULL CHECK (invoice_type IN ('supplier', 'customer')),
  vendor_or_customer  TEXT        NOT NULL,
  invoice_number      TEXT        NOT NULL,
  amount              NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
  currency            TEXT        NOT NULL DEFAULT 'EUR',
  invoice_date        DATE        NOT NULL,
  due_date            DATE        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                          'draft', 'pending_approval', 'approved',
                          'queued_for_payment', 'paid', 'rejected', 'overdue',
                          'sent', 'partially_paid', 'matched', 'unmatched'
                        )),
  erp_id              TEXT,
  source              TEXT,         -- 'email' | 'shared_folder' | 'crm'
  raw_file_path       TEXT,
  notes               TEXT,
  line_items          JSONB       NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_type        ON invoices (invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date    ON invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at  ON invoices (created_at DESC);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
-- Development policy — replace with auth.uid() checks before production
CREATE POLICY "dev_allow_all" ON invoices FOR ALL USING (true) WITH CHECK (true);


-- =============================================================================
-- TABLE: approval_requests
-- Tracks the 4-eyes approval workflow for supplier invoices.
-- =============================================================================
CREATE TABLE IF NOT EXISTS approval_requests (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID        NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  subject_type    TEXT        NOT NULL DEFAULT 'supplier_invoice',
  requested_by    TEXT        NOT NULL,
  amount_hint     TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')),
  -- Each decision: {approver_id, approver_name, decision, timestamp, comment}
  decisions       JSONB       NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_invoice  ON approval_requests (invoice_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status   ON approval_requests (status);

CREATE TRIGGER trg_approvals_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON approval_requests FOR ALL USING (true) WITH CHECK (true);


-- =============================================================================
-- TABLE: payments
-- Incoming/outgoing bank transactions (AR reconciliation).
-- =============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id        TEXT        NOT NULL UNIQUE,
  amount                NUMERIC(15, 2) NOT NULL,
  currency              TEXT        NOT NULL DEFAULT 'EUR',
  value_date            DATE        NOT NULL,
  counterparty          TEXT        NOT NULL,
  reference             TEXT,
  bank_account          TEXT,
  status                TEXT        NOT NULL DEFAULT 'unmatched'
                          CHECK (status IN (
                            'unmatched', 'matched', 'partially_matched',
                            'flagged_for_review', 'reconciled'
                          )),
  -- UUIDs of invoices this payment was matched to
  matched_invoice_ids   UUID[]      NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_value_date  ON payments (value_date DESC);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON payments FOR ALL USING (true) WITH CHECK (true);


-- =============================================================================
-- TABLE: journal_entries
-- General ledger journal entries (FX, depreciation, payroll, investments).
-- =============================================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_type    TEXT        NOT NULL
                  CHECK (entry_type IN (
                    'investment_revaluation', 'fx_difference',
                    'depreciation', 'payroll', 'accrual', 'manual'
                  )),
  entry_date    DATE        NOT NULL,
  description   TEXT        NOT NULL,
  period        TEXT,         -- 'YYYY-MM'
  source_file   TEXT,
  erp_id        TEXT,
  posted        BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Each line: {account_code, account_name, debit, credit, description, cost_centre}
  lines         JSONB       NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_je_entry_date  ON journal_entries (entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_je_period      ON journal_entries (period);
CREATE INDEX IF NOT EXISTS idx_je_type        ON journal_entries (entry_type);

CREATE TRIGGER trg_je_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON journal_entries FOR ALL USING (true) WITH CHECK (true);


-- =============================================================================
-- TABLE: cfo_reports
-- Persisted CFO summary reports generated by the Reporting Agent.
-- =============================================================================
CREATE TABLE IF NOT EXISTS cfo_reports (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  period                TEXT        NOT NULL,    -- 'YYYY-MM'
  as_of_date            DATE        NOT NULL,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  financial_snapshot    JSONB       NOT NULL DEFAULT '{}',
  ap_summary            JSONB       NOT NULL DEFAULT '{}',
  ar_summary            JSONB       NOT NULL DEFAULT '{}',
  accounting_summary    JSONB       NOT NULL DEFAULT '{}',
  alerts                JSONB       NOT NULL DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_period      ON cfo_reports (period);
CREATE INDEX IF NOT EXISTS idx_reports_generated   ON cfo_reports (generated_at DESC);

ALTER TABLE cfo_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON cfo_reports FOR ALL USING (true) WITH CHECK (true);


-- =============================================================================
-- VIEW: unified_transactions
-- Combines invoices, payments and journal entries into a single feed for the
-- React dashboard transactions table.
-- =============================================================================
CREATE OR REPLACE VIEW unified_transactions AS

  -- AP invoices (money going out)
  SELECT
    i.id::TEXT                                          AS id,
    i.invoice_date                                      AS txn_date,
    'AP'                                                AS txn_type,
    i.vendor_or_customer                                AS counterparty,
    'Invoice ' || i.invoice_number                      AS description,
    -i.amount                                           AS amount,
    i.currency,
    i.status,
    'AP Agent'                                          AS agent,
    i.invoice_number                                    AS reference,
    i.created_at
  FROM invoices i
  WHERE i.invoice_type = 'supplier'

UNION ALL

  -- AR invoices (money coming in)
  SELECT
    i.id::TEXT,
    i.invoice_date,
    'AR',
    i.vendor_or_customer,
    'Invoice ' || i.invoice_number,
    i.amount,
    i.currency,
    i.status,
    'AR Agent',
    i.invoice_number,
    i.created_at
  FROM invoices i
  WHERE i.invoice_type = 'customer'

UNION ALL

  -- Bank payments (incoming, unmatched or matched)
  SELECT
    p.id::TEXT,
    p.value_date,
    'AR',
    p.counterparty,
    COALESCE('Bank payment — ' || p.reference, 'Bank payment'),
    p.amount,
    p.currency,
    p.status,
    'AR Agent',
    COALESCE(p.reference, p.transaction_id),
    p.created_at
  FROM payments p

UNION ALL

  -- GL journal entries
  SELECT
    je.id::TEXT,
    je.entry_date,
    'GL',
    '—',
    je.description,
    COALESCE(
      (SELECT SUM((line->>'debit')::NUMERIC) FROM jsonb_array_elements(je.lines) AS line),
      0
    ),
    'EUR',
    CASE WHEN je.posted THEN 'posted' ELSE 'draft' END,
    'Accounting Agent',
    COALESCE(je.erp_id, '—'),
    je.created_at
  FROM journal_entries je

ORDER BY txn_date DESC, created_at DESC;


-- =============================================================================
-- VIEW: ap_kpi
-- Pre-computed AP KPI values used by the React dashboard.
-- =============================================================================
CREATE OR REPLACE VIEW ap_kpi AS
SELECT
  COUNT(*)                                                  AS total_invoices,
  COALESCE(SUM(amount), 0)                                  AS total_outstanding,
  COUNT(*) FILTER (WHERE status = 'pending_approval')       AS pending_approval_count,
  COUNT(*) FILTER (WHERE status = 'queued_for_payment')     AS queued_count,
  COUNT(*) FILTER (WHERE status = 'overdue'
                      OR (due_date < CURRENT_DATE
                          AND status NOT IN ('paid','rejected')))  AS overdue_count,
  COALESCE(SUM(amount) FILTER (
    WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
    AND status NOT IN ('paid','rejected')
  ), 0)                                                     AS due_this_week
FROM invoices
WHERE invoice_type = 'supplier'
  AND status NOT IN ('paid', 'rejected');


-- =============================================================================
-- VIEW: ar_kpi
-- Pre-computed AR KPI values.
-- =============================================================================
CREATE OR REPLACE VIEW ar_kpi AS
SELECT
  COUNT(*)                                                  AS total_invoices,
  COALESCE(SUM(amount), 0)                                  AS total_outstanding,
  COUNT(*) FILTER (WHERE status = 'overdue'
                      OR (due_date < CURRENT_DATE
                          AND status NOT IN ('matched','paid','rejected')))  AS overdue_count,
  COALESCE(SUM(amount) FILTER (
    WHERE invoice_date >= CURRENT_DATE - INTERVAL '30 days'
  ), 0)                                                     AS current_bucket,
  COALESCE(SUM(amount) FILTER (
    WHERE invoice_date BETWEEN CURRENT_DATE - INTERVAL '60 days'
                           AND CURRENT_DATE - INTERVAL '31 days'
  ), 0)                                                     AS aged_30_60,
  COALESCE(SUM(amount) FILTER (
    WHERE invoice_date < CURRENT_DATE - INTERVAL '60 days'
  ), 0)                                                     AS aged_60_plus,
  COUNT(*) FILTER (WHERE status IN ('unmatched','flagged_for_review'))  AS unmatched_payments
FROM invoices
WHERE invoice_type = 'customer'
  AND status NOT IN ('matched', 'paid', 'rejected');


-- =============================================================================
-- SEED DATA (optional, for development / demo)
-- Remove or comment out before deploying to production.
-- =============================================================================
INSERT INTO invoices (invoice_type, vendor_or_customer, invoice_number, amount, currency,
                      invoice_date, due_date, status, source)
VALUES
  ('supplier', 'Acme Cloud Services GmbH',  'INV-2026-0312', 18400.00, 'EUR', '2026-03-01', '2026-03-20', 'queued_for_payment', 'email'),
  ('supplier', 'Precision Parts AG',        'INV-2026-0309', 42100.00, 'EUR', '2026-03-02', '2026-03-08', 'pending_approval',   'shared_folder'),
  ('supplier', 'Apex Legal Advisors',       'INV-2026-0298',  9500.00, 'EUR', '2026-02-28', '2026-03-14', 'paid',               'email'),
  ('supplier', 'Datastream Analytics BV',  'INV-2026-0281', 28800.00, 'EUR', '2026-02-15', '2026-03-01', 'overdue',            'shared_folder'),
  ('customer', 'FinTech Alpha Ltd',         'INV-OUT-2026-0088', 95000.00, 'EUR', '2026-03-01', '2026-03-31', 'matched', 'crm'),
  ('customer', 'Nordics Venture AB',        'INV-OUT-2026-0084', 54000.00, 'EUR', '2026-02-20', '2026-03-20', 'sent',    'crm'),
  ('customer', 'Global Dynamics Corp',      'INV-OUT-2026-0081',120000.00, 'EUR', '2026-02-15', '2026-03-15', 'matched', 'crm'),
  ('customer', 'Solaris Payments SA',       'INV-OUT-2026-0077', 75000.00, 'EUR', '2026-02-10', '2026-03-10', 'matched', 'crm')
ON CONFLICT DO NOTHING;

INSERT INTO payments (transaction_id, amount, currency, value_date, counterparty, reference, status)
VALUES
  ('BANK-TXN-00441', 95000.00, 'EUR', '2026-03-03', 'FinTech Alpha Ltd',   'INV-OUT-2026-0088', 'matched'),
  ('BANK-TXN-00440', 54000.00, 'EUR', '2026-03-01', 'Nordics Venture AB',  NULL,                'flagged_for_review'),
  ('BANK-TXN-00438',120000.00, 'EUR', '2026-02-27', 'Global Dynamics Corp','INV-OUT-2026-0081', 'matched'),
  ('BANK-TXN-00435', 75000.00, 'EUR', '2026-02-25', 'Solaris Payments SA', 'INV-OUT-2026-0077', 'matched')
ON CONFLICT DO NOTHING;

INSERT INTO journal_entries (entry_type, entry_date, description, period, posted, lines)
VALUES
  ('fx_difference',    '2026-03-02', 'FX revaluation USD/EUR — 2026-03-02', '2026-03',  TRUE,
   '[{"account_code":"1020","account_name":"Bank USD","debit":1240,"credit":0},
     {"account_code":"6100","account_name":"FX Gain/Loss","debit":0,"credit":1240}]'),
  ('payroll',          '2026-02-28', 'Payroll accrual — February 2026',      '2026-02', TRUE,
   '[{"account_code":"6400","account_name":"Salary Expense","debit":105000,"credit":0},
     {"account_code":"6410","account_name":"Social Charges Expense","debit":23600,"credit":0},
     {"account_code":"2100","account_name":"Payroll Payable","debit":0,"credit":105000},
     {"account_code":"2110","account_name":"Social Charges Payable","debit":0,"credit":23600}]'),
  ('depreciation',     '2026-02-28', 'Fixed asset depreciation — Feb 2026',  '2026-02', TRUE,
   '[{"account_code":"6300","account_name":"Depreciation Expense","debit":4800,"credit":0},
     {"account_code":"1750","account_name":"Accumulated Depreciation","debit":0,"credit":4800}]'),
  ('investment_revaluation', '2026-02-28', 'Investment revaluation — MSCI World ETF', '2026-02', TRUE,
   '[{"account_code":"1500","account_name":"Financial Investments","debit":3120,"credit":0},
     {"account_code":"6200","account_name":"Investment Revaluation P&L","debit":0,"credit":3120}]')
ON CONFLICT DO NOTHING;
