import type { ReactNode } from 'react'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { SignOutButton } from '@/components/auth/sign-out-button'

interface AdminShellProps {
  eyebrow?: string
  title: string
  intro?: string
  children: ReactNode
}

export function AdminShell({ eyebrow, title, intro, children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <header className="border-b border-border bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" aria-label="Admin console home" className="flex shrink-0 items-center">
              <BrandLogo priority className="h-10 w-auto" />
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
              <ShieldCheck className="h-3 w-3" />
              Admin only
            </span>
          </div>
          <SignOutButton redirectTo="/" />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
          ) : null}
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          {intro ? <p className="mt-4 text-base leading-relaxed text-muted-text">{intro}</p> : null}
          <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-text">{children}</div>
        </div>
      </main>
    </div>
  )
}
