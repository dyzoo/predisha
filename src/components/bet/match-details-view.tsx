'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  ClipboardList,
  Flame,
  Home,
  Info,
  MessageCircle,
  Search,
  Star,
} from 'lucide-react'

type PrimaryTab = 'BB' | 'Markets' | 'Stats' | 'Codes' | 'Chat'
type SecondaryTab = 'Specials' | 'Players' | 'Teams' | 'Minutes' | 'Match'

const PRIMARY_TABS: PrimaryTab[] = ['BB', 'Markets', 'Stats', 'Codes', 'Chat']
const SECONDARY_TABS: SecondaryTab[] = ['Specials', 'Players', 'Teams', 'Minutes', 'Match']

const FIRST_GOAL_MARKETS = [
  { label: '1–10', odds: '3.40' },
  { label: '11–20', odds: '4.10' },
  { label: '21–30', odds: '5.70' },
  { label: '31–40', odds: '7.90' },
  { label: '41–50', odds: '9.60' },
  { label: '51–60', odds: '16.00' },
  { label: '61–70', odds: '24.00' },
  { label: '71–80', odds: '37.00' },
  { label: '81–90', odds: '40.00' },
  { label: 'none', odds: '31.00' },
]

function FlagCircle({
  label,
  colors,
}: {
  label: string
  colors: [string, string, string]
}) {
  return (
    <span
      role="img"
      aria-label={`${label} flag`}
      className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border sm:h-12 sm:w-12"
      style={{
        background: `linear-gradient(to bottom, ${colors[0]} 0 33.33%, ${colors[1]} 33.33% 66.66%, ${colors[2]} 66.66% 100%)`,
      }}
    />
  )
}

function MarketSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const expandable = children != null

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface/60">
      <div className="flex min-w-0 items-center gap-1 px-2.5 py-2 sm:px-3 sm:py-2.5">
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-expanded={expandable ? open : undefined}
          disabled={!expandable}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:cursor-default"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-text transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
          <span className="line-clamp-2 min-w-0 text-[11px] font-semibold leading-snug text-main-text sm:text-xs">
            {title}
          </span>
        </button>
        <button
          type="button"
          aria-label={`Information about ${title}`}
          className="shrink-0 rounded-md p-1.5 text-muted-text transition-colors hover:bg-background/60 hover:text-accent"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Add ${title} to favourites`}
          className="shrink-0 rounded-md p-1.5 text-muted-text transition-colors hover:bg-background/60 hover:text-accent"
        >
          <Star className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && children ? <div className="border-t border-border p-2.5 sm:p-3">{children}</div> : null}
    </section>
  )
}

function OddsCard({ label, odds }: { label: string; odds: string }) {
  const [selected, setSelected] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setSelected(value => !value)}
      aria-pressed={selected}
      className={`flex min-h-9 min-w-0 items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-left transition-colors sm:min-h-10 sm:px-2.5 ${
        selected
          ? 'border-accent bg-accent/15'
          : 'border-border bg-elevated-surface/60 hover:border-accent/40 hover:bg-accent/10'
      }`}
    >
      <span className="min-w-0 truncate text-[10px] font-medium text-muted-text sm:text-[11px]">
        {label}
      </span>
      <span className="shrink-0 text-[11px] font-bold tabular-nums text-accent sm:text-xs">
        {odds}
      </span>
    </button>
  )
}

export function MatchDetailsView() {
  const [primary, setPrimary] = useState<PrimaryTab>('Markets')
  const [secondary, setSecondary] = useState<SecondaryTab>('Minutes')

  return (
    <div className="min-h-screen w-full min-w-0 bg-background text-main-text">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid h-14 w-full max-w-2xl grid-cols-[2.5rem_1fr_2.5rem] items-center px-2 sm:px-4">
          <Link
            href="/bet"
            aria-label="Back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-text transition-colors hover:bg-surface hover:text-main-text"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="truncate text-center text-sm font-semibold">Details</h1>
          <Link
            href="/bet"
            aria-label="Home"
            className="inline-flex h-9 w-9 items-center justify-center justify-self-end rounded-xl text-muted-text transition-colors hover:bg-surface hover:text-main-text"
          >
            <Home className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl min-w-0 space-y-3 px-3 pb-28 pt-3 sm:px-4 sm:pt-4">
        <section className="min-w-0 rounded-2xl border border-border bg-surface/80 p-3 sm:p-5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                <Flame className="h-3 w-3" />
                Hot
              </span>
              <p className="line-clamp-2 min-w-0 text-[10px] leading-snug text-muted-text">
                Football · International · UEFA Nations League
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full border border-border bg-background/50 px-2.5 py-1 text-[10px] font-semibold text-muted-text transition-colors hover:border-accent/40 hover:text-accent"
            >
              Switch match
            </button>
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-4">
            <div className="flex min-w-0 flex-col items-center text-center">
              <FlagCircle label="Germany" colors={['#000000', '#DD0000', '#FFCE00']} />
              <p className="mt-2 max-w-full truncate text-xs font-semibold leading-tight sm:text-sm">
                Germany
              </p>
            </div>

            <div className="flex min-w-0 flex-col items-center text-center">
              <p className="text-[10px] font-medium text-muted-text">Fri 06 Sep</p>
              <p className="mt-0.5 text-lg font-bold leading-none tabular-nums sm:text-2xl">
                20:45
              </p>
              <button
                type="button"
                aria-label="Match notifications"
                className="mt-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/50 text-muted-text transition-colors hover:border-accent/40 hover:text-accent"
              >
                <Bell className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex min-w-0 flex-col items-center text-center">
              <FlagCircle label="Netherlands" colors={['#AE1C28', '#FFFFFF', '#21468B']} />
              <p className="mt-2 max-w-full truncate text-xs font-semibold leading-tight sm:text-sm">
                Netherlands
              </p>
            </div>
          </div>

          <div className="mt-4 flex min-w-0 flex-col items-center gap-1.5 border-t border-border pt-3 text-[10px] text-muted-text sm:flex-row sm:justify-center sm:gap-4">
            <span>
              Match ID: <span className="font-semibold text-main-text">#12345678</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Live In-Play Available
            </span>
          </div>
        </section>

        <nav aria-label="Match sections" className="min-w-0 border-b border-border">
          <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PRIMARY_TABS.map(tab => {
              const active = primary === tab
              const isChat = tab === 'Chat'
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPrimary(tab)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors ${
                    active ? 'text-accent' : 'text-muted-text hover:text-main-text'
                  }`}
                >
                  {isChat ? <MessageCircle className="h-4 w-4" /> : tab}
                  {isChat ? <span className="sr-only">Chat</span> : null}
                  {active ? (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
                  ) : null}
                </button>
              )
            })}
          </div>
        </nav>

        <div className="flex min-w-0 items-center gap-1 border-b border-border">
          <button
            type="button"
            aria-label="Search markets"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-text transition-colors hover:bg-surface hover:text-accent"
          >
            <Search className="h-4 w-4" />
          </button>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECONDARY_TABS.map(tab => {
              const active = secondary === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSecondary(tab)}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    active
                      ? 'bg-accent/15 text-accent'
                      : 'text-muted-text hover:bg-surface hover:text-main-text'
                  }`}
                >
                  {tab}
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-w-0 space-y-2.5">
          <MarketSection title="When will the 1st goal be scored (10 min interval)" defaultOpen>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {FIRST_GOAL_MARKETS.map(market => (
                <OddsCard key={market.label} label={market.label} odds={market.odds} />
              ))}
            </div>
          </MarketSection>

          <MarketSection title="When will the 1st goal be scored (15 min interval)" />
        </div>
      </main>

      <button
        type="button"
        aria-label="Open bet slip"
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-background shadow-lg transition-transform hover:scale-105 sm:right-6"
      >
        <ClipboardList className="h-6 w-6" />
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-main-text px-1 text-[10px] font-bold leading-none text-background">
          3
        </span>
      </button>
    </div>
  )
}
