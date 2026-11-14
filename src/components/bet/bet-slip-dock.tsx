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
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-bold text-background shadow-2xl shadow-accent/20 lg:bottom-6 lg:right-6"
        >
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1 text-[11px] text-accent">
            {items.length}
          </span>
          Bet slip
          <span className="tabular-nums">@ {formatOdds(totalOdds)}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      ) : null}

      {open ? (
        <section
          aria-label="Bet slip"
          className="fixed inset-x-0 bottom-16 z-50 max-h-[78vh] overflow-y-auto rounded-t-3xl border border-border bg-surface p-4 shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-h-[80vh] sm:w-[390px] sm:rounded-3xl"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                Bet slip
              </p>
              <h2 className="font-display text-lg font-semibold">
                {success ? 'Bet placed' : `${items.length} selection${items.length === 1 ? '' : 's'}`}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                if (success) resetSuccess()
                else closeSlip()
              }}
              aria-label="Close bet slip"
              className="rounded-lg p-2 text-muted-text transition-colors hover:bg-elevated-surface hover:text-main-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

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
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-background/40 p-6 text-center">
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
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {items.map(item => (
                  <div
                    key={item.key}
                    className="rounded-xl border border-border bg-background/40 p-3"
                  >
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
                          className="rounded-md p-1 text-muted-text hover:text-red-300"
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
                <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
                  <input
                    id="bet-stake"
                    type="number"
                    min={MIN_STAKE_MINOR}
                    step={500}
                    value={stakeMinor}
                    onChange={event => setStakeMinor(Number(event.target.value))}
                    className="w-full bg-transparent py-2.5 text-sm font-semibold tabular-nums outline-none"
                  />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {QUICK_STAKES.map(amount => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setStakeMinor(amount)}
                      className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold text-muted-text transition-colors hover:border-accent/40 hover:text-accent"
                    >
                      {formatTzs(amount)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-1.5 rounded-xl bg-background/40 p-3 text-sm">
                <div className="flex justify-between text-muted-text">
                  <span>Total odds</span>
                  <span className="font-semibold text-main-text tabular-nums">
                    {formatOdds(totalOdds)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-text">
                  <span>Potential return</span>
                  <span className="font-semibold text-accent tabular-nums">
                    {formatTzs(potentialReturnMinor)}
                  </span>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
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
                className="mt-2 w-full rounded-xl px-4 py-2 text-xs font-medium text-muted-text hover:text-red-300"
              >
                Clear slip
              </button>
            </>
          )}
        </section>
      ) : null}
    </>
  )
}
