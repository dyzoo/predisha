import { connection } from 'next/server'
import { json } from '@/lib/api'
import { getPublicPlans } from '@/lib/billing/plans'

export async function GET() {
  await connection()
  return json({ data: getPublicPlans() })
}
