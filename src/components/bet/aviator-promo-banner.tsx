'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Plane } from 'lucide-react'
import type { AviatorPulseView } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'

function crashTone(value: number): string {
  if (value < 2) return 'text-red-300'
  if (value < 10) return 'text-[#f0d52e]'
  return 'text-[#E41827]'
}

function liveCopy(pulse: AviatorPulseView | null): { title: string; detail: string } {
  if (!pulse) {
    return {
      title: 'Live multiplier game',
      detail: 'Cash out before the plane flies away',
    }
  }

  if (pulse.phase === 'WAITING') {
    return {
      title: `Next round in ${Math.max(1, Math.ceil(pulse.waitRemainingMs / 1000))}s`,
      detail: 'Betting is open',
    }
  }

  if (pulse.phase === 'FLYING') {
    return {
      title: `${pulse.multiplier.toFixed(2)}x and climbing`,
      detail: 'Cash out before it crashes',
    }
  }

  return {
    title: `Flew away at ${(pulse.crashAt ?? pulse.multiplier).toFixed(2)}x`,
    detail: 'Next round is about to open',
  }
}

export function AviatorPromoBanner() {
  const { viewer } = useBetSlip()
  const href = viewer.userId ? '/bet/games/aviator' : '/bet/aviator-trial'
  const [pulse, setPulse] = useState<AviatorPulseView | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      const response = await fetch('/api/bet/games/aviator/pulse', { cache: 'no-store' }).catch(
        () => null,
      )

      if (response?.ok) {
        const payload = (await response.json().catch(() => null)) as AviatorPulseView | null
        if (!cancelled && payload?.phase && payload.history) setPulse(payload)
      }

      if (!cancelled) {
        timer = setTimeout(() => {
          void tick()
        }, 1_000)
      }
    }

    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  const live = liveCopy(pulse)
  const history = pulse?.history.slice(0, 3) ?? []

  return (
    <Link
      href={href}
      className="group relative flex w-full items-center gap-2.5 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/20 via-surface to-surface px-3.5 py-3 transition-colors hover:border-accent/60 sm:gap-3 sm:px-5"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_50%,rgba(215,164,65,0.18),transparent_65%)]"
      />
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-background">
        <Plane className="h-5 w-5 -rotate-12" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            Aviator
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-red-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            Live
          </span>
        </span>
        <span className="mt-1 block truncate text-base font-extrabold tracking-tight text-main-text sm:text-lg">
          {live.title}
        </span>
        <span className="mt-1.5 flex min-h-[18px] min-w-0 items-center gap-1.5 overflow-hidden">
          {history.length > 0 ? (
            <>
              <span className="shrink-0 text-[10px] font-semibold text-muted-text">Recent</span>
              {history.map((item, index) => (
                <span
                  key={item.roundId}
                  className={`shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold ${crashTone(item.crashAt)} ${index === 2 ? 'hidden min-[420px]:inline-flex' : ''}`}
                >
                  {item.crashAt.toFixed(2)}x
                </span>
              ))}
            </>
          ) : (
            <span className="truncate text-[10px] font-medium text-muted-text">{live.detail}</span>
          )}
        </span>
      </span>
      <span className="relative inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-xs font-black text-background sm:px-4 sm:text-sm">
        <span className="sm:hidden">Play</span>
        <span className="hidden sm:inline">Play now</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
