import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { SiteFooterAccount } from '@/components/site-footer-account'

const productLinks = [
  { href: '/matches', label: 'Matches' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/results', label: 'Results' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/about', label: 'About' },
]

const legalLinks = [
  { href: '/responsible-use', label: 'Responsible use' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/refund-policy', label: 'Refund policy' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-sm">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Predisha home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-background">
                <Sparkles className="h-5 w-5" strokeWidth={2.4} />
              </span>
              <span className="text-lg font-semibold tracking-tight">
                Predisha<span className="text-accent">.</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-text">
              Statistically grounded football analysis with transparent probabilities and honest
              performance tracking. Not a bookmaker. No bets, no wagering.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-main-text">Product</h3>
            <ul className="mt-4 space-y-2.5">
              {productLinks.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-text transition-colors hover:text-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-main-text">Account</h3>
            <SiteFooterAccount />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-main-text">Legal</h3>
            <ul className="mt-4 space-y-2.5">
              {legalLinks.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-text transition-colors hover:text-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-text sm:flex-row sm:items-center sm:justify-between">
          <p>© Predisha. Informational analysis only — not betting advice.</p>
          <p>Predictions are probabilities, not certainties. 18+ where applicable.</p>
        </div>
      </div>
    </footer>
  )
}
