import { Bomb, CircleDot, Dices, Plane, Sparkles } from 'lucide-react'
import type { GameCardDefinition } from './game-card'

export const BET_GAMES: GameCardDefinition[] = [
  {
    href: '/bet/games/aviator',
    title: 'Aviator',
    description: 'Watch the multiplier climb and cash out before the round crashes.',
    icon: Plane,
    tag: 'Live rounds',
  },
  {
    href: '/bet/games/mines',
    title: 'Mines',
    description: 'Reveal gems on a 5×5 grid while avoiding server-placed mines.',
    icon: Bomb,
    tag: 'Strategy',
  },
  {
    href: '/bet/games/dice',
    title: 'Dice',
    description: 'Roll over or under a target with transparent win chances.',
    icon: Dices,
    tag: 'Instant',
  },
  {
    href: '/bet/games/roulette',
    title: 'Roulette',
    description: 'Single-zero roulette with outside bets and straight numbers.',
    icon: CircleDot,
    tag: 'Table',
  },
  {
    href: '/bet/games/slots',
    title: 'Slots',
    description: 'A three-reel arcade with weighted symbols and clear payouts.',
    icon: Sparkles,
    tag: 'Arcade',
  },
]
