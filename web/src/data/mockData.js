// ── KPI Cards ─────────────────────────────────────────────────────────────
export const kpiData = [
  {
    id: 'ap_outstanding',
    label: 'AP Outstanding',
    value: '€ 148,320',
    subValue: '23 invoices',
    trend: '+4.2%',
    trendUp: false,      // higher AP is bad → red arrow
    trendLabel: 'vs last month',
    color: 'blue',
    icon: 'file-text',
    detail: [
      { label: 'Due this week', value: '€ 42,100' },
      { label: 'Overdue', value: '€ 18,540', alert: true },
      { label: 'Awaiting approval', value: '7 invoices' },
    ],
  },
  {
    id: 'ar_aging',
    label: 'AR Aging',
    value: '€ 312,800',
    subValue: '41 invoices',
    trend: '-8.1%',
    trendUp: true,       // lower AR outstanding → improving
    trendLabel: 'vs last month',
    color: 'indigo',
    icon: 'clock',
    detail: [
      { label: '0–30 days', value: '€ 198,400' },
      { label: '31–60 days', value: '€ 78,200' },
      { label: '61+ days', value: '€ 36,200', alert: true },
    ],
  },
  {
    id: 'cash_position',
    label: 'Cash Position',
    value: '€ 2,041,500',
    subValue: 'across 3 accounts',
    trend: '+12.3%',
    trendUp: true,
    trendLabel: 'vs last month',
    color: 'emerald',
    icon: 'landmark',
    detail: [
      { label: 'EUR Main', value: '€ 1,420,000' },
      { label: 'USD Ops', value: '$ 450,000' },
      { label: 'GBP Reserve', value: '£ 130,000' },
    ],
  },
  {
    id: 'pl_status',
    label: 'P&L Status',
    value: '€ 94,200',
    subValue: 'Net income · Feb 2026',
    trend: '+22.7%',
    trendUp: true,
    trendLabel: 'vs Feb 2025',
    color: 'violet',
    icon: 'trending-up',
    detail: [
      { label: 'Revenue', value: '€ 580,000' },
      { label: 'COGS', value: '€ 214,000' },
      { label: 'OpEx', value: '€ 271,800' },
    ],
  },
]

// ── Sparkline data for KPI cards ──────────────────────────────────────────
export const sparklines = {
  ap_outstanding:  [120, 135, 118, 142, 138, 151, 148],
  ar_aging:        [340, 318, 328, 305, 322, 319, 313],
  cash_position:   [1620, 1780, 1710, 1890, 1970, 2010, 2042],
  pl_status:       [62,  55,  71,  68,  80,  77,  94],
}

