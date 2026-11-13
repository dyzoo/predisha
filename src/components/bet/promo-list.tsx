'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, CircleAlert, Gift, Loader2 } from 'lucide-react'
import { formatDateTimeLabel, formatTzs } from '@/lib/bet/format'
import type { BetPromoView } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'
import { useBetMode } from './bet-mode-context'

export function PromoList({
  promos,
  signedIn,
}: {
  promos: BetPromoView[]
  signedIn: boolean
}) {
  const router = useRouter()
  const { refreshWallet } = useBetSlip()
  const { mode } = useBetMode()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function claim(promo: BetPromoView) {
    setBusyId(promo.id)
    setErrorId(null)
    setErrorMessage(null)
    try {
      const response = await fetch(`/api/bet/promos/${promo.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoId: promo.id }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setErrorId(promo.id)
        setErrorMessage(payload.error ?? 'The promo could not be claimed.')
        return
      }
      await refreshWallet()
      router.refresh()
    } catch {
      setErrorId(promo.id)
      setErrorMessage('Network error. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {promos.map(promo => {
        const busy = busyId === promo.id
        return (
          <article
            key={promo.id}
            className="flex flex-col rounded-2xl border border-border bg-surface/80 p-5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Gift className="h-5 w-5" />
            </div>
            <h2 className="mt-3 font-display text-lg font-semibold">{promo.title}</h2>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-text">
              {promo.description}
            </p>
            <p className="mt-4 text-2xl font-bold text-accent tabular-nums">
              {formatTzs(promo.bonusMinor)}
            </p>

            {errorId === promo.id && errorMessage ? (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {errorMessage}
              </div>
            ) : null}

            {promo.claimed ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/10 px-3 py-2.5 text-xs font-semibold text-accent">
                <Check className="h-4 w-4" />
                Claimed
                {promo.claimedAt ? (
                  <span className="ml-auto font-normal text-accent/70">
                    {formatDateTimeLabel(promo.claimedAt)}
                  </span>
                ) : null}
              </div>
            ) : signedIn ? (
              <button
                type="button"
                onClick={() => claim(promo)}
                disabled={busy}
                className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-background disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? 'Claiming.' : mode === 'SANDBOX' ? 'Claim play-money bonus' : 'Claim bonus'}
              </button>
            ) : (
              <Link
                href="/sign-in?next=/bet/promo"
                className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-bold text-background"
              >
                Sign in to claim
              </Link>
            )}
          </article>
        )
      })}
    </div>
  )
}
