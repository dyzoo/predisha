'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Check,
  ChevronDown,
  CircleAlert,
  Loader2,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { formatOdds, formatTzs } from '@/lib/bet/format'
import { MIN_STAKE_MINOR, type BetTicketView } from '@/lib/bet/types'
import { BrandLogo } from '@/components/brand-logo'
import { useBetSlip } from './bet-slip-provider'

const QUICK_STAKES = [1_000, 5_000, 10_000, 50_000]

export function BetSlipDock() {
  const router = useRouter()
  const {
    viewer,
    items,
    stakeMinor,
    setStakeMinor,
    removeSelection,
    clear,
    totalOdds,
    potentialReturnMinor,
    placeBet,
    placing,
    slipOpen: open,
    openSlip,
    closeSlip,
  } = useBetSlip()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<BetTicketView | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const displayOdds = success ? success.totalOdds : totalOdds

  if (items.length === 0 && !success && !open) return null

  async function onPlace() {
    setError(null)
    setShareUrl(null)
    const result = await placeBet()
    if (!result.ok) {
      setError(result.error ?? 'Could not place the bet.')
      return
    }
    setSuccess(result.ticket ?? null)
    openSlip()
    router.refresh()
  }

  async function onShare() {
    setError(null)
    setSharing(true)
    try {
      const response = await fetch('/api/bet/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selections: items.map(item => ({
            fixtureId: item.fixtureId,
            marketId: item.marketId,
            selectionId: item.selectionId,
            odds: item.odds,
          })),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        share?: { url?: string }
      }
      if (!response.ok || !payload.share?.url) {
        setError(payload.error ?? 'Could not create a share link.')
        return
      }
      const absolute =
        typeof window === 'undefined' ? payload.share.url : `${window.location.origin}${payload.share.url}`
      setShareUrl(absolute)
      try {
        await navigator.clipboard.writeText(absolute)
      } catch {
        // Clipboard access is optional; the link is shown below.
      }
    } catch {
      setError('Network error while creating the share link.')
    } finally {
      setSharing(false)
    }
  }

  function resetSuccess() {
    setSuccess(null)
    setShareUrl(null)
    closeSlip()
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={openSlip}
          className="receipt-paper receipt-dock fixed inset-x-3 bottom-20 z-40 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 lg:inset-x-auto lg:bottom-6 lg:left-1/2 lg:w-[520px] lg:-translate-x-1/2"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-accent px-2 text-sm font-black tabular-nums text-background">
              {items.length}
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-accent">
                Bet slip
              </span>
              <span className="block truncate text-sm font-bold text-main-text">
                {items.length} selection{items.length === 1 ? '' : 's'}
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-text">
              Total odds
            </span>
            <span className="font-mono text-lg font-black tabular-nums text-accent">
              {formatOdds(totalOdds)}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-text" />
          </span>
        </button>
      ) : null}

      {open ? (
        <section
          aria-label="Bet slip"
          className="fixed inset-x-0 bottom-16 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px]"
        >
          <div className="receipt-paper receipt-sheet flex max-h-[82vh] flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto rounded-t-[19px] px-4 pb-8 pt-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <BrandLogo surface="light" className="h-4 w-auto" />
                  <h2 className="mt-1 truncate font-display text-xl font-semibold">
                    {success ? 'Bet accepted' : 'Bet slip'}
                  </h2>
                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-text">
                    Official bet receipt
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-text">
                      Total odds
                    </p>
                    <p className="font-mono text-lg font-black tabular-nums text-accent">
                      {formatOdds(displayOdds)}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] font-semibold text-muted-text">
                      {success ? success.code : `SLIP-${String(items.length).padStart(3, '0')}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (success) resetSuccess()
                      else closeSlip()
                    }}
                    aria-label="Close bet slip"
                    className="rounded-lg p-1.5 text-muted-text transition-colors hover:bg-elevated-surface hover:text-main-text"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="receipt-rule my-3" />

          {success ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/10 p-4">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div className="text-sm">
                  <p className="font-semibold text-main-text">Ticket {success.code}</p>
                  <p className="mt-1 text-muted-text">
                    {formatTzs(success.stakeMinor)} at {formatOdds(success.totalOdds)} · potential
                    return {formatTzs(success.potentialReturnMinor)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/bet/bets"
                  onClick={resetSuccess}
                  className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-semibold text-background"
                >
                  View my bets
                </Link>
                <button
                  type="button"
                  onClick={resetSuccess}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-text hover:text-main-text"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="receipt-item mt-4 border-dashed p-6 text-center">
              <p className="text-sm font-semibold text-main-text">Your bet slip is empty</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-text">
                Add selections from the sportsbook to build a bet.
              </p>
              <Link
                href="/bet/sports"
                onClick={closeSlip}
                className="mt-4 inline-block rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-background"
              >
                Browse fixtures
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-3 max-h-[42vh] space-y-2 overflow-y-auto pr-1">
                {items.map(item => (
                  <div key={item.key} className="receipt-item">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-main-text">
                          {item.fixtureLabel}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-text">
                          {item.marketName} · {item.selectionLabel}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-md bg-accent/15 px-2 py-1 text-xs font-bold text-accent tabular-nums">
                          {formatOdds(item.odds)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSelection(item.key)}
                          aria-label={`Remove ${item.selectionLabel}`}
                          className="rounded-md p-1 text-muted-text hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label htmlFor="bet-stake" className="text-xs font-medium text-muted-text">
                  Stake (TZS)
                </label>
                <div className="mt-1.5 flex items-center rounded-xl border border-border bg-white/50 px-3 focus-within:border-accent/60">
                  <input
                    id="bet-stake"
                    type="number"
                    min={MIN_STAKE_MINOR}
                    step={500}
                    value={stakeMinor}
                    onChange={event => setStakeMinor(Number(event.target.value))}
                    className="w-full bg-transparent py-2.5 text-sm font-semibold tabular-nums text-main-text outline-none"
                  />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {QUICK_STAKES.map(amount => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setStakeMinor(amount)}
                      className="rounded-lg border border-border bg-white/30 px-2 py-1.5 text-[11px] font-semibold text-muted-text transition-colors hover:border-accent/40 hover:text-accent"
                    >
                      {formatTzs(amount)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="receipt-summary mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-text">
                  <span>Total odds</span>
                  <span className="font-mono font-semibold text-main-text tabular-nums">
                    {formatOdds(totalOdds)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-text">
                  <span>Potential return</span>
                  <span className="font-mono font-semibold text-accent tabular-nums">
                    {formatTzs(potentialReturnMinor)}
                  </span>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-xl border border-red-700/25 bg-red-700/10 px-3 py-2 text-xs text-red-800"
                >
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              ) : null}

              {shareUrl ? (
                <div className="mt-3 rounded-xl border border-accent/25 bg-accent/10 p-3 text-xs text-accent">
                  Share link copied: <span className="break-all font-semibold">{shareUrl}</span>
                </div>
              ) : null}

              {viewer.userId ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={onPlace}
                    disabled={placing}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {placing ? 'Placing…' : `Place bet · ${formatTzs(stakeMinor)}`}
                  </button>
                  <button
                    type="button"
                    onClick={onShare}
                    disabled={sharing}
                    aria-label="Create share link"
                    className="rounded-xl border border-border px-3 text-muted-text transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-60"
                  >
                    {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  </button>
                </div>
              ) : (
                <Link
                  href="/sign-in?next=/bet"
                  className="mt-4 block rounded-xl bg-accent px-4 py-3 text-center text-sm font-bold text-background"
                >
                  Sign in to place this bet
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  clear()
                  closeSlip()
                }}
                className="mt-2 w-full rounded-xl px-4 py-2 text-xs font-medium text-muted-text hover:text-red-700"
              >
                Clear slip
              </button>
            </>
          )}

              <div className="receipt-rule mt-4" />
              <div className="pb-1 pt-3 text-center">
                <div className="receipt-barcode" aria-hidden />
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-accent">
                  {success ? 'Bet accepted' : items.length === 0 ? 'Add selections' : 'Good luck'}
                </p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-text">
                  PredishaBet · EAT
                </p>
              </div>
            </div>
            <span aria-hidden className="receipt-tear" />
          </div>
        </section>
      ) : null}
    </>
  )
}
