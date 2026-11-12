import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface GameCardDefinition {
  href: string
  title: string
  description: string
  icon: LucideIcon
  tag: string
}

export function GameCard({ game }: { game: GameCardDefinition }) {
  const Icon = game.icon
  return (
    <Link
      href={game.href}
      className="group flex flex-col rounded-2xl border border-border bg-surface/80 p-5 transition-colors hover:border-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-muted-text">
          {game.tag}
        </span>
      </div>
      <h2 className="mt-3 font-display text-lg font-semibold">{game.title}</h2>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-text">{game.description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent">
        Play sandbox
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  )
}
