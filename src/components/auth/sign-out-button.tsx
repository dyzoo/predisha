'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut } from 'lucide-react'
import { useViewer } from '@/components/ui/viewer-provider'

export function SignOutButton() {
  const router = useRouter()
  const { refreshViewer } = useViewer()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    try {
      await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' })
      await refreshViewer()
      router.push('/')
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:bg-elevated-surface disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Sign out
    </button>
  )
}
