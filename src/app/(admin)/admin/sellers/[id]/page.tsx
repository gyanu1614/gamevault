import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getSellerApplication } from '@/lib/actions/admin-sellers'
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

  // Forest Ledger — the detail component owns the whole page: the hero
  // band carries the breadcrumb (Sellers / Applications / <shop>) so the
  // old back-link + PageHeader would be duplicates.
  return <ApplicationDetail application={application} />
}
