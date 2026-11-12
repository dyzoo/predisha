'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CircleAlert, Loader2, Share2 } from 'lucide-react'
import type { BetSlipItem, TicketSelection } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'

interface ShareResponse {
  share?: {
    code: string
    selections: TicketSelection[]
    expiresAt: string
    stale: boolean
  }
  error?: string
}

function toSlipItem(selection: TicketSelection): BetSlipItem {
  return {
    key: `${selection.fixtureId}:${selection.marketId}:${selection.selectionId}`,
    fixtureId: selection.fixtureId,
    marketId: selection.marketId,
    selectionId: selection.selectionId,
    odds: selection.odds,
    fixtureLabel: selection.fixtureLabel,
    competition: selection.competition,
    marketName: selection.marketName,
    selectionLabel: selection.selectionLabel,
    kickoffIso: selection.kickoffIso,
  }
}

export function ShareLoader({ code }: { code: string }) {
  const { setItemsFromShare } = useBetSlip()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [count, setCount] = useState(0)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    let cancelled = false

    async function load() {
      try {
        const response = await fetch(`/api/bet/share/${encodeURIComponent(code)}`, {
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => ({}))) as ShareResponse
        if (cancelled) return
        if (!response.ok || !payload.share) {
          setState('error')
          setMessage(payload.error ?? 'That share link could not be loaded.')
          return
        }
        const items = payload.share.selections.map(toSlipItem)
        setItemsFromShare(items)
        setCount(items.length)
        setStale(payload.share.stale)
        setState('ready')
      } catch {
        if (!cancelled) {
          setState('error')
          setMessage('Network error while loading the share link.')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [code, setItemsFromShare])

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-border bg-surface/80 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        {state === 'loading' ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : state === 'error' ? (
          <CircleAlert className="h-6 w-6" />
        ) : (
          <Share2 className="h-6 w-6" />
        )}
      </div>

      <h1 className="mt-4 font-display text-2xl font-semibold">
        {state === 'loading'
          ? 'Loading shared slip…'
          : state === 'error'
            ? 'Share link unavailable'
            : 'Shared slip loaded'}
      </h1>

      {state === 'ready' ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-text">
          {count} selection{count === 1 ? '' : 's'} added to your bet slip. Review the prices before
          placing a sandbox bet.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted-text">
          {message ?? 'Share codes are sandbox-only and expire after 24 hours.'}
        </p>
      )}

      {stale ? (
        <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          One or more prices changed since this slip was shared. Remove and re-add those selections
          from the sportsbook.
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/bet/sports"
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background"
        >
          Browse sportsbook
        </Link>
        <Link
          href="/bet"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
        >
          Back to bet home
        </Link>
      </div>
    </div>
  )
}
