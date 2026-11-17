import { BrandLoading } from '@/components/ui/brand-loading'

export default function AdminLoading() {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-white">
      <BrandLoading className="min-h-0 w-full max-w-sm bg-white" message="Loading admin" />
    </div>
  )
}
