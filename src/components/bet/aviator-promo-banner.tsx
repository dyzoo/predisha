'use client'

import Link from 'next/link'
import { ArrowRight, Plane } from 'lucide-react'
import { useBetSlip } from './bet-slip-provider'

export function AviatorPromoBanner() {
  const { viewer } = useBetSlip()
  const href = viewer.userId ? '/bet/games/aviator' : '/bet/aviator-trial'

  return (
    <Link
      href={href}
      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/20 via-surface to-surface px-4 py-3 transition-colors hover:border-accent/60 sm:px-5"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_50%,rgba(215,164,65,0.18),transparent_65%)]"
      />
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-background">
        <Plane className="h-5 w-5 -rotate-12" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          Aviator
        </span>
        <span className="block truncate text-sm font-semibold text-main-text sm:text-base">
          Cash out before the plane flies away
        </span>
      </span>
      <span className="relative inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-background sm:px-4 sm:text-sm">
        Play now
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
