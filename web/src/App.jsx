import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import Placeholder from './pages/Placeholder'

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route
            path="/ap"
            element={
              <Placeholder
                title="Accounts Payable"
                subtitle="AP Agent · Invoices, approvals, payment queue"
              />
            }
          />
          <Route
            path="/ar"
            element={
              <Placeholder
                title="Accounts Receivable"
                subtitle="AR Agent · CRM sync, bank reconciliation"
              />
            }
          />
          <Route
            path="/accounting"
            element={
              <Placeholder
                title="Accounting & Close"
                subtitle="Accounting Agent · Journal entries, depreciation, payroll"
              />
            }
          />
          <Route
            path="/reports"
            element={
              <Placeholder
                title="Reports"
                subtitle="Reporting Agent · CFO summary, P&L, balance sheet"
              />
            }
          />
          <Route
            path="/settings"
            element={
              <Placeholder
                title="Settings"
                subtitle="Agent configuration, ERP connections, user management"
              />
            }
          />
        </Routes>
      </div>
    </div>
  )
}
