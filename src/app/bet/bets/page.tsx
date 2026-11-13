import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { SectionHeading } from '@/components/bet/section-heading'
import { TicketsList } from '@/components/bet/tickets-list'
import { WalletCard } from '@/components/bet/wallet-card'
import { getViewer } from '@/lib/auth/session'
import { listTickets } from '@/lib/bet/bets'
import { getWalletView } from '@/lib/bet/wallet'

export const metadata: Metadata = {
  title: 'My bets',
  description: 'Betting tickets, settlements and cash-out options.',
}

export default async function BetTicketsPage() {
  await connection()
  const viewer = await getViewer()
  if (!viewer.userId) {
    return (
      <AuthRequired
        title="Sign in to see your tickets"
        description="Tickets, settlements and cash-out values are tied to your Predisha account."
        nextPath="/bet/bets"
      />
    )
  }

  const [wallet, tickets] = await Promise.all([
    getWalletView(viewer.userId),
    listTickets(viewer.userId),
  ])

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Tickets"
        title="My bets"
        description="Tickets settle automatically when the fixture feed reports a final score. Demo fixtures can be resolved manually."
        action="Place another bet"
        actionHref="/bet/sports"
      />


      <WalletCard wallet={wallet} showTransactions={false} />

      <TicketsList tickets={tickets} />
    </div>
  )
}

export const instant = false
