import Image from 'next/image'

export function BrandLogo({
  surface = 'dark',
  className = 'h-7 w-auto',
  priority = false,
}: {
  surface?: 'dark' | 'light'
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src={
        surface === 'dark' ? '/spotibet_white-01.svg' : '/spotibet_01.svg'
      }
      alt="SpotibetBet"
      width={150}
      height={32}
      className={className}
      priority={priority}
      unoptimized
    />
  )
}
