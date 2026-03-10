import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getSellerApplication } from '@/lib/actions/admin-sellers'
import ApplicationDetail from './ApplicationDetail'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface Props {
  params: {
    id: string
  }
}

export default async function ApplicationDetailPage({ params }: Props) {
  await requireAdmin()
  const application = await getSellerApplication(params.id)

  if (!application) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/admin/sellers"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Applications
      </Link>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Application Review</h1>
        <p className="text-gray-400 mt-1">Review seller application and documents</p>
      </div>

      {/* Application Detail Component */}
      <ApplicationDetail application={application} />
    </div>
  )
}