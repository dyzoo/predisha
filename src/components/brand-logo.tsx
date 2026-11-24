import Image from 'next/image'

export function BrandLogo({
  surface = 'dark',
  className = 'h-14 w-auto sm:h-16',
  priority = false,
}: {
  surface?: 'dark' | 'light'
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src={
        surface === 'dark' ? '/Spotibetone_white-01.svg' : '/Spotibetone-01.svg'
      }
      alt="SpotibetBet"
      width={282}
      height={96}
      className={className}
      priority={priority}
      unoptimized
    />
  )
}
