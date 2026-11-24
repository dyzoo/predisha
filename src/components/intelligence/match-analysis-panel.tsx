import { BarChart3, CircleAlert, Database, Info, ShieldCheck, Sparkles } from 'lucide-react'
import type { MarketOption, PredictionResult } from '@/lib/predictions/engine'
import { StatusBadge } from './status-badge'

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

function fairOdds(value: number): string {
  if (!Number.isFinite(value) || value <= 1) return '—'
  return value.toFixed(2)
}

export function MatchAnalysisPanel({
  probability,
  expectedGoals,
  marketOptions,
  modelVersion,
  dataAsOfLabel,
  qualityFlags,
  explanation,
  facts,
  isDemo,
}: {
  probability: { home: number; draw: number; away: number } | null
  expectedGoals: { home: number; away: number } | null
  marketOptions: MarketOption[]
  modelVersion: string | null
  dataAsOfLabel: string | null
  qualityFlags: string[]
  explanation: string | null
  facts: PredictionResult['structuredFacts'] | null
  isDemo: boolean
}) {
  const markets = marketOptions
    .filter(option => option.market !== '1X2')
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 8)

  if (!probability || !expectedGoals) {
    return (
      <section className="intel-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Predisha analysis</h2>
          <StatusBadge kind="NO_SELECTION" />
        </div>
        <div className="intel-empty mt-5">
          <CircleAlert className="h-6 w-6 text-muted-text" aria-hidden />
          <p className="font-semibold text-main-text">No model selection for this match</p>
          <p>
            The engine withholds a prediction when recent data is missing, stale or too small a sample.
            No probability or fair price is invented to fill this space.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="intel-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="intel-eyebrow">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Predisha analysis
          </p>
          <h2 className="mt-2 font-display text-xl font-bold">Probability & fair price model</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind={isDemo ? 'DEMO' : 'ESTIMATED'} />
          {modelVersion ? <span className="intel-chip">{modelVersion}</span> : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Home', value: probability.home, tone: 'text-accent' },
          { label: 'Draw', value: probability.draw, tone: 'text-main-text' },
          { label: 'Away', value: probability.away, tone: 'text-[#8FB4FF]' },
        ].map(item => (
          <div key={item.label} className="intel-panel-quiet p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-text">{item.label}</p>
            <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${item.tone}`}>{pct(item.value)}</p>
            <p className="mt-1 text-[10px] text-muted-text">Model fair {fairOdds(1 / item.value)}</p>
          </div>
        ))}
      </div>

      <div className="intel-progress mt-4" role="img" aria-label={`Home ${pct(probability.home)}, draw ${pct(probability.draw)}, away ${pct(probability.away)}`}>
        <span style={{ width: pct(probability.home) }} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="intel-panel-quiet flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-text">Expected goals</p>
            <p className="mt-1 text-sm font-semibold">Home {expectedGoals.home.toFixed(2)} · Away {expectedGoals.away.toFixed(2)}</p>
          </div>
          <BarChart3 className="h-5 w-5 text-accent" aria-hidden />
        </div>
        <div className="intel-panel-quiet flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-text">Input timestamp</p>
            <p className="mt-1 text-sm font-semibold">{dataAsOfLabel ?? 'Not supplied'}</p>
          </div>
          <Database className="h-5 w-5 text-muted-text" aria-hidden />
        </div>
      </div>

      {markets.length > 0 ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-text">Supported markets</h3>
            <p className="flex items-center gap-1.5 text-[10px] text-muted-text">
              <Info className="h-3 w-3" aria-hidden />
              Fair odds are model-generated, not bookmaker prices
            </p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {markets.map(option => (
              <div key={option.key} className="intel-panel-quiet flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-snug">{option.label}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-text">
                    {option.market} · {option.risk} risk
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-sm font-bold tabular-nums text-accent">{pct(option.probability)}</p>
                  <p className="text-[10px] tabular-nums text-muted-text">Fair {fairOdds(option.impliedOdds)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        <details className="intel-panel-quiet group p-4" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
            Analyst assessment
            <span className="text-[10px] font-bold uppercase tracking-wide text-accent">Evidence</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-text">
            {explanation ?? 'No written assessment is available for this fixture.'}
          </p>
        </details>

        <details className="intel-panel-quiet p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold">Supporting numbers</summary>
          {facts ? (
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              {[
                ['Recent matches', `${facts.homeMatches} home · ${facts.awayMatches} away`],
                ['Goals scored / match', `${facts.homeGoalsPerMatch.toFixed(2)} · ${facts.awayGoalsPerMatch.toFixed(2)}`],
                ['Goals conceded / match', `${facts.homeGoalsConcededPerMatch.toFixed(2)} · ${facts.awayGoalsConcededPerMatch.toFixed(2)}`],
                ['Elo snapshot', `${Math.round(facts.homeElo)} · ${Math.round(facts.awayElo)}`],
                ['Home advantage', `+${Math.round(facts.homeAdvantageElo)} Elo`],
                ['League goal baseline', facts.leagueAverageGoals.toFixed(2)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                  <dt className="text-muted-text">{label}</dt>
                  <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-xs text-muted-text">Structured model inputs are not available.</p>
          )}
        </details>

        <details className="intel-panel-quiet p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold">Quality, limitations & uncertainty</summary>
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-text">
            <p>
              Probabilities are estimates from a baseline Elo + Poisson model using pre-kickoff data.
              They are not guarantees, betting advice or bookmaker prices.
            </p>
            <div className="flex flex-wrap gap-2">
              {qualityFlags.length > 0 ? (
                qualityFlags.map(flag => (
                  <span key={flag} className="intel-chip border-amber-300/30 bg-amber-300/10 text-amber-200">
                    <CircleAlert className="h-3 w-3" aria-hidden />
                    {flag.replaceAll('_', ' ')}
                  </span>
                ))
              ) : (
                <span className="intel-chip intel-chip-accent">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  No blocking quality flags
                </span>
              )}
            </div>
          </div>
        </details>
      </div>
    </section>
  )
}
