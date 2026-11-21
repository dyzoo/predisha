import { calculateSlipTotals, type SlipTotals } from '@/lib/bet/slip-design-math'
import type { SlipDesignInput, SlipDesignSelection, SlipDesignStatus, SlipMarker } from '@/lib/bet/slip-designs'

export interface FixturePickOption {
  id: string
  marketId: string
  selectionId: string
  label: string
  odds: number
}

export interface FixtureMarketOption {
  id: string
  name: string
  picks: FixturePickOption[]
}

export interface FixtureOption {
  id: string
  label: string
  home: string
  away: string
  competition: string
  kickoffIso: string
  kickoffLabel: string
  status: string
  markets: FixtureMarketOption[]
}

export interface SharedSlipSelectionOption {
  fixtureLabel: string
  marketName: string
  selectionLabel: string
  odds: number
  kickoffLabel: string | null
  competition: string | null
}

export interface SharedSlipOption {
  id: string
  code: string
  title: string | null
  status: string
  totalOdds: number
  stakeMinor: number
  selectionCount: number
  selections: SharedSlipSelectionOption[]
}

export interface EditorSelection {
  id: string
  time: string
  odds: string
  home: string
  away: string
  league: string
  selection: string
  won: boolean
  marker: SlipMarker
  fixtureId: string | null
  finalScore: string
}

export function blankSelection(): EditorSelection {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: '',
    odds: '1.50',
    home: '',
    away: '',
    league: '',
    selection: '',
    won: false,
    marker: 'gray',
    fixtureId: null,
    finalScore: '',
  }
}

export function toEditorSelection(selection: SlipDesignSelection): EditorSelection {
  return {
    ...selection,
    odds: selection.odds.toFixed(2),
    marker: selection.marker ?? (selection.won ? 'green' : 'gray'),
  }
}

export function fromEditorSelection(selection: EditorSelection): SlipDesignSelection {
  return {
    ...selection,
    odds: Number.isFinite(Number(selection.odds)) ? Number(selection.odds) : 1,
    marker: selection.marker,
    won: selection.marker === 'green',
  }
}

export function calculateTotals(selections: EditorSelection[], stakeMinor: number, bonusMinor: number, taxPercent: number): SlipTotals {
  return calculateSlipTotals(
    selections.map(selection => Number(selection.odds)),
    stakeMinor,
    bonusMinor,
    taxPercent,
  )
}

export interface SlipEditorState {
  title: string
  status: SlipDesignStatus
  stakeMinor: number
  bonusMinor: number
  taxPercent: number
  reuseCount: number
  selections: EditorSelection[]
}

export function toDesignInput(state: SlipEditorState): SlipDesignInput {
  return {
    title: state.title.trim() || null,
    status: state.status,
    stakeMinor: state.stakeMinor,
    bonusMinor: state.bonusMinor,
    taxPercent: state.taxPercent,
    reuseCount: state.reuseCount,
    selections: state.selections.map(fromEditorSelection),
  }
}

export function splitFixtureLabel(label: string): { home: string; away: string } {
  const parts = label.split(/\s+(?:vs|v|-)\s+/i)
  if (parts.length >= 2) return { home: parts[0].trim(), away: parts.slice(1).join(' ').trim() }
  return { home: label.trim(), away: '' }
}
