'use client'

import type { ReactNode } from 'react'
import { CircleCheck, Copy, Share2 } from 'lucide-react'
import { formatOdds, formatTsh } from '@/lib/bet/format'
import { VAT_PERCENT } from '@/lib/bet/vat'

export type SharedSlipTheme = 'black' | 'white'
export type SharedSlipMarker = 'green' | 'gray' | 'red'

export interface SharedSlipSelection {
  key: string
  time: string
  fixtureLabel: string
  competition: string
  marketName: string
  selectionLabel: string
  odds: number
  marker: SharedSlipMarker
  finalScore?: string | null
}

const palettes = {
  black: {
    background: '#24282D',
    surface: '#2C3138',
    elevated: '#343A43',
    green: '#2DB763',
    gray: '#A7B0BA',
    red: '#E24B4B',
    text: '#F7F8FA',
    muted: '#C3CAD2',
    line: 'rgba(255, 255, 255, 0.16)',
  },
  white: {
    background: '#FFFFFF',
    surface: '#F3F5F7',
    elevated: '#FFFFFF',
    green: '#128A45',
    gray: '#64748B',
    red: '#C62828',
    text: '#171A1F',
    muted: '#4B5563',
    line: 'rgba(23, 26, 31, 0.16)',
  },
}

type Palette = (typeof palettes)['black']

const MARKER_LABELS: Record<SharedSlipMarker, string> = {
  green: 'Won',
  gray: 'Pending',
  red: 'Lost',
}

function markerColor(palette: Palette, marker: SharedSlipMarker): string {
  return marker === 'green' ? palette.green : marker === 'red' ? palette.red : palette.gray
}

function MarkerDot({
  marker,
  palette,
  size = 8,
}: {
  marker: SharedSlipMarker
  palette: Palette
  size?: number
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: markerColor(palette, marker) }}
    />
  )
}

function FootballIcon({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2 15.8 10l-1.4 4.4H9.6L8.2 10z" />
      <path d="M12 3.1v4.1M20.2 9.6l-4.4.4M17.3 19.4l-2.9-5M6.7 19.4l2.9-5M3.8 9.6l4.4.4" />
    </svg>
  )
}

