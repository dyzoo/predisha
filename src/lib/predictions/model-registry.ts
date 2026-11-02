import { MODEL_VERSION, MODEL_CONFIG } from './engine'

export interface ModelRegistryEntry {
  version: string
  name: string
  active: boolean
  config: typeof MODEL_CONFIG
  createdAt: Date
  approvedBy?: string
  evaluationSummary?: {
    sampleSize: number
    brierScore: number | null
    logLoss: number | null
  }
}

export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    version: MODEL_VERSION,
    name: 'elo-poisson-0.1.0',
    active: true,
    config: MODEL_CONFIG,
    createdAt: new Date('2025-01-01'),
    approvedBy: 'system-default',
    evaluationSummary: {
      sampleSize: 0,
      brierScore: null,
      logLoss: null,
    },
  },
]

export function getActiveModel(): ModelRegistryEntry {
  const active = MODEL_REGISTRY.find(m => m.active)
  if (!active) throw new Error('No active prediction model configured.')
  return active
}
