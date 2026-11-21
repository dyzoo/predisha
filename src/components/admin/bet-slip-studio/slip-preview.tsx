'use client'

import type { RefObject } from 'react'
import { ArrowLeft, BadgeCheck, ChevronDown, CircleCheck, RefreshCw, Share2, Ticket, Trophy } from 'lucide-react'
import { formatOdds, formatTsh, formatTzs } from '@/lib/bet/format'
import type { SlipDesignStatus } from '@/lib/bet/slip-designs'
import type { EditorSelection } from './model'

export type SlipPreviewTheme = 'black' | 'white'

interface SlipPreviewProps {
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
  theme: SlipPreviewTheme
  betId?: string
  placedAt?: string
}

const palettes = {
  black: {
    background: '#101318',
    surface: '#1D232C',
    elevated: '#252C36',
    accent: '#E41827',
    gold: '#F0D52E',
    text: '#F5F7FA',
    muted: '#A5AFBD',
    line: 'rgba(255, 255, 255, 0.09)',
  },
  white: {
    background: '#FFFFFF',
    surface: '#F7F8FA',
    elevated: '#FFFFFF',
    accent: '#E41827',
    gold: '#F0D52E',
    text: '#111318',
    muted: '#5B6472',
    line: 'rgba(17, 19, 24, 0.12)',
  },
}

function FinancialRow({
  label,
  value,
  highlight,
  palette,
}: {
  label: string
  value: string
  highlight?: boolean
  palette: (typeof palettes)['black']
}) {
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
  theme,
  betId,
  placedAt,
}: SlipPreviewProps) {
  const won = status === 'WON'
  const palette = palettes[theme]

  if (won) {
    const payoutText = formatTsh(payoutMinor)
    const winningText = formatTsh(winningsMinor)
    const stakeText = formatTsh(stakeMinor)
    const taxText = formatTsh(taxMinor)
    const oddsText = `${formatOdds(totalOdds)}x`
    const statusItems = [
      { label: 'Pending', active: false, color: palette.muted },
      { label: 'Won', active: true, color: palette.gold },
      { label: 'Lost', active: false, color: palette.accent },
      { label: 'Void', active: false, color: '#5B6472' },
    ]

    return (
      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: palette.background,
          borderColor: palette.line,
          fontFamily: 'var(--font-chivo), Arial, sans-serif',
        }}
      >
        <div className="relative p-2 sm:p-2.5">
          <div className="relative flex h-7 items-center border-b" style={{ borderColor: palette.line }}>
            <button
              type="button"
              aria-label="Back"
              className="absolute left-0 flex h-6 w-6 items-center justify-center rounded-md"
              style={{ color: palette.text }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <p className="absolute left-1/2 -translate-x-1/2 font-display text-[11px] font-bold" style={{ color: palette.text }}>
              {betId ?? 'BET #0000000000'}
            </p>
          </div>

          <div
            className="relative mt-2 overflow-hidden rounded-lg border px-2 py-2"
            style={{ borderColor: 'rgba(240, 213, 46, 0.35)', background: 'rgba(240, 213, 46, 0.10)' }}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-16 w-16 rounded-full opacity-20" style={{ backgroundColor: palette.gold }} />
            <div className="relative flex items-center gap-2">
              <Trophy className="h-4 w-4 shrink-0" style={{ color: palette.gold }} />
              <div className="min-w-0">
                <p className="text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: palette.muted }}>
                  Congratulations on
                </p>
                <p className="text-[11px] font-black" style={{ color: palette.gold }}>
                  WINNING BIG {payoutText}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2 rounded-lg border p-2" style={{ borderColor: palette.line, backgroundColor: palette.background }}>
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: palette.muted }}>
                Odds
              </span>
              <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: palette.text }}>
                {oddsText}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: palette.muted }}>
                Stake
              </span>
              <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: palette.text }}>
                {stakeText}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: palette.muted }}>
                Potential winnings
              </span>
              <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: palette.text }}>
                {winningText}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: palette.muted }}>
                WHT {taxPercent}%
              </span>
              <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: palette.text }}>
                -{taxText}
              </span>
            </div>
            <div
              className="mt-1 flex items-center justify-between gap-2 rounded border px-2 py-1.5"
              style={{ borderColor: 'rgba(240, 213, 46, 0.45)', background: 'rgba(240, 213, 46, 0.10)' }}
            >
              <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: palette.gold }}>
                Payout
              </span>
              <span className="font-mono text-[11px] font-black tabular-nums" style={{ color: '#16A34A' }}>
                {`WON ${payoutText}`}
              </span>
            </div>
          </div>

          <div className="mt-3">
            {selections.length === 0 ? (
              <p className="text-[10px] text-center" style={{ color: palette.muted }}>
                No selections yet.
              </p>
            ) : (
              selections.map(selection => (
                <div
                  key={selection.id}
                  className="py-2"
                  style={{ borderBottom: `1px solid ${palette.line}` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold" style={{ color: palette.text }}>
                      {selection.time || 'Kickoff time'}
                    </span>
                    <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: palette.text }}>
                      {formatOdds(Number(selection.odds) || 1)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-bold" style={{ color: palette.text }}>
                      {`${selection.home || 'Home'} - ${selection.away || 'Away'}`}
                    </span>
                    <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: palette.gold }}>
                      {selection.finalScore || selection.selection || 'Result'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[9px]" style={{ color: palette.muted }}>
                    {selection.league || 'Competition'}
                  </div>
                  <div className="mt-0.5 text-[9px]" style={{ color: palette.muted }}>
                    {selection.selection || 'Market selection'}
                  </div>
                </div>
              ))
            )}
          </div>

          {placedAt ? (
            <p className="mt-2 text-center text-[9px]" style={{ color: palette.muted }}>
              {placedAt}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {statusItems.map(item => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 text-[9px] font-semibold"
                style={{ color: palette.text }}
              >
                <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>

          <div className="mt-3 border-t pt-2 text-center">
            <p className="text-[8px] leading-relaxed" style={{ color: palette.muted }}>
              Bet acceptance and settlement are subject to Terms and Rules. Odds are locked at placement.
            </p>
            <p className="mt-1 text-[8px] leading-relaxed" style={{ color: palette.muted }}>
              Winnings are credited after the applied withholding tax.{' '}
              <span className="font-bold" style={{ color: palette.text }}>
                Terms and Rules
              </span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: palette.background,
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
          <FinancialRow label="Odds" value={`${formatOdds(totalOdds)}x`} highlight palette={palette} />
          <FinancialRow label="Stake" value={formatTzs(stakeMinor)} palette={palette} />
          <FinancialRow label="Potential winnings" value={formatTzs(winningsMinor)} palette={palette} />
          <FinancialRow label="Win bonus" value={formatTzs(bonusMinor)} palette={palette} />
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
