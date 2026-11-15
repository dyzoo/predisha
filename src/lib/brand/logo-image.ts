export type LogoSurface = 'dark' | 'light'

export const BRAND_LOGO_ASPECT = 150 / 32

const logoCache = new Map<LogoSurface, Promise<HTMLImageElement | null>>()

export function loadBrandLogo(surface: LogoSurface = 'dark'): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)

  const cached = logoCache.get(surface)
  if (cached) return cached

  const promise = new Promise<HTMLImageElement | null>(resolve => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = surface === 'light' ? '/spotibet_white-01.svg' : '/spotibet-01.svg'
  })

  logoCache.set(surface, promise)
  return promise
}
