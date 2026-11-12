import { json } from '@/lib/api'
import { getBetCatalog } from '@/lib/bet/catalog'
import { handleBetError } from '@/lib/bet/errors'

export async function GET() {
  try {
    const catalog = await getBetCatalog(new Date())
    return json({
      events: catalog.events,
      meta: {
        demo: catalog.demo,
        providerMessage: catalog.providerMessage,
        providerOk: catalog.providerOk,
        generatedAt: catalog.generatedAt,
        simulated: true,
      },
    })
  } catch (error) {
    return handleBetError(error)
  }
}
