import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getSellerApplication } from '@/lib/actions/admin-sellers'
import { markApplicationUnderReview } from '@/lib/actions/admin-seller-review'
import ApplicationDetail from './ApplicationDetail'

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

  // "Review has begun" signal: an admin opening a pending application flips
  // it to under_review (race-guarded server-side) and notifies the applicant.
  // We patch the in-memory object so the chip shows In Review on this very
  // render; the seller's status page/timeline picks up the flip live via the
  // realtime seller-lifecycle publication on seller_applications.
  if (application.status === 'pending') {
    const result = await markApplicationUnderReview(params.id).catch(() => null)
    if (result?.changed) {
      application.status = 'under_review'
    }
  }

  // Forest Ledger — the detail component owns the whole page: the hero
  // band carries the breadcrumb (Sellers / Applications / <shop>) so the
  // old back-link + PageHeader would be duplicates.
  return <ApplicationDetail application={application} />
}
