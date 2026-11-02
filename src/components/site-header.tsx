'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Bookmark,
  ChevronDown,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { useLanguage } from '@/components/ui/language-provider'
import { useViewer } from '@/components/ui/viewer-provider'

const links = [
  { href: '/builder', label: 'Bet Builder' },
  { href: '/matches', label: 'Matches' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/results', label: 'Results' },
  { href: '/methodology', label: 'Methodology' },
]

const accountLinks = [
  { href: '/dashboard', label: 'Dashboard', description: 'Account overview', icon: LayoutDashboard },
  { href: '/builder', label: 'Build prediction', description: 'Create a new slip', icon: Sparkles },
  { href: '/saved', label: 'Saved matches', description: 'Your bookmarked fixtures', icon: Bookmark },
  { href: '/history', label: 'Prediction history', description: 'Stored slips and results', icon: History },
  { href: '/settings/profile', label: 'Profile', description: 'Name and account details', icon: UserRound },
  { href: '/settings/preferences', label: 'Preferences', description: 'Timezone and locale', icon: SlidersHorizontal },
  { href: '/settings/billing', label: 'Billing', description: 'Plan and subscription', icon: CreditCard },
]

const adminLink = { href: '/admin', label: 'Admin console', description: 'Operators only', icon: ShieldCheck }

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { lang, setLang } = useLanguage()
  const router = useRouter()
  const { viewer, loading, refreshViewer } = useViewer()
  const signedIn = Boolean(viewer?.userId)
  const isAdmin = viewer?.role === 'ADMIN'
  const displayName = viewer?.name?.trim() || viewer?.email || 'Account'
  const initial = displayName.charAt(0).toUpperCase()
  const visibleAccountLinks = isAdmin ? [...accountLinks, adminLink] : accountLinks

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!accountOpen) return
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen])

  async function handleSignOut() {
    await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' })
    await refreshViewer()
    setAccountOpen(false)
    setOpen(false)
    router.replace('/')
    router.refresh()
  }

  const authButtons = signedIn ? (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setAccountOpen(value => !value)}
        aria-haspopup="menu"
        aria-expanded={accountOpen}
        aria-label={`Open account menu for ${displayName}`}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-main-text transition-colors hover:bg-elevated-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-background">
          {initial}
        </span>
        <span className="hidden max-w-[9rem] truncate xl:inline">{displayName}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-text transition-transform ${accountOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {accountOpen ? (
          <motion.div
            role="menu"
            aria-label="Account"
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-semibold text-main-text">{displayName}</p>
              <p className="truncate text-xs text-muted-text">{viewer?.email}</p>
              <span className="mt-2 inline-flex rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                {isAdmin ? 'Administrator' : viewer?.premium ? 'Premium' : 'Free account'}
              </span>
            </div>

            <nav className="max-h-[60vh] overflow-y-auto py-1.5">
              {visibleAccountLinks.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-main-text">{item.label}</span>
                      <span className="block text-[11px] text-muted-text">{item.description}</span>
                    </span>
                  </Link>
                )
              })}
            </nav>

            <div className="border-t border-border p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-main-text transition-colors hover:bg-white/5"
              >
                <LogOut className="h-4 w-4 text-muted-text" />
                Sign out
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link
        href="/sign-in"
        className="rounded-lg px-3 py-2 text-sm font-medium text-main-text transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Sign in
      </Link>
      <Link
        href="/sign-up"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Create account
      </Link>
    </div>
  )

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'border-b border-border bg-background/85 backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Predisha home">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-background shadow-[0_0_24px_rgba(200,255,67,0.35)]">
            <Sparkles className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Predisha<span className="text-accent">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main navigation">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-text transition-colors hover:bg-white/5 hover:text-main-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent xl:px-3"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {!loading && (
            <>
              <button
                type="button"
                onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-main-text transition-colors hover:border-white/20 hover:bg-elevated-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Toggle Swahili / English"
              >
                {lang === 'en' ? 'SW' : 'EN'}
              </button>
              {authButtons}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-main-text lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <nav className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6" aria-label="Mobile navigation">
              {links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-main-text transition-colors hover:bg-white/5"
                >
                  {link.label}
                </Link>
              ))}

              {!loading ? (
                <div className="mt-2 border-t border-border pt-3">
                  {signedIn ? (
                    <>
                      <div className="flex items-center gap-3 px-3 pb-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-background">
                          {initial}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-main-text">{displayName}</p>
                          <p className="truncate text-[11px] text-muted-text">
                            {isAdmin ? 'Administrator' : viewer?.premium ? 'Premium' : 'Free account'}
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-1">
                        {visibleAccountLinks.map(item => {
                          const Icon = item.icon
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-main-text transition-colors hover:bg-white/5"
                            >
                              <Icon className="h-4 w-4 text-accent" />
                              {item.label}
                            </Link>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="mt-2 flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-main-text transition-colors hover:bg-white/5"
                      >
                        <LogOut className="h-4 w-4 text-muted-text" />
                        Sign out
                      </button>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href="/sign-in"
                        onClick={() => setOpen(false)}
                        className="rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold text-main-text"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/sign-up"
                        onClick={() => setOpen(false)}
                        className="rounded-lg bg-accent px-4 py-3 text-center text-sm font-semibold text-background"
                      >
                        Create account
                      </Link>
                    </div>
                  )}
                </div>
              ) : null}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
