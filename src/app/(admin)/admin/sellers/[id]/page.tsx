import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getSellerApplication } from '@/lib/actions/admin-sellers'
import ApplicationDetail from './ApplicationDetail'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { PageHeader } from '../../components/kit'

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
        className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Applications
      </Link>

      {/* Page Header */}
      <PageHeader
        title="Application Review"
        description="Review seller application and documents"
        className="mb-0"
      />

      {/* Application Detail Component */}
      <ApplicationDetail application={application} />
    </div>
  )
}
