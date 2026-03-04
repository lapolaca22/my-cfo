import TopBar from '../components/TopBar'
import KPICard from '../components/KPICard'
import AlertsBanner from '../components/AlertsBanner'
import RevenueChart from '../components/RevenueChart'
import APAgingChart from '../components/APAgingChart'
import PendingApprovals from '../components/PendingApprovals'
import TransactionsTable from '../components/TransactionsTable'
import { useKPIs } from '../hooks/useKPIs'
import { useTransactions } from '../hooks/useTransactions'
import { useApprovals } from '../hooks/useApprovals'
import { isConfigured } from '../lib/supabase'
import { Database, Wifi, WifiOff } from 'lucide-react'
import clsx from 'clsx'

function ConnectionBadge() {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border',
        isConfigured
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-amber-50 border-amber-200 text-amber-700'
      )}
    >
      {isConfigured
        ? <><Wifi className="w-3 h-3" /> Live — Supabase connected</>
        : <><WifiOff className="w-3 h-3" /> Mock data — configure VITE_SUPABASE_URL to connect</>
      }
    </div>
  )
}

export default function Overview() {
  const { kpis, sparklines, loading: kpisLoading } = useKPIs()
  const { data: transactions, loading: txLoading }  = useTransactions({ limit: 50 })
  const { data: approvals, loading: appLoading }    = useApprovals()

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <TopBar
        title="CFO Dashboard"
        subtitle="Finance Automation · All Agents · Feb 2026"
      />

      <main className="flex-1 px-8 py-6 space-y-6 max-w-[1400px] w-full mx-auto">
        {/* Connection status */}
        <div className="flex items-center justify-between">
          <ConnectionBadge />
          {kpisLoading && (
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin inline-block" />
              Syncing…
            </span>
          )}
        </div>

        {/* Alerts */}
        <AlertsBanner />

        {/* KPI Cards */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {kpis.map(kpi => (
              <KPICard key={kpi.id} kpi={kpi} loading={kpisLoading} />
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

        {/* Transactions + pending approvals */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2">
            <TransactionsTable
              maxRows={6}
              data={isConfigured ? transactions : undefined}
              loading={isConfigured ? txLoading : false}
            />
          </div>
          <div>
            <PendingApprovals
              data={isConfigured ? approvals : undefined}
              loading={isConfigured ? appLoading : false}
            />
          </div>
        </section>
      </main>
    </div>
  )
}
