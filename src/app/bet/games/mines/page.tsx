import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { MinesGame } from '@/components/bet/mines-game'
import { getViewer } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Mines',
  description: 'A sandbox 5×5 mines game with server-stored mine positions.',
}

export default async function MinesPage() {
  await connection()
  const viewer = await getViewer()
  if (!viewer.userId) {
    return (
      <AuthRequired
        title="Sign in to play Mines"
        description="Mine positions and payouts are stored server-side against your sandbox wallet."
        nextPath="/bet/games/mines"
      />
    )
  }
  return <MinesGame />
}

export const instant = false
