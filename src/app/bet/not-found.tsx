import Link from 'next/link'

export default function BetNotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-border bg-surface/80 p-10 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold">That bet page does not exist</h1>
      <p className="mt-2 text-sm text-muted-text">
        The fixture, game or ticket may have moved. Head back to the sportsbook or arcade.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/bet/sports"
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background"
        >
          Sportsbook
        </Link>
        <Link
          href="/bet"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
        >
          Bet home
        </Link>
      </div>
    </div>
  )
}
