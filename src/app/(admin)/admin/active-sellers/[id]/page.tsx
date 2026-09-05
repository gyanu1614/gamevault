/**
 * /admin/active-sellers/[id] — seller-management detail server wrapper.
 *
 * Thin: admin gate, one aggregated getSellerDetail fetch (seeds the client
 * component's react-query cache via initialDetail), 404 on unknown ids.
 */

import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getSellerDetail } from '@/lib/actions/admin-seller-detail'
import SellerDetailClient from './SellerDetailClient'

export const metadata = { title: 'Seller Management' }

interface Props {
  params: {
    id: string
  }
}

export default async function SellerDetailPage({ params }: Props) {
  await requireAdmin()

  const result = await getSellerDetail(params.id)
  if (!result.success || !result.detail) {
    notFound()
  }

  return <SellerDetailClient userId={params.id} initialDetail={result.detail} />
}
