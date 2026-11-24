import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { TeamBadge } from '@/components/teams/team-badge'
import type { StandingRowView } from '@/lib/sports/standings-service'

export type StandingsRow = StandingRowView & {
  localTeamId?: string | null
  color?: string | null
}

export function StandingsTable({
  rows,
  highlightedTeamIds = [],
}: {
  rows: StandingsRow[]
  highlightedTeamIds?: string[]
}) {
  if (rows.length === 0) {
    return (
      <div className="intel-empty">
        <p className="font-semibold text-main-text">Standings are not available</p>
        <p>This competition does not provide a league table through the current data provider.</p>
      </div>
    )
  }

  return (
    <div className="intel-scroll rounded-xl border border-border">
      <table className="intel-table">
        <caption className="sr-only">League standings</caption>
        <thead className="bg-elevated-surface/60 text-[10px] uppercase tracking-[0.12em] text-muted-text">
          <tr>
            <th scope="col">#</th>
            <th scope="col">Team</th>
            <th scope="col">P</th>
            <th scope="col">W</th>
            <th scope="col">D</th>
            <th scope="col">L</th>
            <th scope="col">GF</th>
            <th scope="col">GA</th>
            <th scope="col">GD</th>
            <th scope="col">Pts</th>
            <th scope="col">Form</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const highlighted = row.localTeamId
              ? highlightedTeamIds.includes(row.localTeamId)
              : false
            return (
              <tr
                key={`${row.teamId}-${row.position}`}
                className={`border-t border-border/70 ${highlighted ? 'bg-accent-soft' : ''}`}
              >
                <td className="font-semibold tabular-nums text-muted-text">{row.position}</td>
                <td>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <TeamBadge
                      team={{
                        id: row.teamId,
                        name: row.teamName,
                        short: row.teamName.slice(0, 2).toUpperCase(),
                        color: row.color ?? '#334155',
                        logoUrl: row.logoUrl,
                      }}
                      size="xs"
                    />
                    {row.localTeamId ? (
                      <Link href={`/teams/${row.localTeamId}`} className="intel-link group inline-flex min-w-0 items-center gap-1 font-semibold">
                        <span className="min-w-0 leading-snug">{row.teamName}</span>
                        <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                      </Link>
                    ) : (
                      <span className="min-w-0 font-semibold leading-snug">{row.teamName}</span>
                    )}
                  </div>
                </td>
                <td className="tabular-nums">{row.played}</td>
                <td className="tabular-nums">{row.won}</td>
                <td className="tabular-nums">{row.drawn}</td>
                <td className="tabular-nums">{row.lost}</td>
                <td className="tabular-nums">{row.goalsFor}</td>
                <td className="tabular-nums">{row.goalsAgainst}</td>
                <td className={`tabular-nums ${row.goalDifference > 0 ? 'text-accent' : row.goalDifference < 0 ? 'text-red-300' : 'text-muted-text'}`}>
                  {row.goalDifference > 0 ? '+' : ''}
                  {row.goalDifference}
                </td>
                <td className="font-bold tabular-nums">{row.points}</td>
                <td>
                  {row.form.length > 0 ? (
                    <span className="flex items-center gap-1">
                      {row.form.map((result, index) => (
                        <span
                          key={`${result}-${index}`}
                          role="img"
                          aria-label={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
                          title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
                          className={`flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold ${
                            result === 'W'
                              ? 'bg-accent/20 text-accent'
                              : result === 'L'
                                ? 'bg-red-500/15 text-red-300'
                                : 'bg-white/10 text-muted-text'
                          }`}
                        >
                          {result}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-text">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
