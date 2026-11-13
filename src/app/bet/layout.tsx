import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { connection } from 'next/server'
import { getBetMode } from '@/lib/bet/mode'
import { toClientViewer } from '@/lib/auth/entitlements'
import { getViewer } from '@/lib/auth/session'
import { BetShell } from '@/components/bet/bet-shell'

export const metadata: Metadata = {
  title: {
    default: 'PredishaBet',
    template: '%s | PredishaBet',
  },
  description:
    'Sportsbook and arcade with transparent model-generated odds, betting wallets and server-side settlement.',
}

export default async function BetLayout({ children }: { children: ReactNode }) {
  await connection()
  const [mode, viewer] = await Promise.all([getBetMode(), getViewer()])
  return <BetShell viewer={toClientViewer(viewer)} mode={mode}>{children}</BetShell>
}

export const instant = false
