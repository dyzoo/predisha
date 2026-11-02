'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  createContext,
  useContext,
} from 'react'
import type { ClientViewer } from '@/lib/auth/entitlements'

interface ViewerContextValue {
  viewer: ClientViewer | null
  authConfigured: boolean
  loading: boolean
  refreshViewer: () => Promise<void>
}

const ViewerContext = createContext<ViewerContextValue | null>(null)

export function ViewerProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<ClientViewer | null>(null)
  const [authConfigured, setAuthConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/me', {
        credentials: 'include',
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => ({}))) as {
        data?: ClientViewer | null
        meta?: { authConfigured?: boolean }
      }
      if (!mountedRef.current) return
      setViewer(payload.data ?? null)
      setAuthConfigured(Boolean(payload.meta?.authConfigured))
    } catch {
      if (!mountedRef.current) return
      setViewer(null)
      setAuthConfigured(false)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    // The state updates happen after the awaited request, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    return () => {
      mountedRef.current = false
    }
  }, [load])

  const refreshViewer = useCallback(() => load(), [load])

  return (
    <ViewerContext.Provider value={{ viewer, authConfigured, loading, refreshViewer }}>
      {children}
    </ViewerContext.Provider>
  )
}

export function useViewer() {
  const ctx = useContext(ViewerContext)
  if (!ctx) {
    throw new Error('useViewer must be used within a ViewerProvider')
  }
  return ctx
}
