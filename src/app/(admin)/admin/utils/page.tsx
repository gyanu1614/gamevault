import { requireRole } from '@/lib/actions/admin-permissions'
import FixApprovedSellersButton from './FixApprovedSellersButton'
import CreateTestListingsButton from './CreateTestListingsButton'
import { getApprovedSellerStats } from '@/lib/actions/fix-approved-sellers'

export default async function AdminUtilsPage() {
  await requireRole(['super_admin', 'admin'])
  const stats = await getApprovedSellerStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Admin Utilities</h1>
        <p className="text-gray-400 text-sm">
          Tools for maintaining and fixing data issues
        </p>
      </div>

      <div className="grid gap-4 max-w-2xl">
        {/* Fix Approved Sellers */}
        <div className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">
            Fix Approved Sellers Role
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Update user roles for approved seller applications. This ensures all approved sellers have the correct &quot;seller&quot; role in their profile.
          </p>

          {stats.success && (
            <div className="bg-white/[0.03] rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Approved Applications:</span>
                <span className="text-white font-medium">{stats.totalApproved}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Unique Users:</span>
                <span className="text-blue-400 font-medium">{stats.uniqueUsers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">With Seller Role:</span>
                <span className="text-green-400 font-medium">{stats.hasSellerRole}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Needs Update:</span>
                <span className="text-yellow-400 font-medium">{stats.needsUpdate}</span>
              </div>
            </div>
          )}

          <FixApprovedSellersButton needsUpdate={stats.success ? stats.needsUpdate || 0 : 0} />
        </div>

        {/* Create Test Listings */}
        <div className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">
            Test Listings for Checkout
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Create sample listings to test the checkout and payment flow. This will create 3 test listings with different price points to test VaultShield protection levels.
          </p>

          <div className="bg-white/[0.03] rounded-lg p-4 mb-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span className="text-gray-300">Valorant Radiant Account - $149.99 (Enhanced Protection)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span className="text-gray-300">Roblox Premium Account - $79.99 (Standard Protection)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span className="text-gray-300">Fortnite OG Account - $599.99 (Premium Protection)</span>
              </div>
            </div>
          </div>

          <CreateTestListingsButton />
        </div>
      </div>
    </div>
  )
}
