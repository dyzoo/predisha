export default function BetLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent"
        role="status"
        aria-label="Loading sportsbook"
      />
    </div>
  )
}
