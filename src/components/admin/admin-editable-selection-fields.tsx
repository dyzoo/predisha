'use client'

import {
  ADMIN_MARKET_OPTIONS,
  combineFixtureLabel,
  editableFixtureId,
  findAdminMarketOption,
  findAdminSelectionOption,
  fromDateTimeInputValue,
  kickoffLabelFor,
  splitFixtureLabel,
  toDateTimeInputValue,
} from '@/lib/bet/admin-selection-options'

export interface AdminEditableSelectionValue {
  fixtureId: string
  fixtureLabel: string
  competition: string
  kickoffIso: string
  kickoffLabel?: string
  marketId: string
  marketName: string
  selectionId: string
  selectionLabel: string
  odds: string
  probability: number
}

function fallbackOption(id: string, label: string, odds: string, probability: number) {
  return { id, label, odds, probability }
}

export function AdminEditableSelectionFields<T extends AdminEditableSelectionValue>({
  value,
  index,
  onChange,
}: {
  value: T
  index: number
  onChange: (patch: Partial<AdminEditableSelectionValue>) => void
}) {
  const teams = splitFixtureLabel(value.fixtureLabel)
  const market = findAdminMarketOption(value.marketId)
  const marketSelectionOptions = market?.options.length
    ? market.options
    : [
        fallbackOption(
          value.selectionId,
          value.selectionLabel,
          value.odds,
          value.probability,
        ),
      ]

  function updateTeams(home: string, away: string) {
    onChange({
      fixtureLabel: combineFixtureLabel(home, away),
      fixtureId: editableFixtureId(value.fixtureId, home, away, index),
    })
  }

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block">
        <span className="mb-1 block text-[10px] text-muted-text">Home team</span>
        <input
          type="text"
          value={teams.home}
          onChange={event => updateTeams(event.target.value, teams.away)}
          aria-label={`Home team for selection ${index + 1}`}
          className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] text-main-text outline-none focus:border-accent/60"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] text-muted-text">Away team</span>
        <input
          type="text"
          value={teams.away}
          onChange={event => updateTeams(teams.home, event.target.value)}
          aria-label={`Away team for selection ${index + 1}`}
          className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] text-main-text outline-none focus:border-accent/60"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] text-muted-text">Competition</span>
        <input
          type="text"
          value={value.competition}
          onChange={event => onChange({ competition: event.target.value })}
          aria-label={`Competition for selection ${index + 1}`}
          className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] text-main-text outline-none focus:border-accent/60"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] text-muted-text">Kickoff</span>
        <input
          type="datetime-local"
          value={toDateTimeInputValue(value.kickoffIso)}
          onChange={event => {
            const kickoffIso = fromDateTimeInputValue(event.target.value)
            onChange({ kickoffIso, kickoffLabel: kickoffLabelFor(kickoffIso) })
          }}
          aria-label={`Kickoff for selection ${index + 1}`}
          className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] text-main-text outline-none focus:border-accent/60"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] text-muted-text">Market</span>
        <select
          value={value.marketId}
          onChange={event => {
            const nextMarket = findAdminMarketOption(event.target.value)
            const option = nextMarket?.options[0]
            onChange({
              marketId: nextMarket?.id ?? event.target.value,
              marketName: nextMarket?.name ?? value.marketName,
              selectionId: option?.id ?? value.selectionId,
              selectionLabel: option?.label ?? value.selectionLabel,
              odds: option?.odds ?? value.odds,
              probability: option?.probability ?? value.probability,
            })
          }}
          aria-label={`Market for selection ${index + 1}`}
          className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] text-main-text outline-none focus:border-accent/60"
        >
          {market ? null : <option value={value.marketId}>{value.marketName || value.marketId}</option>}
          {ADMIN_MARKET_OPTIONS.map(option => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] text-muted-text">Selection</span>
        <select
          value={value.selectionId}
          onChange={event => {
            const option = findAdminSelectionOption(value.marketId, event.target.value)
            onChange({
              selectionId: option?.id ?? event.target.value,
              selectionLabel: option?.label ?? value.selectionLabel,
              odds: option?.odds ?? value.odds,
              probability: option?.probability ?? value.probability,
            })
          }}
          aria-label={`Selection for selection ${index + 1}`}
          className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] text-main-text outline-none focus:border-accent/60"
        >
          {market ? null : (
            <option value={value.selectionId}>{value.selectionLabel || value.selectionId}</option>
          )}
          {marketSelectionOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
