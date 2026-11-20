'use client'

import type { RefObject } from 'react'
import {
  BadgeCheck,
  ChevronDown,
  CircleCheck,
  RefreshCw,
  Share2,
  Ticket,
} from 'lucide-react'
import { formatOdds, formatTzs } from '@/lib/bet/format'
import type { SlipDesignStatus } from '@/lib/bet/slip-designs'
import type { EditorSelection } from './model'

const palette = {
  background: '#101318',
  surface: '#1D232C',
  elevated: '#252C36',
  accent: '#E41827',
  gold: '#F0D52E',
  text: '#F5F7FA',
  muted: '#A5AFBD',
  line: 'rgba(255, 255, 255, 0.09)',
}

export interface SlipPreviewProps {
  containerRef: RefObject<HTMLDivElement | null>
  title: string
  code: string | null
  status: SlipDesignStatus
  selections: EditorSelection[]
  totalOdds: number
  stakeMinor: number
  winningsMinor: number
  bonusMinor: number
  taxPercent: number
  taxMinor: number
  payoutMinor: number
  reuseCount: number
  onReuse: () => void
  onShare: () => void
}

function FinancialRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-1.5">
      <span
        className="text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: palette.muted }}
      >
        {label}
      </span>
      <span
        className="font-mono text-xs font-bold tabular-nums"
        style={{ color: highlight ? palette.gold : palette.text }}
      >
        {value}
      </span>
    </div>
  )
}

