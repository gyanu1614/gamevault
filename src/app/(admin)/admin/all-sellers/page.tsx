/**
 * /admin/all-sellers — Sellers: everyone on the seller journey, newest
 * first, with the signup funnel on top. Filters, search and page live in
 * the URL so a view can be shared and the back button works; the loader
 * applies them on the server and returns one page.
 */
import { getAllSellers } from '@/lib/actions/admin-all-sellers'
import type { SellerStageFilter, SellerTrustFilter } from '@/lib/admin/all-sellers'
import AllSellersClient from './_components/AllSellersClient'

export const metadata = { title: 'Sellers' }

type Search = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

const STAGES: SellerStageFilter[] = ['all', 'in_progress', 'live', 'listed', 'sold', 'stalled']
const TRUST: SellerTrustFilter[] = ['all', 'verified', 'new']

export default async function AdminAllSellersPage({ searchParams }: { searchParams: Search }) {
  const stage = (STAGES.includes(one(searchParams.stage) as SellerStageFilter) ? one(searchParams.stage) : 'all') as SellerStageFilter
  const trust = (TRUST.includes(one(searchParams.trust) as SellerTrustFilter) ? one(searchParams.trust) : 'all') as SellerTrustFilter
  const filters = {
    q: one(searchParams.q),
    stage,
    trust,
    founding: one(searchParams.founding) === '1',
    page: Math.max(1, Number(one(searchParams.page)) || 1),
  }
  const result = await getAllSellers(filters)
  return <AllSellersClient result={result} filters={filters} />
}
