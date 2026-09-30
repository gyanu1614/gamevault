import { requireRole } from '@/lib/actions/admin-permissions'
import FixApprovedSellersButton from './FixApprovedSellersButton'
import CreateTestListingsButton from './CreateTestListingsButton'
import { getApprovedSellerStats } from '@/lib/actions/fix-approved-sellers'
import { PageHeader, PanelHead } from '../components/kit'

export const metadata = { title: 'Utilities' }

export default async function AdminUtilsPage() {
  await requireRole(['super_admin', 'admin'])
  const stats = await getApprovedSellerStats()

  return (
    <div className="pb-10">
      <PageHeader
        title="Utilities"
        description="Tools for maintaining and fixing data issues."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Fix Approved Sellers */}
        <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
          <PanelHead
            title="Fix Approved Sellers Role"
            subtitle={<>Update user roles for approved seller applications. This ensures all approved sellers have the correct &quot;seller&quot; role in their profile.</>}
          />

          {stats.success && (
            <div className="mb-4 space-y-2 rounded-md bg-bg-overlay p-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">Total Approved Applications:</span>
                <span className="font-semibold tabular-nums text-text-primary">{stats.totalApproved}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">Unique Users:</span>
                <span className="font-semibold tabular-nums text-info">{stats.uniqueUsers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">With Seller Role:</span>
                <span className="font-semibold tabular-nums text-success">{stats.hasSellerRole}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">Needs Update:</span>
                <span className="font-semibold tabular-nums text-warning">{stats.needsUpdate}</span>
              </div>
            </div>
          )}

          <FixApprovedSellersButton needsUpdate={stats.success ? stats.needsUpdate || 0 : 0} />
        </section>

        {/* Create Test Listings */}
        <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
          <PanelHead
            title="Test Listings for Checkout"
            subtitle="Create sample listings to test the checkout and payment flow. This will create 3 test listings with different price points to test SafeDrop protection levels."
          />

          <div className="mb-4 rounded-md bg-bg-overlay p-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-text-tertiary">•</span>
                <span className="text-text-secondary">Valorant Radiant Account - $149.99 (Enhanced Protection)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-text-tertiary">•</span>
                <span className="text-text-secondary">Roblox Premium Account - $79.99 (Standard Protection)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-text-tertiary">•</span>
                <span className="text-text-secondary">Fortnite OG Account - $599.99 (Premium Protection)</span>
              </div>
            </div>
          </div>

          <CreateTestListingsButton />
        </section>
      </div>
    </div>
  )
}
