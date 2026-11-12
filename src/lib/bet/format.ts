import { BET_CURRENCY } from './types'

const tzs = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: BET_CURRENCY,
  currencyDisplay: 'code',
  maximumFractionDigits: 0,
})

const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const timeOnly = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatTzs(minor: number): string {
  return tzs.format(Math.round(minor)).replace(/\u00a0/g, ' ')
}

export function formatOdds(odds: number): string {
  if (!Number.isFinite(odds)) return '—'
  return odds.toFixed(2)
}

export function formatMultiplier(multiplier: number): string {
  if (!Number.isFinite(multiplier)) return '—'
  return `${multiplier.toFixed(2)}x`
}

export function formatDateTimeLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${dateTime.format(date)} UTC`
}

export function formatKickoffLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${dateTime.format(date)} UTC`
}

export function formatTimeLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${timeOnly.format(date)} UTC`
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'SCHEDULED':
      return 'Upcoming'
    case 'LIVE':
      return 'Live'
    case 'FINISHED':
      return 'Finished'
    case 'POSTPONED':
      return 'Postponed'
    case 'CANCELLED':
      return 'Cancelled'
    case 'ABANDONED':
      return 'Abandoned'
    case 'OPEN':
      return 'Open'
    case 'WON':
      return 'Won'
    case 'LOST':
      return 'Lost'
    case 'VOID':
      return 'Void'
    case 'CASHED_OUT':
      return 'Cashed out'
    default:
      return status
  }
}

export function transactionLabel(type: string): string {
  switch (type) {
    case 'DEPOSIT':
      return 'Sandbox deposit'
    case 'WITHDRAWAL':
      return 'Sandbox withdrawal'
    case 'BET_STAKE':
      return 'Bet stake'
    case 'BET_WIN':
      return 'Bet payout'
    case 'BET_CASHOUT':
      return 'Cash out'
    case 'PROMO_BONUS':
      return 'Promo bonus'
    case 'GAME_STAKE':
      return 'Game stake'
    case 'GAME_WIN':
      return 'Game payout'
    default:
      return type
  }
}

export function signedTzs(minor: number): string {
  const sign = minor > 0 ? '+' : minor < 0 ? '−' : ''
  return `${sign}${formatTzs(Math.abs(minor))}`
}
