import { json } from '@/lib/api'
import { getSportsDataset } from '@/lib/sports/service'

export async function GET() {
  const dataset = await getSportsDataset()
  return json({
    data: dataset.sportList,
    meta: { demo: dataset.isDemo, provider: dataset.health.mode },
  })
}
