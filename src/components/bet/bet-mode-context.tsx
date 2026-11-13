'use client'

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import type { BetMode } from '@/lib/bet/mode-copy'

const BetModeContext = createContext<{ mode: BetMode }>({ mode: 'LIVE' })

export function BetModeProvider({
  mode,
  children,
}: {
  mode: BetMode
  children: ReactNode
}) {
  const value = useMemo(() => ({ mode }), [mode])
  return <BetModeContext.Provider value={value}>{children}</BetModeContext.Provider>
}

export function useBetMode() {
  const context = useContext(BetModeContext)
  return context
}
