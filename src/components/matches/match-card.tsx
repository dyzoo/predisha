import Link from 'next/link'
import { ArrowUpRight, CalendarDays, CircleAlert, Radio } from 'lucide-react'
import { TeamBadge } from '@/components/teams/team-badge'
import { MatchBookmarkLink } from '@/components/matches/match-bookmark-link'
import type { MatchView } from '@/lib/sports/view-model'

function FormPips({ form }: { form: MatchView['form']['home'] }) {
  if (form.length === 0) {
    return <span className="text-[10px] text-muted-text">No recent form</span>
  }

  const styles: Record<string, string> = {
    W: 'bg-accent/20 text-accent',
    D: 'bg-white/10 text-muted-text',
    L: 'bg-red-500/15 text-red-300',
  }

  return (
    <span className="flex items-center gap-1" aria-label={`Recent form: ${form.join(', ')}`}>
      {form.map((result, index) => (
        <span
          key={`${result}-${index}`}
          className={`flex h-4 w-4 items-center justify-center rounded-[4px] text-[9px] font-bold ${styles[result]}`}
        >
          {result}
        </span>
      ))}
    </span>
  )
}

export function ProbabilityBar({ probability }: { probability: NonNullable<MatchView['probability']> }) {
  return (
    <div
      className="flex h-1.5 overflow-hidden rounded-full bg-elevated-surface"
      role="img"
      aria-label={`Home ${Math.round(probability.home * 100)} percent, draw ${Math.round(probability.draw * 100)} percent, away ${Math.round(probability.away * 100)} percent`}
    >
      <span className="h-full bg-accent" style={{ width: `${probability.home * 100}%` }} />
      <span className="h-full bg-white/25" style={{ width: `${probability.draw * 100}%` }} />
      <span className="h-full bg-[#5B8CFF]" style={{ width: `${probability.away * 100}%` }} />
    </div>
  )
}

export function MatchCard({ match, isDemo }: { match: MatchView; isDemo: boolean }) {
  const isLive = match.effectiveStatus === 'LIVE'
  const isFinished = match.effectiveStatus === 'FINISHED'

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-border bg-surface/70 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-surface sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/matches/${match.id}`}
          className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-text hover:text-accent"
        >
          {match.competition}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              Live
            </span>
          ) : isFinished ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-text">
              Full time
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-text">
              <CalendarDays className="h-3 w-3" />
              Upcoming
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {[
          { team: match.home, form: match.form.home, score: match.score?.home },
          { team: match.away, form: match.form.away, score: match.score?.away },
        ].map(side => (
          <div key={side.team.id} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <TeamBadge team={side.team} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{side.team.name}</p>
                <FormPips form={side.form} />
              </div>
            </div>
            {match.score ? (
              <span className="font-display text-xl font-bold tabular-nums">{side.score}</span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-auto pt-5">
        {match.probability ? (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-text">
              <span>{match.kickoffLabel}</span>
              <span className="inline-flex items-center gap-1 text-accent">
                H {Math.round(match.probability.home * 100)}%
                <span className="text-muted-text">·</span>D{' '}
                {Math.round(match.probability.draw * 100)}%
                <span className="text-muted-text">·</span>A{' '}
                {Math.round(match.probability.away * 100)}%
              </span>
            </div>
            <div className="mt-2">
              <ProbabilityBar probability={match.probability} />
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-background/30 px-3 py-2 text-[11px] leading-relaxed text-muted-text">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Insufficient data for a reliable estimate.
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <Link
            href={`/matches/${match.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            Match analysis
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          {isDemo ? (
            <span className="text-[10px] uppercase tracking-wide text-muted-text">Demo</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-text">
              <Radio className="h-3 w-3" />
              {match.dataAsOfLabel ?? 'No data timestamp'}
            </span>
          )}
          <MatchBookmarkLink
            matchId={match.id}
            homeName={match.home.name}
            awayName={match.away.name}
          />
        </div>
      </div>
    </article>
  )
}
