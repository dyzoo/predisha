import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { connection } from 'next/server'
import { toClientViewer } from '@/lib/auth/entitlements'
import { getViewer } from '@/lib/auth/session'
import { BetShell } from '@/components/bet/bet-shell'

export const metadata: Metadata = {
  title: {
    default: 'PredishaBet · sandbox sportsbook',
    template: '%s · PredishaBet',
  },
  description:
    'A sandbox sportsbook and arcade with transparent simulated odds, play-money wallets and no real payments.',
}

export default async function BetLayout({ children }: { children: ReactNode }) {
  await connection()
  const viewer = await getViewer()
  return <BetShell viewer={toClientViewer(viewer)}>{children}</BetShell>
}

export const instant = false
