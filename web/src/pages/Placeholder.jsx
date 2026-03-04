import TopBar from '../components/TopBar'
import { Construction } from 'lucide-react'

export default function Placeholder({ title, subtitle }) {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <TopBar title={title} subtitle={subtitle} />
      <main className="flex-1 flex items-center justify-center px-8 py-16">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-brand-50 border border-brand-100 mb-5">
            <Construction className="w-7 h-7 text-brand-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">{title}</h2>
          <p className="text-sm text-slate-400 max-w-sm">
            This page is ready for implementation. Wire it up to the{' '}
            <code className="font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-lg text-xs">
              {title.toLowerCase().replace(/ /g, '_')}
            </code>{' '}
            agent.
          </p>
        </div>
      </main>
    </div>
  )
}
