import Link from 'next/link'
import type { ReactNode } from 'react'

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  actionHref,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: string
  actionHref?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-text">{description}</p> : null}
      </div>
      {action && actionHref ? (
        <Link href={actionHref} className="text-xs font-semibold text-accent hover:underline">
          {action}
        </Link>
      ) : null}
    </div>
  )
}
