import { BrandLogo } from '@/components/brand-logo'

export function BrandLoading({
  message = 'Loading Predisha',
  className = 'min-h-[60vh]',
}: {
  message?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center px-4 py-10 ${className}`}
    >
      <div className="flex w-full max-w-sm flex-col items-center">
        <BrandLogo surface="dark" className="h-12 w-auto sm:h-14" priority />
        <div className="mt-6 w-full">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"
            aria-hidden="true"
          >
            <div className="brand-loading-bar__fill h-full rounded-full bg-accent" />
          </div>
          <p className="mt-3 text-center text-xs font-medium text-muted-text">{message}</p>
        </div>
      </div>
    </div>
  )
}
