import TopBar from '../components/TopBar'
import KPICard from '../components/KPICard'
import AlertsBanner from '../components/AlertsBanner'
import RevenueChart from '../components/RevenueChart'
import APAgingChart from '../components/APAgingChart'
import PendingApprovals from '../components/PendingApprovals'
import TransactionsTable from '../components/TransactionsTable'
import { kpiData } from '../data/mockData'

export default function Overview() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <TopBar
        title="CFO Dashboard"
        subtitle="Finance Automation · All Agents · Feb 2026"
      />

      <main className="flex-1 px-8 py-6 space-y-6 max-w-[1400px] w-full mx-auto">
        {/* Alerts */}
        <AlertsBanner />

        {/* KPI Cards */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {kpiData.map(kpi => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        {/* Charts row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <div>
            <APAgingChart />
          </div>
        </section>

        {/* Bottom row: transactions + pending approvals */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2">
            <TransactionsTable maxRows={6} />
          </div>
          <div>
            <PendingApprovals />
          </div>
        </section>
      </main>
    </div>
  )
}
