/**
 * /sell/new — server entry. Hands the wizard the initial category list.
 */

import { fetchSellCategories } from '@/lib/actions/sell-wizard'
import SellWizard from '../../_components/SellWizard'

export const dynamic = 'force-dynamic'

export default async function SellNewPage() {
  const res = await fetchSellCategories()
  const categories = res.success ? res.data : []
  return <SellWizard initialCategories={categories} />
}
