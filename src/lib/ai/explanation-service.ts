export interface StructuredAIInput {
  fixture: { homeTeam: string; awayTeam: string; competition: string; kickoffUtc: string }
  data: { sourceProviders: string[]; retrievedAt: string; qualityStatus: string; homeMatchesUsed: number; awayMatchesUsed: number; missingFeatures: string[] }
  model: { name: string; version: string; homeWinProbability: number; drawProbability: number; awayWinProbability: number; expectedHomeGoals: number; expectedAwayGoals: number }
}

export interface StructuredAIOutput {
  summary: string
  supportingFactors: string[]
  opposingFactors: string[]
  dataLimitations: string[]
  uncertaintyNote: string
  modelSelectionReference: string
}

export const AI_SYSTEM_INSTRUCTION = `You are the explanation layer of a football statistical analysis platform. You do not predict match outcomes independently. Explain only the verified fixture data, statistics, probabilities, model outputs, and limitations supplied in the request. Never invent facts, injuries, lineups, odds, statistics, probabilities, sources, or match context. Never change or increase supplied model probabilities. Distinguish measured facts from model estimates. Explain supporting and opposing factors. Mention missing or stale data when supplied. Never use "guaranteed win", "sure bet", "risk-free", "fixed match", or "certain outcome". If evidence is insufficient or contradictory, say so. Never claim to have searched the internet or checked live news unless a verified search tool actually supplied that information. Keep explanations concise, neutral, and understandable. Return only the requested structured output.`

export function validateAIOutput(output: unknown): output is StructuredAIOutput {
  if (typeof output !== 'object' || output === null) return false
  const value = output as Record<string, unknown>
  return (
    typeof value.summary === 'string' &&
    Array.isArray(value.supportingFactors) &&
    Array.isArray(value.opposingFactors) &&
    Array.isArray(value.dataLimitations) &&
    typeof value.uncertaintyNote === 'string' &&
    typeof value.modelSelectionReference === 'string'
  )
}

export function buildAIExplanation(input: StructuredAIInput): StructuredAIOutput {
  // Statistical explanation layer: uses verified input only; no LLM probability generation.
  return {
    summary: `The ${input.model.name} (${input.model.version}) estimates a ${Math.round(input.model.homeWinProbability * 100)}% chance for ${input.fixture.homeTeam}, ${Math.round(input.model.drawProbability * 100)}% for a draw and ${Math.round(input.model.awayWinProbability * 100)}% for ${input.fixture.awayTeam}.`,
    supportingFactors: [
      `Inputs used: ${input.data.homeMatchesUsed} recent ${input.fixture.homeTeam} matches and ${input.data.awayMatchesUsed} recent ${input.fixture.awayTeam} matches before the prediction cutoff.`,
      `Average goals projected: ${input.model.expectedHomeGoals.toFixed(2)} home and ${input.model.expectedAwayGoals.toFixed(2)} away.`,
    ],
    opposingFactors: input.data.missingFeatures.length > 0 ? [`Missing features: ${input.data.missingFeatures.join(', ')}.`] : [],
    dataLimitations: input.data.qualityStatus !== 'GOOD' ? [`Data quality: ${input.data.qualityStatus}.`] : [],
    uncertaintyNote: 'These are estimated probabilities, not certainties or betting advice. Missing or stale inputs are excluded rather than guessed.',
    modelSelectionReference: `Model: ${input.model.name} v${input.model.version}`,
  }
}
