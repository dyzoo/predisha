'use client'

import { useState } from 'react'
import type { TeamFeatures } from '@/lib/predictions/engine'
import type { MatchStatsFixtureView, MatchStatsView } from '@/lib/sports/view-model'

const TABS = ['Head to head', 'Form', 'Team Stats', 'Matches'] as const
type Tab = (typeof TABS)[number]

function EmptyState() {
  return (
    <p className="rounded-xl border border-dashed border-border bg-background/40 px-3 py-6 text-center text-xs text-muted-text">
      Not available yet
    </p>
  )
}

function FormPips({ form }: { form: TeamFeatures['form'] }) {
  const styles: Record<string, string> = {
    W: 'bg-accent/20 text-accent',
    D: 'bg-white/10 text-muted-text',
    L: 'bg-red-500/15 text-red-300',
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {form.map((result, index) => (
        <span
          key={`${result}-${index}`}
          className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${styles[result] ?? 'bg-white/10 text-muted-text'}`}
        >
          {result}
        </span>
      ))}
    </span>
  )
}

function FixtureRow({ item, pair }: { item: MatchStatsFixtureView; pair?: boolean }) {
  const score = item.score ? `${item.score.home} - ${item.score.away}` : '-'
  const resultStyle = item.result === 'W'
    ? 'text-accent'
    : item.result === 'L'
      ? 'text-red-300'
      : 'text-muted-text'
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">
          {pair
            ? `${item.homeName} vs ${item.awayName}`
            : `${item.side === 'HOME' ? 'vs' : 'at'} ${item.opponentName}`}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-muted-text">{item.kickoffLabel}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-display text-sm font-bold tabular-nums">{score}</span>
        {item.result ? <span className={`text-[10px] font-bold ${resultStyle}`}>{item.result}</span> : null}
      </div>
    </div>
  )
}

function TeamStatTable({ label, team }: { label: string; team: TeamFeatures }) {
  if (team.matches === 0) return <EmptyState />
  const rows: Array<[string, string | number]> = [
    ['Matches', team.matches],
    ['Wins', team.wins],
    ['Draws', team.draws],
    ['Losses', team.losses],
    ['Goals for', team.goalsFor],
    ['Goals against', team.goalsAgainst],
    ['Elo', Math.round(team.elo)],
  ]
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p className="text-xs font-semibold">{label}</p>
      <dl className="mt-3 space-y-2">
        {rows.map(([name, value]) => (
          <div key={name} className="flex items-center justify-between gap-3 text-[11px]">
            <dt className="text-muted-text">{name}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function FixtureList({
  title,
  items,
  pair,
}: {
  title: string
  items: MatchStatsFixtureView[]
  pair?: boolean
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-text">
        {title}
      </p>
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {items.map(item => <FixtureRow key={item.id} item={item} pair={pair} />)}
        </div>
      )}
    </div>
  )
}

export function MatchStatsTabs({
  stats,
  homeName,
  awayName,
}: {
  stats: MatchStatsView
  homeName: string
  awayName: string
}) {
  const [active, setActive] = useState<Tab>('Head to head')

  const infoRows: Array<{ label: string; value: string | null }> = [
    {
      label: 'Full-time score',
      value: stats.fullTime ? `${stats.fullTime.home} - ${stats.fullTime.away}` : null,
    },
    {
      label: 'Half-time score',
      value: stats.halfTime ? `${stats.halfTime.home} - ${stats.halfTime.away}` : null,
    },
    { label: 'Venue', value: stats.venue },
    { label: 'Referee', value: stats.referee },
  ]

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface/60 p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">Match insights</h2>
      <div role="tablist" aria-label="Match insights" className="mt-4 flex flex-wrap gap-2">
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active === tab}
            onClick={() => setActive(tab)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              active === tab
                ? 'border-accent/40 bg-accent/15 text-accent'
                : 'border-border bg-background/40 text-muted-text hover:text-main-text'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={active} className="mt-5">
        {active === 'Head to head' ? (
          <div>
            {stats.h2h.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <p className="mb-3 text-[11px] leading-relaxed text-muted-text">
                  Finished fixtures between these teams in the current dataset.
                </p>
                <div className="space-y-2">
                  {stats.h2h.map(item => <FixtureRow key={item.id} item={item} pair />)}
                </div>
              </>
            )}
          </div>
        ) : null}

        {active === 'Form' ? (
          <div className="space-y-4">
            {[
              { name: homeName, form: stats.form.home },
              { name: awayName, form: stats.form.away },
            ].map(team => (
              <div key={team.name}>
                <p className="mb-2 text-xs font-semibold">{team.name}</p>
                {team.form.length === 0 ? <EmptyState /> : <FormPips form={team.form} />}
              </div>
            ))}
          </div>
        ) : null}

        {active === 'Team Stats' ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TeamStatTable label={homeName} team={stats.team.home} />
              <TeamStatTable label={awayName} team={stats.team.away} />
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-3">
              <dl className="space-y-2">
                {infoRows.map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-3 text-[11px]">
                    <dt className="text-muted-text">{row.label}</dt>
                    <dd className="font-semibold text-main-text">{row.value ?? 'Not available yet'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : null}

        {active === 'Matches' ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { name: homeName, recent: stats.recent.home, upcoming: stats.upcoming.home },
              { name: awayName, recent: stats.recent.away, upcoming: stats.upcoming.away },
            ].map(team => (
              <div key={team.name} className="space-y-4">
                <p className="text-xs font-semibold">{team.name}</p>
                <FixtureList title="Recent" items={team.recent} />
                <FixtureList title="Next" items={team.upcoming} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
