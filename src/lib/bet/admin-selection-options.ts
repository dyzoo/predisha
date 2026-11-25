import { formatKickoffLabel } from './format'
import { marketNameForId, oddsForProbability } from './odds'
import { RANDOM_MARKET_SPECS } from './random-teams'
import { hashString, mulberry32 } from './random-pure'
import type { BetMarketId } from './types'

export interface AdminSelectionOption {
  id: string
  label: string
  probability: number
  odds: string
}

export interface AdminMarketOption {
  id: string
  name: string
  options: AdminSelectionOption[]
}

const groupedMarkets = new Map<string, AdminMarketOption>()
for (const spec of RANDOM_MARKET_SPECS) {
  let market = groupedMarkets.get(spec.marketId)
  if (!market) {
    market = {
      id: spec.marketId,
      name: marketNameForId(spec.marketId as BetMarketId),
      options: [],
    }
    groupedMarkets.set(spec.marketId, market)
  }
  market.options.push({
    id: spec.selectionId,
    label: spec.selectionLabel,
    probability: spec.probability,
    odds: oddsForProbability(spec.probability).toFixed(2),
  })
}

export const ADMIN_MARKET_OPTIONS: AdminMarketOption[] = [...groupedMarkets.values()]

export function findAdminMarketOption(marketId: string): AdminMarketOption | undefined {
  return ADMIN_MARKET_OPTIONS.find(market => market.id === marketId)
}

export function findAdminSelectionOption(
  marketId: string,
  selectionId: string,
): AdminSelectionOption | undefined {
  return findAdminMarketOption(marketId)?.options.find(option => option.id === selectionId)
}

export function splitFixtureLabel(label: string): { home: string; away: string } {
  const parts = label.split(/\s+vs\s+/i)
  if (parts.length < 2) return { home: label.trim(), away: '' }
  return { home: parts[0]?.trim() ?? '', away: parts.slice(1).join(' vs ').trim() }
}

export function combineFixtureLabel(home: string, away: string): string {
  return `${home.trim()} vs ${away.trim()}`
}

const EAT_OFFSET_MINUTES = 3 * 60

export function toDateTimeInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() + EAT_OFFSET_MINUTES * 60_000).toISOString().slice(0, 16)
}

export function fromDateTimeInputValue(value: string, fallbackMinutes = 30): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (match) {
    const [, year, month, day, hour, minute] = match
    const epoch = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    )
    if (!Number.isNaN(epoch)) {
      return new Date(epoch - EAT_OFFSET_MINUTES * 60_000).toISOString()
    }
  }
  return new Date(Date.now() + fallbackMinutes * 60_000).toISOString()
}

export function editableFixtureId(prefix: string, home: string, away: string, index: number): string {
  const slug = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24)
  const random = mulberry32(hashString(`${prefix}:${home}:${away}:${index}`))
  const suffix = Math.floor(random() * 1_000_000).toString(36)
  return `${slug(prefix) || 'custom'}-${slug(home) || 'home'}-${slug(away) || 'away'}-${suffix}`
}

export function kickoffLabelFor(iso: string): string {
  return formatKickoffLabel(iso)
}
