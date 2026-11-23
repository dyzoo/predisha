'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  CircleAlert,
  Loader2,
  Share2,
  X,
} from 'lucide-react'
import { formatKickoffLabel, formatOdds, formatTzs } from '@/lib/bet/format'
import type { BetSlipItem, BetTicketView, TicketSelection } from '@/lib/bet/types'
import { MAX_STAKE_MINOR, slipStakeOptions } from '@/lib/bet/types'
import { applyVat } from '@/lib/bet/vat'
import { useBetSlip } from './bet-slip-provider'
import { useBetMode } from './bet-mode-context'
import {
  SharedSlipReceipt,
  type SharedSlipSelection,
} from './shared-slip-receipt'

export function BetSlipDock() {
  const router = useRouter()
  const {
    viewer,
    items,
    stakeMinor,
    setStakeMinor,
    removeSelection,
    clear,
    locked,
    totalOdds,
    potentialReturnMinor,
    placeBet,
    placing,
    slipOpen: open,
    openSlip,
    closeSlip,
  } = useBetSlip()
  const { minStakeMinor } = useBetMode()
  const quickStakeOptions = useMemo(() => slipStakeOptions(minStakeMinor), [minStakeMinor])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<BetTicketView | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const displayOdds = success ? success.totalOdds : totalOdds
  const receiptStakeMinor = success?.stakeMinor ?? stakeMinor
  const receiptReturnMinor = success?.potentialReturnMinor ?? potentialReturnMinor
  const receiptTotals = applyVat(receiptReturnMinor)
  const receiptCode = success?.code ?? `SLIP-${String(items.length).padStart(3, '0')}`

  const receiptItems = useMemo<SharedSlipSelection[]>(() => {
    const source = success?.selections ?? items
    return source.map((selection, index) => {
      const ticketSelection = selection as TicketSelection | BetSlipItem
      const result = success ? (ticketSelection as TicketSelection).result : null
      return {
        key:
          'key' in ticketSelection && ticketSelection.key
            ? ticketSelection.key
            : `${ticketSelection.fixtureId}:${ticketSelection.marketId}:${ticketSelection.selectionId}:${index}`,
        time: formatKickoffLabel(ticketSelection.kickoffIso),
        fixtureLabel: ticketSelection.fixtureLabel,
        competition: ticketSelection.competition,
        marketName: ticketSelection.marketName,
        selectionLabel: ticketSelection.selectionLabel,
        odds: ticketSelection.odds,
        marker: success
          ? result === 'WON'
            ? 'green'
            : result === 'LOST'
              ? 'red'
              : 'gray'
          : 'gray',
      }
    })
  }, [items, success])

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
          className="fixed inset-x-0 bottom-16 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[460px]"
        >
          <div className="relative flex max-h-[82vh] flex-col">
            <div className="flex justify-end pb-2">
              <button
                type="button"
                onClick={() => {
                  if (success) resetSuccess()
                  else closeSlip()
                }}
                aria-label="Close bet slip"
                className="rounded-lg bg-surface/90 p-1.5 text-muted-text shadow-lg transition-colors hover:text-main-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl">
              <SharedSlipReceipt
                code={receiptCode}
                title={success ? 'Bet accepted' : 'Bet slip'}
                status={success?.status ?? 'OPEN'}
                selections={receiptItems}
                stakeMinor={receiptStakeMinor}
                totalOdds={displayOdds}
                potentialReturnMinor={receiptReturnMinor}
                vatMinor={receiptTotals.vatMinor}
                netPayoutMinor={receiptTotals.netPayoutMinor}
                won={success?.status === 'WON'}
                copied={Boolean(shareUrl)}
                onCopy={success ? undefined : onShare}
                onRemove={success || locked ? undefined : removeSelection}
              >
                {success ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-xl border border-accent/25 bg-accent/10 p-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <div className="text-[11px] text-main-text">
                        <p className="font-semibold">Ticket {success.code}</p>
                        <p className="mt-0.5 text-muted-text">
                          {formatTzs(success.stakeMinor)} at {formatOdds(success.totalOdds)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href="/bet/bets"
                        onClick={resetSuccess}
                        className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-center text-xs font-bold text-background"
                      >
                        View my bets
                      </Link>
                      <button
                        type="button"
                        onClick={resetSuccess}
                        className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-text hover:text-main-text"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center">
                    <p className="text-[12px] font-semibold text-main-text">Your bet slip is empty</p>
                    <p className="mt-1 text-[11px] text-muted-text">
                      Add selections from the sportsbook to build a bet.
                    </p>
                    <Link
                      href="/bet/sports"
                      onClick={closeSlip}
                      className="mt-3 inline-block rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-background"
                    >
                      Browse fixtures
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {locked ? (
                      <div className="rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-[11px] text-accent">
                        Shared slip locked. Selections cannot be changed - just set your stake and
                        place the bet.
                      </div>
                    ) : null}

                    <div>
                      <label htmlFor="bet-stake" className="text-[11px] font-medium text-muted-text">
                        Stake (TZS)
                      </label>
                      <div className="mt-1.5 flex items-center rounded-xl border border-border bg-white/50 px-3 focus-within:border-accent/60">
                        <input
                          id="bet-stake"
                          type="number"
                          min={minStakeMinor}
                          max={MAX_STAKE_MINOR}
                          step={500}
                          value={stakeMinor}
                          onChange={event => setStakeMinor(Number(event.target.value))}
                          className="w-full bg-transparent py-2.5 text-sm font-semibold tabular-nums text-main-text outline-none"
                        />
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {quickStakeOptions.map(amount => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setStakeMinor(amount)}
                            className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                              stakeMinor === amount
                                ? 'border-accent bg-accent/15 text-accent'
                                : 'border-border bg-white/30 text-muted-text hover:border-accent/40 hover:text-accent'
                            }`}
                          >
                            {formatTzs(amount)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {error ? (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-xl border border-red-700/25 bg-red-700/10 px-3 py-2 text-[11px] text-red-800"
                      >
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        {error}
                      </div>
                    ) : null}

                    {shareUrl ? (
                      <div className="rounded-xl border border-accent/25 bg-accent/10 p-3 text-[11px] text-accent">
                        Share link copied: <span className="break-all font-semibold">{shareUrl}</span>
                      </div>
                    ) : null}

                    {viewer.userId ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={onPlace}
                          disabled={placing}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-xs font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {placing ? 'Placing…' : `Place bet · ${formatTzs(stakeMinor)}`}
                        </button>
                        {locked ? null : (
                          <button
                            type="button"
                            onClick={onShare}
                            disabled={sharing}
                            aria-label="Create share link"
                            className="rounded-xl border border-border px-3 text-muted-text transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-60"
                          >
                            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    ) : (
                      <Link
                        href="/sign-in?next=/bet"
                        className="block rounded-xl bg-accent px-4 py-3 text-center text-xs font-bold text-background"
                      >
                        Sign in to place this bet
                      </Link>
                    )}

                    {locked ? null : (
                      <button
                        type="button"
                        onClick={() => {
                          clear()
                          closeSlip()
                        }}
                        className="w-full rounded-xl px-4 py-2 text-[11px] font-medium text-muted-text hover:text-red-700"
                      >
                        Clear slip
                      </button>
                    )}
                  </div>
                )}
              </SharedSlipReceipt>
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
