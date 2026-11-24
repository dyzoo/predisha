import { CalendarClock, CircleAlert, CircleCheck, Clock3, Database, Radio, TriangleAlert } from 'lucide-react'

export type StatusKind =
  | 'LIVE'
  | 'UPCOMING'
  | 'FINISHED'
  | 'DEMO'
  | 'ESTIMATED'
  | 'STALE'
  | 'UNAVAILABLE'
  | 'NO_SELECTION'

const config: Record<StatusKind, { label: string; className: string; icon: typeof Radio }> = {
  LIVE: { label: 'Live', className: 'border-red-400/30 bg-red-400/10 text-red-300', icon: Radio },
  UPCOMING: { label: 'Upcoming', className: 'intel-chip', icon: CalendarClock },
  FINISHED: { label: 'Full time', className: 'intel-chip', icon: CircleCheck },
  DEMO: { label: 'Demo data', className: 'border-amber-300/30 bg-amber-300/10 text-amber-200', icon: TriangleAlert },
  ESTIMATED: { label: 'Model estimate', className: 'border-accent-line bg-accent-soft text-accent', icon: Database },
  STALE: { label: 'Stale data', className: 'border-amber-300/30 bg-amber-300/10 text-amber-200', icon: Clock3 },
  UNAVAILABLE: { label: 'Unavailable', className: 'intel-chip', icon: CircleAlert },
  NO_SELECTION: { label: 'No selection', className: 'intel-chip', icon: CircleAlert },
}

export function StatusBadge({ kind, label }: { kind: StatusKind; label?: string }) {
  const item = config[kind]
  const Icon = item.icon

  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${item.className}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="min-w-0 leading-tight">{label ?? item.label}</span>
    </span>
  )
}
