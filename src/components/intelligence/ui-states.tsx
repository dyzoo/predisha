'use client'

import type { ReactNode } from 'react'
import { CircleAlert, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('intel-skeleton min-h-4 w-full', className)} aria-hidden="true" />
}

export function IntelPageSkeleton({ variant = 'list' }: { variant?: 'list' | 'table' | 'profile' }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <div className="h-16 w-full border-b border-border bg-surface/40 sm:h-20" aria-hidden="true" />
      <main className="intel-shell intel-section flex-1" role="status" aria-live="polite">
        <span className="sr-only">Loading football data</span>
        <LoadingSkeleton className="h-4 w-32" />
        <LoadingSkeleton className="mt-5 h-10 max-w-md" />
        <LoadingSkeleton className="mt-3 h-4 max-w-xl" />

        <div className="intel-grid mt-8">
          {[0, 1, 2].map(index => (
            <div key={index} className="intel-panel-quiet p-4">
              <LoadingSkeleton className="h-3 w-20" />
              <LoadingSkeleton className="mt-3 h-7 w-14" />
            </div>
          ))}
        </div>

        <div className="intel-panel mt-6 p-5">
          <LoadingSkeleton className="h-5 w-40" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2, 3, 4].map(index => (
              <div key={index} className="flex items-center gap-3">
                <LoadingSkeleton className="h-8 w-8 shrink-0 rounded-lg" />
                <LoadingSkeleton className={cn('h-4', variant === 'profile' ? 'max-w-xs' : 'max-w-lg')} />
                <LoadingSkeleton className="ml-auto hidden h-4 w-12 sm:block" />
              </div>
            ))}
          </div>
        </div>

        {variant === 'table' ? (
          <div className="intel-panel mt-6 overflow-hidden p-5">
            <LoadingSkeleton className="h-5 w-32" />
            <div className="mt-5 space-y-2">
              {[0, 1, 2, 3].map(index => (
                <LoadingSkeleton key={index} className="h-9" />
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('intel-empty', className)}>
      {icon ? <span className="text-accent" aria-hidden="true">{icon}</span> : null}
      <p className="font-semibold text-main-text">{title}</p>
      {description ? <p className="max-w-prose">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'This view could not be loaded',
  description = 'The data service may be temporarily unavailable. Your other Predisha pages are unaffected.',
  retry,
  digest,
}: {
  title?: string
  description?: string
  retry?: () => void
  digest?: string
}) {
  return (
    <div className="intel-shell flex min-h-[60vh] items-center py-10" role="alert">
      <div className="intel-panel w-full max-w-xl p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-text">{description}</p>
            {digest ? <p className="mt-2 text-[11px] text-muted-text">Reference: {digest}</p> : null}
            {retry ? (
              <button
                type="button"
                onClick={retry}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
