import Link from 'next/link'
import { ArrowUpRight, CalendarDays, CircleAlert, Radio } from 'lucide-react'
import { TeamBadge } from '@/components/teams/team-badge'
import { ProbabilityBar } from '@/components/matches/match-card'
import type { MatchView } from '@/lib/sports/view-model'
import { TeamFormStrip } from './team-form-strip'

export function FixtureRows({
  matches,
  emptyMessage = 'No fixtures are available for this selection.',
  showCompetition = true,
  limit,
}: {
  matches: MatchView[]
  emptyMessage?: string
  showCompetition?: boolean
  limit?: number
}) {
  const rows = typeof limit === 'number' ? matches.slice(0, limit) : matches

  if (rows.length === 0) {
    return <div className="intel-empty">{emptyMessage}</div>
  }

  return (
    <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border">
      {rows.map(match => {
        const isLive = match.effectiveStatus === 'LIVE'
        return (
          <article key={match.id} className="grid min-w-0 gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-text">
                {showCompetition ? (
                  <Link href={`/leagues/${match.competitionId}`} className="intel-link min-w-0 leading-snug">
                    {match.competition}
                  </Link>
                ) : null}
                <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                  {isLive ? <Radio className="h-3 w-3 text-red-300" aria-hidden /> : <CalendarDays className="h-3 w-3" aria-hidden />}
                  {match.kickoffLabel}
                </span>
                {isLive ? <span className="font-bold text-red-300">Live {match.minute ? `${match.minute}'` : ''}</span> : null}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { team: match.home, form: match.form.home, score: match.score?.home },
                  { team: match.away, form: match.form.away, score: match.score?.away },
                ].map(side => (
                  <Link
                    key={`${match.id}-${side.team.id}`}
                    href={`/teams/${side.team.id}`}
                    className="intel-link flex min-w-0 items-center gap-3 rounded-lg px-1 py-1 hover:bg-white/[0.03]"
                  >
                    <TeamBadge team={side.team} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-snug">{side.team.name}</span>
                      <span className="mt-1 block"><TeamFormStrip form={side.form} compact /></span>
                    </span>
                    {typeof side.score === 'number' ? (
                      <span className="font-display text-lg font-bold tabular-nums">{side.score}</span>
                    ) : null}
                  </Link>
                ))}
              </div>

              {match.probability ? (
                <div className="mt-3 max-w-xl">
                  <ProbabilityBar probability={match.probability} />
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-text">
                  <CircleAlert className="h-3 w-3" aria-hidden />
                  No reliable model estimate yet
                </p>
              )}
            </div>

            <Link
              href={`/matches/${match.id}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background/40 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:border-accent-line sm:justify-start"
            >
              Analyse
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </article>
        )
      })}
    </div>
  )
}
