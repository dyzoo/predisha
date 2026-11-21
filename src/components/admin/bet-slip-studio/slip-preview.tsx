'use client'

import type { RefObject } from 'react'
import { RefreshCw, Share2, Trophy } from 'lucide-react'
import { formatOdds, formatTsh } from '@/lib/bet/format'
import type { SlipDesignStatus, SlipMarker } from '@/lib/bet/slip-designs'
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

const MARKER_LABELS: Record<SlipMarker, string> = {
  green: 'Won',
  gray: 'Pending',
  red: 'Lost',
}

function markerColor(palette: Palette, marker: SlipMarker): string {
  return marker === 'green' ? palette.green : marker === 'red' ? palette.red : palette.gray
}

function markerOf(selection: EditorSelection): SlipMarker {
  return selection.marker ?? (selection.won ? 'green' : 'gray')
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

function MarkerDot({ marker, palette, size = 8 }: { marker: SlipMarker; palette: Palette; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: markerColor(palette, marker) }}
    />
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
  const counts: Record<SlipMarker, number> = { green: 0, gray: 0, red: 0 }
  for (const selection of selections) counts[markerOf(selection)] += 1

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: palette.background,
        borderColor: palette.line,
        fontFamily: 'var(--font-slip), "Arial Narrow", Arial, sans-serif',
      }}
    >
      <div className="p-3 sm:p-4">
        <div className="border-b pb-3" style={{ borderColor: palette.line }}>
          <p className="text-[13px] font-bold" style={{ color: palette.text }}>
            Bet ID {betId?.trim() || 'Not set'}
          </p>
          <p className="mt-1 text-[12px] font-semibold" style={{ color: palette.muted }}>
            Multibet {selections.length}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {(['green', 'gray', 'red'] as const).map(marker => (
              <span key={marker} className="inline-flex items-center gap-1.5" style={{ color: palette.text }}>
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
              <p className="text-[18px] font-black leading-tight tabular-nums" style={{ color: palette.text }}>
                {formatOdds(totalOdds)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px]" style={{ color: palette.muted }}>
                Stake
              </p>
              <p className="text-[18px] font-black leading-tight tabular-nums" style={{ color: palette.text }}>
                {formatTsh(stakeMinor)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-1">
          {selections.length === 0 ? (
            <p className="py-6 text-center text-[12px]" style={{ color: palette.muted }}>
              No selections yet.
            </p>
          ) : (
            selections.map(selection => {
              const marker = markerOf(selection)
              return (
                <div key={selection.id} className="flex items-start gap-2 border-b py-2.5" style={{ borderColor: palette.line }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold" style={{ color: palette.muted }}>
                      {selection.time || 'Kickoff time'}
                    </p>
                    <div className="mt-0.5 flex items-start justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[12px] font-bold leading-tight" style={{ color: palette.text }}>
                        <FootballIcon color={palette.muted} />
                        <span className="truncate">
                          {selection.home || 'Home'} - {selection.away || 'Away'}
                        </span>
                      </p>
                      {selection.finalScore ? (
                        <p className="shrink-0 text-[11px] font-bold tabular-nums" style={{ color: palette.green }}>
                          {selection.finalScore}
                        </p>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[10px]" style={{ color: palette.muted }}>
                      {selection.league || 'Competition'}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: palette.text }}>
                      {selection.selection || 'Market selection'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                    <MarkerDot marker={marker} palette={palette} />
                    <span className="text-[12px] font-black tabular-nums" style={{ color: palette.text }}>
                      {formatOdds(Number(selection.odds) || 1)}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="mt-3 rounded-xl border p-2.5" style={{ borderColor: palette.line, backgroundColor: palette.surface }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold" style={{ color: palette.muted }}>
              Potential winnings
            </span>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: palette.text }}>
              {formatTsh(winningsMinor)}
            </span>
          </div>
          {bonusMinor > 0 ? (
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-[11px]" style={{ color: palette.muted }}>
                Bonus
              </span>
              <span className="text-[12px] font-bold tabular-nums" style={{ color: palette.text }}>
                {formatTsh(bonusMinor)}
              </span>
            </div>
          ) : null}
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[11px]" style={{ color: palette.muted }}>
              Withholding tax ({taxPercent}%)
            </span>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: palette.red }}>
              -{formatTsh(taxMinor)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: palette.line }}>
            <span className="text-[12px] font-bold" style={{ color: won ? palette.green : palette.text }}>
              {won ? 'Won' : 'Payout'}
            </span>
            <span className="text-[15px] font-black tabular-nums" style={{ color: won ? palette.green : palette.text }}>
              {formatTsh(payoutMinor)}
            </span>
          </div>
        </div>

        {won ? (
          <div
            className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: palette.green, backgroundColor: palette.surface }}
          >
            <Trophy className="h-4 w-4 shrink-0" style={{ color: palette.green }} />
            <p className="text-[11px] font-semibold" style={{ color: palette.text }}>
              Winning slip shared for {formatTsh(payoutMinor)}
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {!won ? (
            <button
              type="button"
              onClick={onReuse}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-bold"
              style={{ borderColor: palette.line, backgroundColor: palette.elevated, color: palette.text }}
            >
              <RefreshCw className="h-3 w-3" style={{ color: palette.green }} />
              Re-use ({reuseCount})
            </button>
          ) : null}
          <button
            type="button"
            onClick={onShare}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold"
            style={{ backgroundColor: palette.green, color: theme === 'black' ? '#101B13' : '#FFFFFF' }}
          >
            <Share2 className="h-3.5 w-3.5" />
            {won ? 'Share win' : 'Share slip'}
          </button>
        </div>

        <div className="mt-3 border-t pt-2" style={{ borderColor: palette.line }}>
          <p className="flex flex-wrap items-center justify-between gap-2 text-[10px]" style={{ color: palette.muted }}>
            <span className="truncate">{title || 'Untitled bet slip'}</span>
            <span className="font-mono tracking-wide">{code ?? 'Draft'}</span>
          </p>
          {placedAt ? (
            <p className="mt-1 text-[10px]" style={{ color: palette.muted }}>
              {placedAt}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
