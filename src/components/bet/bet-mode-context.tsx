'use client'

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import type { BetMode } from '@/lib/bet/mode-copy'
import { MIN_DEPOSIT_MINOR } from '@/lib/bet/types'

const BetModeContext = createContext<{ mode: BetMode; depositMinMinor: number }>({
  mode: 'LIVE',
  depositMinMinor: MIN_DEPOSIT_MINOR,
})

export function BetModeProvider({
  mode,
  depositMinMinor = MIN_DEPOSIT_MINOR,
  children,
}: {
  mode: BetMode
  depositMinMinor?: number
  children: ReactNode
}) {
  const value = useMemo(() => ({ mode, depositMinMinor }), [mode, depositMinMinor])
  return <BetModeContext.Provider value={value}>{children}</BetModeContext.Provider>
}

export function useBetMode() {
  const context = useContext(BetModeContext)
  return context
}
