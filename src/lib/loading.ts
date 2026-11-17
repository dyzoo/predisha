export const MIN_LOADING_MS = 4_000

export async function waitForMinimum(
  startedAt: number,
  minimumMs = MIN_LOADING_MS,
): Promise<void> {
  const remaining = minimumMs - (Date.now() - startedAt)
  if (remaining > 0) {
    await new Promise(resolve => setTimeout(resolve, remaining))
  }
}

export async function withMinimumLoading<T>(
  work: Promise<T>,
  minimumMs = MIN_LOADING_MS,
): Promise<T> {
  const startedAt = Date.now()
  const result = await work
  await waitForMinimum(startedAt, minimumMs)
  return result
}
