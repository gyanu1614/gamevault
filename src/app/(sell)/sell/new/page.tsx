/**
 * /sell/new — server entry. Hands the wizard the initial category list.
 *
 * Supports `?from=<listingId>` for the D4 duplicate-listing flow — the id
 * is forwarded to the wizard, which fetches the source listing's fields
 * and pre-fills itself on mount.
 */

import { fetchSellCategories } from '@/lib/actions/sell-wizard'
import SellWizard from '../../_components/SellWizard'

export const dynamic = 'force-dynamic'

export default async function SellNewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const [{ from }, res] = await Promise.all([
    searchParams,
    fetchSellCategories(),
  ])
  const categories = res.success ? res.data : []
  return <SellWizard initialCategories={categories} duplicateFromId={from ?? null} />
}