// ── Transactions table ────────────────────────────────────────────────────
export const transactions = [
  {
    id: 'TXN-0041',
    date: '2026-03-03',
    type: 'AP',
    counterparty: 'Acme Cloud Services GmbH',
    description: 'SaaS subscription — March 2026',
    amount: -18400,
    currency: 'EUR',
    status: 'queued',
    agent: 'AP Agent',
    invoice: 'INV-2026-0312',
  },
  {
    id: 'TXN-0040',
    date: '2026-03-03',
    type: 'AR',
    counterparty: 'FinTech Alpha Ltd',
    description: 'Professional services — Q1 retainer',
    amount: 95000,
    currency: 'EUR',
    status: 'matched',
    agent: 'AR Agent',
    invoice: 'INV-OUT-2026-0088',
  },
  {
    id: 'TXN-0039',
    date: '2026-03-02',
    type: 'AP',
    counterparty: 'Precision Parts AG',
    description: 'Hardware components batch #7',
    amount: -42100,
    currency: 'EUR',
    status: 'pending_approval',
    agent: 'AP Agent',
    invoice: 'INV-2026-0309',
  },
  {
    id: 'TXN-0038',
    date: '2026-03-02',
    type: 'GL',
    counterparty: '—',
    description: 'FX revaluation USD/EUR — 2026-03-02',
    amount: 1240,
    currency: 'EUR',
    status: 'posted',
    agent: 'Accounting Agent',
    invoice: 'JE-2026-0128',
  },
  {
    id: 'TXN-0037',
    date: '2026-03-01',
    type: 'AR',
    counterparty: 'Nordics Venture AB',
    description: 'Licence fee Q1 2026',
    amount: 54000,
    currency: 'EUR',
    status: 'unmatched',
    agent: 'AR Agent',
    invoice: '—',
  },
  {
    id: 'TXN-0036',
    date: '2026-02-28',
    type: 'GL',
    counterparty: '—',
    description: 'Payroll accrual — February 2026',
    amount: -128600,
    currency: 'EUR',
    status: 'posted',
    agent: 'Accounting Agent',
    invoice: 'JE-2026-0124',
  },
  {
    id: 'TXN-0035',
    date: '2026-02-28',
    type: 'GL',
    counterparty: '—',
    description: 'Fixed asset depreciation — Feb 2026',
    amount: -4800,
    currency: 'EUR',
    status: 'posted',
    agent: 'Accounting Agent',
    invoice: 'JE-2026-0123',
  },
  {
    id: 'TXN-0034',
    date: '2026-02-28',
    type: 'AP',
    counterparty: 'Apex Legal Advisors',
    description: 'Legal retainer — February 2026',
    amount: -9500,
    currency: 'EUR',
    status: 'paid',
    agent: 'AP Agent',
    invoice: 'INV-2026-0298',
  },
  {
    id: 'TXN-0033',
    date: '2026-02-27',
    type: 'AR',
    counterparty: 'Global Dynamics Corp',
    description: 'Enterprise licence renewal',
    amount: 120000,
    currency: 'EUR',
    status: 'matched',
    agent: 'AR Agent',
    invoice: 'INV-OUT-2026-0081',
  },
  {
    id: 'TXN-0032',
    date: '2026-02-26',
    type: 'AP',
    counterparty: 'Datastream Analytics BV',
    description: 'Data feed licence — annual',
    amount: -28800,
    currency: 'EUR',
    status: 'overdue',
    agent: 'AP Agent',
    invoice: 'INV-2026-0281',
  },
  {
    id: 'TXN-0031',
    date: '2026-02-25',
    type: 'AR',
    counterparty: 'Solaris Payments SA',
    description: 'Implementation services milestone 2',
    amount: 75000,
    currency: 'EUR',
    status: 'matched',
    agent: 'AR Agent',
    invoice: 'INV-OUT-2026-0077',
  },
  {
    id: 'TXN-0030',
    date: '2026-02-24',
    type: 'GL',
    counterparty: '—',
    description: 'Investment revaluation — MSCI World ETF',
    amount: 3120,
    currency: 'EUR',
    status: 'posted',
    agent: 'Accounting Agent',
    invoice: 'JE-2026-0118',
  },
]

// ── Revenue vs Expenses chart data (monthly) ──────────────────────────────
export const revenueExpensesData = [
  { month: 'Sep', revenue: 410, expenses: 338 },
  { month: 'Oct', revenue: 445, expenses: 352 },
  { month: 'Nov', revenue: 468, expenses: 361 },
  { month: 'Dec', revenue: 502, expenses: 390 },
  { month: 'Jan', revenue: 521, expenses: 408 },
  { month: 'Feb', revenue: 580, expenses: 486 },
]

// ── AP Aging buckets ──────────────────────────────────────────────────────
export const apAgingData = [
  { bucket: '0–15d', amount: 58200 },
  { bucket: '16–30d', amount: 41800 },
  { bucket: '31–45d', amount: 29400 },
  { bucket: '46–60d', amount: 12380 },
  { bucket: '60d+', amount: 6540 },
]

