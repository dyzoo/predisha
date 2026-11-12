import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { SlotsGame } from '@/components/bet/slots-game'
import { getViewer } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Slots',
  description: 'A three-reel sandbox slots game with weighted symbols.',
}

export default async function SlotsPage() {
  await connection()
  const viewer = await getViewer()
  if (!viewer.userId) {
    return (
      <AuthRequired
        title="Sign in to play Slots"
        description="Slots rounds use your sandbox wallet and are settled by the server."
        nextPath="/bet/games/slots"
      />
    )
  }
  return <SlotsGame />
}

export const instant = false
