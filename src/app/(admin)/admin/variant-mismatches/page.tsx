/**
 * /admin/variant-mismatches — Adopt Me listings whose title names a different
 * variant than the seller's Trait pick. Worked out when the page opens (a few
 * hundred rows, admin only); nothing is stored and no job runs for it.
 */
import { loadVariantMismatches } from '@/lib/actions/admin-variant-mismatches'
import VariantMismatchesClient from './_components/VariantMismatchesClient'

export const metadata = { title: 'Variant Mismatches' }

export default async function VariantMismatchesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const page = Number(Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page) || 1
  const result = await loadVariantMismatches(page)
  return result.success ? (
    <VariantMismatchesClient {...result.data} error={null} />
  ) : (
    <VariantMismatchesClient rows={[]} total={0} page={1} pageSize={25} error={result.error} />
  )
}