// ── Pending approvals (for sidebar badge / panel) ─────────────────────────
export const pendingApprovals = [
  { id: 'APR-081', vendor: 'Precision Parts AG', amount: '€ 42,100', due: '2026-03-08', urgency: 'high' },
  { id: 'APR-082', vendor: 'Acme Cloud Services GmbH', amount: '€ 18,400', due: '2026-03-10', urgency: 'medium' },
  { id: 'APR-083', vendor: 'Datastream Analytics BV', amount: '€ 28,800', due: '2026-03-04', urgency: 'high' },
]

// ── Alerts ────────────────────────────────────────────────────────────────
export const alerts = [
  { id: 1, level: 'error',   message: '3 supplier invoices are overdue', agent: 'AP Agent' },
  { id: 2, level: 'warning', message: '1 unmatched bank payment requires review', agent: 'AR Agent' },
  { id: 3, level: 'info',    message: 'Monthly close report ready for download', agent: 'Reporting Agent' },
]

// ── AP invoices (supplier) ─────────────────────────────────────────────────
export const apInvoices = [
  { id: 'INV-2026-0312', vendor: 'Acme Cloud Services GmbH',  amount: 18400,  currency: 'EUR', date: '2026-03-01', due: '2026-03-10', status: 'pending_approval', approvedBy: ['J. Müller'] },
  { id: 'INV-2026-0309', vendor: 'Precision Parts AG',         amount: 42100,  currency: 'EUR', date: '2026-02-28', due: '2026-03-08', status: 'pending_approval', approvedBy: [] },
  { id: 'INV-2026-0298', vendor: 'Apex Legal Advisors',        amount: 9500,   currency: 'EUR', date: '2026-02-25', due: '2026-02-28', status: 'paid',             approvedBy: ['J. Müller', 'T. Weber'] },
  { id: 'INV-2026-0281', vendor: 'Datastream Analytics BV',   amount: 28800,  currency: 'EUR', date: '2026-02-15', due: '2026-02-26', status: 'overdue',          approvedBy: ['M. Schmidt'] },
  { id: 'INV-2026-0277', vendor: 'TechStack Solutions Ltd',    amount: 15600,  currency: 'EUR', date: '2026-02-10', due: '2026-03-15', status: 'approved',         approvedBy: ['M. Schmidt', 'T. Weber'] },
  { id: 'INV-2026-0265', vendor: 'Nordic Freight GmbH',        amount: 6200,   currency: 'EUR', date: '2026-02-05', due: '2026-03-20', status: 'queued',           approvedBy: ['J. Müller', 'T. Weber'] },
  { id: 'INV-2026-0251', vendor: 'Office Supplies Co.',        amount: 1840,   currency: 'EUR', date: '2026-02-01', due: '2026-02-28', status: 'paid',             approvedBy: ['M. Schmidt', 'J. Müller'] },
  { id: 'INV-2026-0244', vendor: 'CloudHost Pro GmbH',         amount: 3200,   currency: 'EUR', date: '2026-01-28', due: '2026-02-28', status: 'draft',            approvedBy: [] },
  { id: 'INV-2026-0238', vendor: 'Vertex Manufacturing AG',    amount: 54300,  currency: 'EUR', date: '2026-01-20', due: '2026-02-20', status: 'overdue',          approvedBy: [] },
  { id: 'INV-2026-0231', vendor: 'Global IT Services BV',      amount: 11200,  currency: 'EUR', date: '2026-01-15', due: '2026-02-15', status: 'paid',             approvedBy: ['T. Weber', 'M. Schmidt'] },
]

