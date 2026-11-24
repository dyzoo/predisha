'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/intelligence/ui-states'

export default function Error({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const digest =
    error instanceof Error && typeof (error as Error & { digest?: string }).digest === 'string'
      ? (error as Error & { digest?: string }).digest
      : undefined

  return <ErrorState retry={retry} digest={digest} />
}
