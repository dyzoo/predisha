import type { ReactNode } from 'react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

interface PageShellProps {
  eyebrow?: string
  title: string
  intro?: string
  children: ReactNode
}

export function PageShell({ eyebrow, title, intro, children }: PageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
          ) : null}
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          {intro ? <p className="mt-4 text-base leading-relaxed text-muted-text">{intro}</p> : null}
          <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-text">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