// ── AR invoices (customer outgoing) ───────────────────────────────────────
export const arInvoices = [
  { id: 'INV-OUT-2026-0088', customer: 'FinTech Alpha Ltd',     amount: 95000,  currency: 'EUR', date: '2026-03-01', due: '2026-03-31', status: 'sent',            paidAmount: 0 },
  { id: 'INV-OUT-2026-0084', customer: 'Nordics Venture AB',    amount: 54000,  currency: 'EUR', date: '2026-02-28', due: '2026-03-28', status: 'partially_paid',  paidAmount: 27000 },
  { id: 'INV-OUT-2026-0081', customer: 'Global Dynamics Corp',  amount: 120000, currency: 'EUR', date: '2026-02-25', due: '2026-03-25', status: 'matched',         paidAmount: 120000 },
  { id: 'INV-OUT-2026-0077', customer: 'Solaris Payments SA',   amount: 75000,  currency: 'EUR', date: '2026-02-20', due: '2026-03-20', status: 'matched',         paidAmount: 75000 },
  { id: 'INV-OUT-2026-0071', customer: 'MediaFlow GmbH',        amount: 32000,  currency: 'EUR', date: '2026-02-10', due: '2026-03-10', status: 'overdue',         paidAmount: 0 },
  { id: 'INV-OUT-2026-0064', customer: 'Atlas Ventures BV',     amount: 18500,  currency: 'EUR', date: '2026-02-01', due: '2026-03-01', status: 'overdue',         paidAmount: 0 },
  { id: 'INV-OUT-2026-0059', customer: 'Quantum Retail GmbH',   amount: 44000,  currency: 'EUR', date: '2026-01-25', due: '2026-02-25', status: 'paid',            paidAmount: 44000 },
  { id: 'INV-OUT-2026-0051', customer: 'EuroTech Partners',     amount: 88000,  currency: 'EUR', date: '2026-01-15', due: '2026-02-15', status: 'paid',            paidAmount: 88000 },
]

// ── Bank payments (incoming) ───────────────────────────────────────────────
export const bankPayments = [
  { id: 'PAY-0041', date: '2026-03-03', counterparty: 'FinTech Alpha Ltd',    amount: 95000,  currency: 'EUR', reference: 'INV-OUT-2026-0088', status: 'matched',           matchedInvoice: 'INV-OUT-2026-0088' },
  { id: 'PAY-0040', date: '2026-03-02', counterparty: 'Nordics Venture AB',   amount: 27000,  currency: 'EUR', reference: 'NV-PARTIAL-FEB',    status: 'partially_matched', matchedInvoice: 'INV-OUT-2026-0084' },
  { id: 'PAY-0039', date: '2026-03-01', counterparty: 'Global Dynamics Corp', amount: 120000, currency: 'EUR', reference: 'GDC-ENT-2026-Q1',   status: 'matched',           matchedInvoice: 'INV-OUT-2026-0081' },
  { id: 'PAY-0038', date: '2026-02-28', counterparty: 'Unknown Sender',       amount: 54000,  currency: 'EUR', reference: '—',                  status: 'unmatched',         matchedInvoice: null },
  { id: 'PAY-0037', date: '2026-02-25', counterparty: 'Solaris Payments SA',  amount: 75000,  currency: 'EUR', reference: 'SOL-Q1-MILE2',       status: 'matched',           matchedInvoice: 'INV-OUT-2026-0077' },
  { id: 'PAY-0036', date: '2026-02-10', counterparty: 'Anonymous Transfer',   amount: 12000,  currency: 'EUR', reference: 'AT-2026-02-10',      status: 'unmatched',         matchedInvoice: null },
  { id: 'PAY-0035', date: '2026-02-05', counterparty: 'Quantum Retail GmbH',  amount: 44000,  currency: 'EUR', reference: 'QR-INV-0059',        status: 'matched',           matchedInvoice: 'INV-OUT-2026-0059' },
  { id: 'PAY-0034', date: '2026-01-28', counterparty: 'EuroTech Partners',    amount: 88000,  currency: 'EUR', reference: 'ET-2026-0051',        status: 'matched',           matchedInvoice: 'INV-OUT-2026-0051' },
]

