import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import AccountsPayable from './pages/AccountsPayable'
import AccountsReceivable from './pages/AccountsReceivable'
import AccountingClose from './pages/AccountingClose'
import Reports from './pages/Reports'
import Placeholder from './pages/Placeholder'

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/ap"         element={<AccountsPayable />} />
          <Route path="/ar"         element={<AccountsReceivable />} />
          <Route path="/accounting" element={<AccountingClose />} />
          <Route path="/reports" element={<Reports />} />
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