export function SlipPreview({
  containerRef,
  title,
  code,
  status,
  selections,
  totalOdds,
  stakeMinor,
  winningsMinor,
  bonusMinor,
  taxPercent,
  taxMinor,
  payoutMinor,
  reuseCount,
  onReuse,
  onShare,
}: SlipPreviewProps) {
  const won = status === 'WON'

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: palette.surface,
        borderColor: won ? 'rgba(240, 213, 46, 0.5)' : palette.line,
        fontFamily: 'var(--font-chivo), Arial, sans-serif',
        boxShadow: won ? '0 0 45px -15px rgba(240, 213, 46, 0.55)' : undefined,
      }}
    >
      <div
        className="h-1 w-full"
        style={{
          background: won
            ? `linear-gradient(90deg, ${palette.accent}, ${palette.gold})`
            : `linear-gradient(90deg, ${palette.accent}, ${palette.gold} 85%)`,
        }}
      />

      {won ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span
            className="rotate-[-24deg] font-display text-[110px] font-black tracking-[0.12em] opacity-[0.045]"
            style={{ color: palette.gold }}
          >
            WON
          </span>
        </div>
      ) : null}

      <div className="relative p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5" style={{ color: palette.gold }} />
              <span
                className="text-[10px] font-black uppercase tracking-[0.24em]"
                style={{ color: palette.gold }}
              >
                Spotibet slip
              </span>
            </div>
            <p className="mt-1.5 truncate font-display text-sm font-bold" style={{ color: palette.text }}>
              {title || 'Untitled bet slip'}
            </p>
            <p className="mt-0.5 font-mono text-[10px] tracking-[0.18em]" style={{ color: palette.muted }}>
              {code ?? 'NOT SAVED'}
            </p>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]"
            style={
              won
                ? { color: palette.gold, borderColor: 'rgba(240,213,46,0.5)', background: 'rgba(240,213,46,0.12)' }
                : { color: palette.muted, borderColor: palette.line, background: 'rgba(255,255,255,0.04)' }
            }
          >
            {won ? <BadgeCheck className="h-3 w-3" /> : null}
            {won ? 'Won' : status === 'READY' ? 'Ready' : 'Draft'}
          </span>
        </div>

        <div className="mt-3 rounded-xl border p-2" style={{ borderColor: palette.line, backgroundColor: palette.background }}>
          <FinancialRow label="Odds" value={`${formatOdds(totalOdds)}x`} highlight />
          <FinancialRow label="Stake" value={formatTzs(stakeMinor)} />
          <FinancialRow label="Potential winnings" value={formatTzs(winningsMinor)} />
          <FinancialRow label="Win bonus" value={formatTzs(bonusMinor)} />
          <details className="group">
            <summary
              className="flex cursor-pointer list-none items-center justify-between gap-3 px-1 py-1.5"
              style={{ color: palette.muted }}
            >
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em]">
                Withholding tax ({taxPercent}%)
                <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
              </span>
              <span className="font-mono text-xs font-bold tabular-nums" style={{ color: palette.text }}>
                {formatTzs(taxMinor)}
              </span>
            </summary>
            <p className="px-1 pb-1 text-[10px] leading-relaxed" style={{ color: palette.muted }}>
              {taxPercent}% withheld from winnings and bonus before payout.
            </p>
          </details>
        </div>

        <div
          className="mt-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
          style={
            won
              ? { borderColor: 'rgba(240,213,46,0.45)', background: 'rgba(240,213,46,0.10)' }
              : { borderColor: 'rgba(228,24,39,0.35)', background: 'rgba(228,24,39,0.10)' }
          }
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: won ? palette.gold : palette.text }}
          >
            {won ? 'Payout' : 'Potential payout'}
          </span>
          <span
            className="font-mono text-base font-black tabular-nums"
            style={{ color: won ? palette.gold : palette.text }}
          >
            {formatTzs(payoutMinor)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onReuse}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[10px] font-bold transition-colors"
            style={{ borderColor: palette.line, background: palette.elevated, color: palette.text }}
          >
            <RefreshCw className="h-3 w-3" style={{ color: palette.gold }} />
            Re-use ({reuseCount})
          </button>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[10px] font-bold transition-colors"
            style={{ borderColor: palette.line, background: palette.elevated, color: palette.text }}
          >
            <Share2 className="h-3 w-3" style={{ color: palette.gold }} />
            Share
          </button>
        </div>

        <div className="my-3 border-t" style={{ borderColor: palette.line }} />

        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: palette.text }}>
            {won ? 'Winning selections' : 'Selections'}
          </h3>
          <span className="text-[10px] font-semibold" style={{ color: palette.muted }}>
            {selections.length} picks
          </span>
        </div>

        <ul className="space-y-2">
          {selections.length === 0 ? (
            <li
              className="rounded-xl border border-dashed px-3 py-5 text-center text-[11px]"
              style={{ borderColor: palette.line, color: palette.muted }}
            >
              No selections added yet.
            </li>
          ) : null}
          {selections.map((selection, index) => (
            <li
              key={selection.id}
              className="rounded-xl border px-3 py-2.5"
              style={
                selection.won
                  ? { borderColor: 'rgba(240,213,46,0.4)', background: 'rgba(240,213,46,0.06)' }
                  : { borderColor: palette.line, background: palette.background }
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {selection.won ? (
                      <CircleCheck className="h-3.5 w-3.5 shrink-0" style={{ color: palette.gold }} />
                    ) : null}
                    <p className="truncate text-[12px] font-bold" style={{ color: palette.text }}>
                      {selection.home || 'Home'} - {selection.away || 'Away'}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: palette.muted }}>
                    {selection.league || 'Competition'} · {selection.time || 'Kickoff time'}
                  </p>
                  <p className="mt-1 truncate text-[10px]" style={{ color: palette.gold }}>
                    {selection.selection || 'Market selection'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs font-black tabular-nums" style={{ color: palette.text }}>
                    {formatOdds(Number(selection.odds) || 1)}
                  </p>
                  <p className="mt-0.5 text-[9px]" style={{ color: palette.muted }}>
                    #{index + 1}
                  </p>
                  {selection.won && selection.finalScore ? (
                    <p className="mt-1 font-mono text-[10px] font-bold" style={{ color: palette.gold }}>
                      {selection.finalScore}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between border-t pt-2.5" style={{ borderColor: palette.line }}>
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: palette.muted }}>
            Admin slip studio
          </span>
          <span className="text-[9px] font-bold" style={{ color: palette.gold }}>
            PREDISHA · SPOTIBET
          </span>
        </div>
      </div>
    </div>
  )
}