export function SharedSlipReceipt({
  code,
  title,
  status,
  theme = 'black',
  selections,
  stakeMinor,
  totalOdds,
  potentialReturnMinor,
  vatMinor,
  netPayoutMinor,
  copied = false,
  onCopy,
  children,
}: {
  code: string
  title?: string | null
  status: string
  theme?: SharedSlipTheme
  selections: SharedSlipSelection[]
  stakeMinor: number
  totalOdds: number
  potentialReturnMinor: number
  vatMinor: number
  netPayoutMinor: number
  copied?: boolean
  onCopy?: () => void
  children?: ReactNode
}) {
  const palette = palettes[theme]
  const counts: Record<SharedSlipMarker, number> = { green: 0, gray: 0, red: 0 }
  for (const selection of selections) counts[selection.marker] += 1

  return (
    <div
      className="receipt-print-target relative mx-auto w-full max-w-[520px] overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: palette.background,
        borderColor: palette.line,
        fontFamily: 'var(--font-slip), "Arial Narrow", Arial, sans-serif',
      }}
    >
      <div className="p-3 sm:p-4">
        <div className="border-b pb-3" style={{ borderColor: palette.line }}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-black" style={{ color: palette.text }}>
                Bet ID {code}
              </p>
              <p className="mt-1 text-[12px] font-semibold" style={{ color: palette.muted }}>
                Multibet {selections.length}
              </p>
            </div>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{
                borderColor: palette.line,
                backgroundColor: palette.surface,
                color: palette.text,
              }}
            >
              {status}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {(['green', 'gray', 'red'] as const).map(marker => (
              <span
                key={marker}
                className="inline-flex items-center gap-1.5"
                style={{ color: palette.text }}
              >
                <MarkerDot marker={marker} palette={palette} />
                <span className="text-[12px] font-bold tabular-nums">{counts[marker]}</span>
                <span className="text-[10px]" style={{ color: palette.muted }}>
                  {MARKER_LABELS[marker]}
                </span>
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px]" style={{ color: palette.muted }}>
                Odds
              </p>
              <p
                className="text-[18px] font-black leading-tight tabular-nums"
                style={{ color: palette.text }}
              >
                {formatOdds(totalOdds)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px]" style={{ color: palette.muted }}>
                Stake
              </p>
              <p
                className="text-[18px] font-black leading-tight tabular-nums"
                style={{ color: palette.text }}
              >
                {formatTsh(stakeMinor)}
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <span style={{ color: palette.muted }}>
              Code <span className="font-mono font-bold" style={{ color: palette.text }}>{code}</span>
            </span>
            {onCopy ? (
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                style={{ backgroundColor: palette.green, color: theme === 'black' ? '#101B13' : '#FFFFFF' }}
              >
                {copied ? <CircleCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Link copied' : 'Share slip'}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5" style={{ color: palette.muted }}>
                <Share2 className="h-3.5 w-3.5" />
                Shared slip
              </span>
            )}
          </div>
        </div>

        <div className="mt-1">
          {selections.length === 0 ? (
            <p className="py-6 text-center text-[12px]" style={{ color: palette.muted }}>
              No selections yet.
            </p>
          ) : (
            selections.map(selection => (
              <div
                key={selection.key}
                className="flex items-start gap-2 border-b py-2.5"
                style={{ borderColor: palette.line }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold" style={{ color: palette.muted }}>
                    {selection.time}
                  </p>
                  <div className="mt-0.5 flex items-start justify-between gap-2">
                    <p
                      className="flex items-center gap-1.5 text-[12px] font-bold leading-tight"
                      style={{ color: palette.text }}
                    >
                      <FootballIcon color={palette.muted} />
                      <span className="truncate">{selection.fixtureLabel}</span>
                    </p>
                    {selection.finalScore ? (
                      <p
                        className="shrink-0 text-[11px] font-bold tabular-nums"
                        style={{ color: palette.green }}
                      >
                        {selection.finalScore}
                      </p>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[10px]" style={{ color: palette.muted }}>
                    {selection.competition}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: palette.text }}>
                    {selection.marketName} · {selection.selectionLabel}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                  <MarkerDot marker={selection.marker} palette={palette} />
                  <span className="text-[12px] font-black tabular-nums" style={{ color: palette.text }}>
                    {formatOdds(selection.odds)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div
          className="mt-3 rounded-xl border p-2.5"
          style={{ borderColor: palette.line, backgroundColor: palette.surface }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold" style={{ color: palette.muted }}>
              Potential return
            </span>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: palette.text }}>
              {formatTsh(potentialReturnMinor)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[11px]" style={{ color: palette.muted }}>
              VAT ({VAT_PERCENT}%)
            </span>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: palette.red }}>
              -{formatTsh(vatMinor)}
            </span>
          </div>
          <div
            className="mt-2 flex items-center justify-between gap-2 border-t pt-2"
            style={{ borderColor: palette.line }}
          >
            <span className="text-[12px] font-bold" style={{ color: palette.text }}>
              Net payout
            </span>
            <span className="text-[15px] font-black tabular-nums" style={{ color: palette.text }}>
              {formatTsh(netPayoutMinor)}
            </span>
          </div>
        </div>

        {children ? <div className="mt-4">{children}</div> : null}

        <div className="mt-3 border-t pt-2" style={{ borderColor: palette.line }}>
          <p
            className="flex flex-wrap items-center justify-between gap-2 text-[10px]"
            style={{ color: palette.muted }}
          >
            <span className="truncate">{title || 'Shared bet slip'}</span>
            <span className="font-mono tracking-wide">{code}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
