import Link from 'next/link'
import { CreditCard, SlidersHorizontal, UserRound } from 'lucide-react'

const items = [
  { href: '/settings/profile', label: 'Profile', icon: UserRound },
  { href: '/settings/preferences', label: 'Preferences', icon: SlidersHorizontal },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
]

export function SettingsNav({ active }: { active: string }) {
  return (
    <nav aria-label="Settings" className="flex flex-wrap gap-2">
      {items.map(item => {
        const Icon = item.icon
        const isActive = item.href === active
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
              isActive
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-border bg-surface text-muted-text hover:text-main-text'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
