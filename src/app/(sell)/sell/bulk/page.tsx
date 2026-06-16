/**
 * /sell/bulk — bulk CSV upload (Phase D5).
 *
 * Same auth gate as /sell/new (handled by the (sell) layout). Hands the
 * client component the global categories so it can resolve slugs.
 */

import { fetchSellCategories } from '@/lib/actions/sell-wizard'
import BulkUpload from '../../_components/BulkUpload'

export const dynamic = 'force-dynamic'

export default async function SellBulkPage() {
  const res = await fetchSellCategories()
  const categories = res.success ? res.data : []
  return <BulkUpload initialCategories={categories} />
}
