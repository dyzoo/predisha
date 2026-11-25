import type { BetEvent } from './types'

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function searchTerms(query: string): string[] {
  return normalizeSearchText(query).split(' ').filter(Boolean)
}

export function betEventSearchText(event: BetEvent): string {
  return normalizeSearchText(
    [
      event.home.name,
      event.home.short,
      event.away.name,
      event.away.short,
      `${event.home.name} vs ${event.away.name}`,
      `${event.home.short} vs ${event.away.short}`,
      event.competition,
      event.sport,
    ].join(' '),
  )
}

export function matchesBetEventQuery(event: BetEvent, query: string): boolean {
  const terms = searchTerms(query)
  if (terms.length === 0) return true
  const haystack = betEventSearchText(event)
  return terms.every(term => haystack.includes(term))
}

export function searchBetEvents(events: BetEvent[], query: string, limit = 6): BetEvent[] {
  if (searchTerms(query).length === 0) return []
  return events.filter(event => matchesBetEventQuery(event, query)).slice(0, limit)
}
