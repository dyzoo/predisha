import Link from 'next/link'
import { SiteFooterAccount } from '@/components/site-footer-account'
import { BrandLogo } from '@/components/brand-logo'

const productLinks = [
  { href: '/matches', label: 'Matches' },
  { href: '/leagues', label: 'Competitions' },
  { href: '/teams', label: 'Teams' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/results', label: 'Results' },
  { href: '/builder', label: 'Builder' },
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
            <Link href="/" className="flex min-w-0 items-center" aria-label="Spotibet home">
              <BrandLogo className="h-14 w-auto sm:h-16" />
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
          <p>© Spotibet. Informational analysis only, not betting advice.</p>
          <p>Predictions are probabilities, not certainties. 18+ where applicable.</p>
        </div>
      </div>
    </footer>
  )
}
