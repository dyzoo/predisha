import { Prisma } from '@prisma/client'
import { computeTicketTotals } from './bets'
import type { TicketSelection } from './types'

export interface AdminSlipPropagationInput {
  slipId: string
  selections: TicketSelection[]
  stakeMinor?: number | null
}

export async function syncAdminBetEntrySelections(
  tx: Prisma.TransactionClient,
  input: AdminSlipPropagationInput,
): Promise<void> {
  const { totalOdds } = computeTicketTotals(input.stakeMinor ?? 0, input.selections)
  await tx.adminBetEntry.updateMany({
    where: { slipId: input.slipId },
    data: {
      selections: input.selections as unknown as Prisma.InputJsonValue,
      totalOdds,
    },
  })
  if (input.stakeMinor != null) {
    await tx.adminBetEntry.updateMany({
      where: { slipId: input.slipId, status: 'PENDING' },
      data: { stakeMinor: input.stakeMinor },
    })
  }
}

export async function propagateAdminSlipChange(
  tx: Prisma.TransactionClient,
  input: AdminSlipPropagationInput,
): Promise<void> {
  await syncAdminBetEntrySelections(tx, input)

  const entries = await tx.adminBetEntry.findMany({
    where: { slipId: input.slipId },
    select: { ticketId: true },
  })
  const ticketIds = [
    ...new Set(entries.map(entry => entry.ticketId).filter((id): id is string => Boolean(id))),
  ]
  if (ticketIds.length === 0) return

  const tickets = await tx.betTicket.findMany({
    where: { id: { in: ticketIds }, status: 'OPEN' },
    select: { id: true, stakeMinor: true },
  })
  for (const ticket of tickets) {
    const totals = computeTicketTotals(ticket.stakeMinor, input.selections)
    await tx.betTicket.update({
      where: { id: ticket.id },
      data: {
        selections: input.selections as unknown as Prisma.InputJsonValue,
        totalOdds: totals.totalOdds,
        potentialReturnMinor: totals.potentialReturnMinor,
      },
    })
  }
}
