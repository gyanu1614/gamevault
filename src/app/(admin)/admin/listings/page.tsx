/**
 * /admin/listings: find any listing and act on it. Search, status and page live
 * in the URL so a view can be shared and the back button works; the loader
 * applies them on the server and returns one page. No router.refresh after an
 * action: the action's own revalidate re-renders this page with fresh rows.
 */
import { requireRole } from '@/lib/actions/admin-permissions'
import { getAdminListings } from '@/lib/actions/admin-listings'
import { ADMIN_LISTING_STATUSES, type AdminListingStatus } from '@/lib/admin/admin-listings'
import AdminListingsClient from './_components/AdminListingsClient'

export const metadata = { title: 'Listings' }

type Search = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function AdminListingsPage({ searchParams }: { searchParams: Search }) {
  await requireRole(['admin', 'moderator', 'super_admin'])

  const status = ADMIN_LISTING_STATUSES.find((s) => s.value === one(searchParams.status))?.value as AdminListingStatus | undefined
  const filters = {
    q: one(searchParams.q),
    status,
    page: Math.max(1, Number(one(searchParams.page)) || 1),
  }
  const result = await getAdminListings(filters)
  return <AdminListingsClient result={result} filters={filters} />
}
