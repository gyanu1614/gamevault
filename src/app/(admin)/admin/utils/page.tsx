import { requireRole } from '@/lib/actions/admin-permissions'
import FixApprovedSellersButton from './FixApprovedSellersButton'
import CreateTestListingsButton from './CreateTestListingsButton'
import { getApprovedSellerStats } from '@/lib/actions/fix-approved-sellers'
import { PageHeader, AdminPanel } from '../components/kit'

export const metadata = { title: 'Utilities' }

export default async function AdminUtilsPage() {
  await requireRole(['super_admin', 'admin'])
  const stats = await getApprovedSellerStats()

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Admin Utilities"
        description="Tools for maintaining and fixing data issues"
      />

      <div className="grid max-w-2xl gap-4">
        {/* Fix Approved Sellers */}
        <AdminPanel>
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            Fix Approved Sellers Role
          </h2>
          <p className="mb-4 text-sm text-text-secondary">
            Update user roles for approved seller applications. This ensures all approved sellers have the correct &quot;seller&quot; role in their profile.
          </p>

          {stats.success && (
            <div className="mb-4 space-y-2 rounded-lg border border-border-subtle bg-bg-overlay p-4">
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
        </AdminPanel>

        {/* Create Test Listings */}
        <AdminPanel>
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            Test Listings for Checkout
          </h2>
          <p className="mb-4 text-sm text-text-secondary">
            Create sample listings to test the checkout and payment flow. This will create 3 test listings with different price points to test SafeDrop protection levels.
          </p>

          <div className="mb-4 rounded-lg border border-border-subtle bg-bg-overlay p-4">
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
        </AdminPanel>
      </div>
    </div>
  )
}
