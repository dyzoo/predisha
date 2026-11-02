import { prisma } from '@/lib/prisma'
import type { BuilderResult } from './builder-types'
import {
  settleSelections,
  summarizeHistory,
  type ActualFixtureResult,
  type HistorySummary,
  type PredictionHistoryItem,
  type SlipSettlement,
} from './history-settlement'

export { summarizeHistory }
export type {
  HistorySummary,
  PredictionHistoryItem,
  PredictionHistorySelection,
  SettleableSelection,
  SlipStatusValue,
} from './history-settlement'

export const HISTORY_LIMIT = 25

export async function savePredictionSlip(
  userId: string,
  result: BuilderResult,
): Promise<string> {
  const slip = await prisma.predictionSlip.create({
    data: {
      userId,
      stake: result.stake,
      currency: result.currency,
      risk: result.risk,
      odds: result.oddsSource === 'user' ? result.usedOdds : null,
      oddsSource: result.oddsSource,
      impliedCombinedOdds: result.impliedCombinedOdds,
      combinedProbability: result.combinedProbability,
      potentialReturn: result.potentialReturn,
      netProfit: result.netProfit,
      modelVersion: result.selections[0]?.modelVersion ?? null,
      dataAsOf: result.dataAsOfIso ? new Date(result.dataAsOfIso) : null,
      generatedAt: new Date(result.generatedAt),
      demo: result.demo,
      limited: result.limited,
      selections: {
        create: result.selections.map(selection => ({
          fixtureId: selection.fixtureId,
          competition: selection.competition,
          homeName: selection.homeName,
          awayName: selection.awayName,
          kickoffUtc: new Date(selection.kickoffIso),
          outcomeKey: selection.outcomeKey,
          probability: selection.probability,
          impliedOdds: selection.impliedOdds,
          homeProbability: selection.homeProbability,
          drawProbability: selection.drawProbability,
          awayProbability: selection.awayProbability,
        })),
      },
    },
    select: { id: true },
  })
  return slip.id
}

function settlementChanged(
  slip: {
    status: string
    brierScore: number | null
    selections: Array<{ actualOutcome: string | null; correct: boolean | null; brierScore: number | null }>
  },
  settlement: SlipSettlement,
): boolean {
  if (slip.status !== settlement.status) return true
  if (slip.brierScore === null && settlement.brierScore !== null) return true
  return slip.selections.some((selection, index) => {
    const next = settlement.selections[index]
    return (
      selection.actualOutcome !== (next?.actualOutcome ?? null) ||
      selection.correct !== (next?.correct ?? null) ||
      selection.brierScore !== (next?.brierScore ?? null)
    )
  })
}

export async function listPredictionHistory(
  userId: string,
  limit = HISTORY_LIMIT,
): Promise<{ slips: PredictionHistoryItem[]; summary: HistorySummary }> {
  const slips = await prisma.predictionSlip.findMany({
    where: { userId },
    orderBy: { generatedAt: 'desc' },
    take: limit,
    include: { selections: { orderBy: { kickoffUtc: 'asc' } } },
  })

  const fixtureIds = [...new Set(slips.flatMap(slip => slip.selections.map(item => item.fixtureId)))]
  const fixtures = fixtureIds.length
    ? await prisma.fixture.findMany({
        where: { id: { in: fixtureIds } },
        select: { id: true, status: true, homeScore: true, awayScore: true },
      })
    : []
  const fixturesById = new Map(
    fixtures.map(fixture => [
      fixture.id,
      {
        status: fixture.status,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
      } satisfies ActualFixtureResult,
    ]),
  )

  const items: PredictionHistoryItem[] = []
  for (const slip of slips) {
    const settlement = settleSelections(slip.selections, fixturesById)

    if (settlementChanged(slip, settlement)) {
      await prisma.$transaction([
        prisma.predictionSlip.update({
          where: { id: slip.id },
          data: {
            status: settlement.status,
            brierScore: settlement.brierScore,
            settledAt: slip.settledAt ?? settlement.settledAt,
          },
        }),
        ...slip.selections.map((selection, index) => {
          const next = settlement.selections[index]
          return prisma.predictionSlipSelection.update({
            where: { id: selection.id },
            data: {
              actualOutcome: next?.actualOutcome ?? null,
              correct: next?.correct ?? null,
              brierScore: next?.brierScore ?? null,
            },
          })
        }),
      ])
    }

    items.push({
      ...slip,
      status: settlement.status,
      brierScore: settlement.brierScore,
      settledAt: slip.settledAt ?? settlement.settledAt,
      selections: slip.selections.map((selection, index) => ({
        ...selection,
        actualOutcome: settlement.selections[index]?.actualOutcome ?? null,
        correct: settlement.selections[index]?.correct ?? null,
        brierScore: settlement.selections[index]?.brierScore ?? null,
      })),
    })
  }

  return { slips: items, summary: summarizeHistory(items) }
}
