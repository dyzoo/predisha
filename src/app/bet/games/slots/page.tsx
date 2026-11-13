import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { SlotsGame } from '@/components/bet/slots-game'
import { getViewer } from '@/lib/auth/session'
import { betModeCopy, getBetMode } from '@/lib/bet/mode'
import type { BetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'Slots',
  description: 'A live three-reel arcade with weighted symbols and clear payouts.',
}

export default async function SlotsPage() {
  await connection()
  const viewer = await getViewer()
  const mode: BetMode = await getBetMode()
  const copy = betModeCopy(mode)
  if (!viewer.userId) {
    return (
      <AuthRequired
        mode={mode}
        title="Sign in to play Slots"
        description={copy.gamesDescription}
        nextPath="/bet/games/slots"
      />
    )
  }
  return <SlotsGame />
}

export const instant = false