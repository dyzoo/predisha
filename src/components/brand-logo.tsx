export function BrandLogo({
  surface = 'dark',
  className = 'h-14 w-auto sm:h-16',
  priority = false,
}: {
  surface?: 'dark' | 'light'
  className?: string
  priority?: boolean
}) {
  void priority
  return (
    <span
      className={`inline-flex min-w-0 flex-col leading-none ${className}`}
      role="img"
      aria-label="Predisha"
    >
      <span
        className={`whitespace-nowrap font-display text-[1.35rem] font-black tracking-[-0.06em] sm:text-[1.6rem] ${
          surface === 'light' ? 'text-[#0B0F14]' : 'text-main-text'
        }`}
      >
        PRE<span className="text-accent">DISHA</span>
        <span className="text-accent">.</span>
      </span>
      <span className="mt-0.5 whitespace-nowrap text-[0.5rem] font-semibold uppercase tracking-[0.32em] text-muted-text sm:text-[0.56rem]">
        Football intelligence
      </span>
    </span>
  )
}