// ── Journal entries ────────────────────────────────────────────────────────
export const journalEntries = [
  { id: 'JE-2026-0128', date: '2026-03-02', type: 'FX',           description: 'FX revaluation USD/EUR — 2026-03-02',   debitAccount: 'USD Cash Account',        creditAccount: 'FX Gains',               amount: 1240,   currency: 'EUR', status: 'posted' },
  { id: 'JE-2026-0124', date: '2026-02-28', type: 'Payroll',      description: 'Payroll accrual — February 2026',        debitAccount: 'Salary Expense',          creditAccount: 'Accrued Payroll',        amount: 128600, currency: 'EUR', status: 'posted' },
  { id: 'JE-2026-0123', date: '2026-02-28', type: 'Depreciation', description: 'Fixed asset depreciation — Feb 2026',    debitAccount: 'Depreciation Expense',    creditAccount: 'Accum. Depreciation',    amount: 4800,   currency: 'EUR', status: 'posted' },
  { id: 'JE-2026-0121', date: '2026-02-26', type: 'Accrual',      description: 'Q1 marketing accrual',                   debitAccount: 'Marketing Expense',       creditAccount: 'Accrued Liabilities',    amount: 22000,  currency: 'EUR', status: 'pending' },
  { id: 'JE-2026-0118', date: '2026-02-24', type: 'Revaluation',  description: 'Investment revaluation — MSCI World ETF',debitAccount: 'Investments',             creditAccount: 'Unrealised Gains',       amount: 3120,   currency: 'EUR', status: 'posted' },
  { id: 'JE-2026-0115', date: '2026-02-20', type: 'Accrual',      description: 'Software subscription accrual',          debitAccount: 'IT Expense',              creditAccount: 'Accrued Liabilities',    amount: 8400,   currency: 'EUR', status: 'pending' },
  { id: 'JE-2026-0108', date: '2026-02-15', type: 'FX',           description: 'FX revaluation GBP/EUR — 2026-02-15',   debitAccount: 'GBP Cash Account',        creditAccount: 'FX Gains',               amount: 520,    currency: 'EUR', status: 'posted' },
  { id: 'JE-2026-0101', date: '2026-02-01', type: 'Depreciation', description: 'Software amortisation — Jan 2026',       debitAccount: 'Amortisation Expense',    creditAccount: 'Accum. Amortisation',    amount: 2400,   currency: 'EUR', status: 'posted' },
  { id: 'JE-2026-0095', date: '2026-01-31', type: 'Payroll',      description: 'Payroll accrual — January 2026',         debitAccount: 'Salary Expense',          creditAccount: 'Accrued Payroll',        amount: 126800, currency: 'EUR', status: 'posted' },
  { id: 'JE-2026-0090', date: '2026-01-28', type: 'FX',           description: 'FX revaluation CHF/EUR — 2026-01-28',   debitAccount: 'CHF Cash Account',        creditAccount: 'FX Losses',              amount: 240,    currency: 'EUR', status: 'posted' },
]

// ── Monthly close checklist ────────────────────────────────────────────────
export const monthlyCloseChecklist = [
  { id: 1, task: 'All AP invoices processed & approved', done: true,  agent: 'AP Agent' },
  { id: 2, task: 'Bank reconciliation completed',        done: true,  agent: 'AR Agent' },
  { id: 3, task: 'Payroll accrual posted',               done: true,  agent: 'Accounting Agent' },
  { id: 4, task: 'Fixed asset depreciation posted',      done: true,  agent: 'Accounting Agent' },
  { id: 5, task: 'FX revaluation completed',             done: true,  agent: 'Accounting Agent' },
  { id: 6, task: 'AR aging review',                      done: false, agent: 'AR Agent' },
  { id: 7, task: 'Intercompany reconciliation',          done: false, agent: 'Accounting Agent' },
  { id: 8, task: 'CFO report generated',                 done: false, agent: 'Reporting Agent' },
  { id: 9, task: 'Management sign-off',                  done: false, agent: 'Manual' },
]
