import { apiError, json } from '@/lib/api'
import { getBetEvent } from '@/lib/bet/catalog'
import { handleBetError } from '@/lib/bet/errors'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  try {
    const { fixtureId } = await params
    const { event, catalog } = await getBetEvent(fixtureId, new Date())
    if (!event) return apiError('Fixture not found in the betting catalogue.', 404)
    return json({
      event,
      meta: {
        demo: catalog.demo,
        providerMessage: catalog.providerMessage,
        simulated: true,
      },
    })
  } catch (error) {
    return handleBetError(error)
  }
}
