import type { BetEvent } from '@/lib/bet/types'
import { EventCard } from './event-card'

export function EventGrid({
  events,
  emptyTitle = 'No fixtures found',
  emptyMessage = 'Try another sport, day or search term.',
}: {
  events: BetEvent[]
  emptyTitle?: string
  emptyMessage?: string
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-10 text-center">
        <p className="font-display text-lg font-semibold">{emptyTitle}</p>
        <p className="mt-1 text-sm text-muted-text">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  )
}
