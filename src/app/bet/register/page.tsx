import { redirect } from 'next/navigation'

export default function BetRegisterPage() {
  redirect('/sign-up?next=/bet')
}
