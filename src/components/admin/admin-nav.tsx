import Link from 'next/link'
import { LayoutDashboard, Users } from 'lucide-react'

const items = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
]

export function AdminNav({ active }: { active: string }) {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-2">
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
