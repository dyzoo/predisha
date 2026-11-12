import { redirect } from 'next/navigation'

export default function BetLoginPage() {
  redirect('/sign-in?next=/bet')
}
