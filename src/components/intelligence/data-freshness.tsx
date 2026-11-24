import { Database, Radio, TriangleAlert } from 'lucide-react'
import type { ProviderHealth } from '@/lib/sports/provider'

export function DataFreshness({ health, isDemo }: { health: ProviderHealth; isDemo: boolean }) {
  const tone = isDemo || !health.ok ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-accent-line bg-accent-soft text-accent'
  const Icon = isDemo || !health.ok ? TriangleAlert : health.mode === 'live' ? Radio : Database

  return (
    <span className={`inline-flex max-w-full items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-snug ${tone}`} title={health.message}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="font-bold uppercase tracking-[0.1em]">{isDemo ? 'Demo data' : health.mode}</span>
        <span className="ml-1.5 hidden opacity-80 sm:inline">{health.message}</span>
      </span>
    </span>
  )
}
