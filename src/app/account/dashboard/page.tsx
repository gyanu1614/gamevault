'use client'

import { useAuth } from '@/hooks/use-auth'
import BuyerDashboard from '@/components/account/BuyerDashboard'
import SellerDashboard from '@/components/account/SellerDashboard'
import DashboardLoading from './loading'

// V22 — Dashboard router. Seller status comes straight from useAuth
// (`isApprovedSeller`, derived from the fresh profiles.role).
// Middleware and the account layout own sign-in; this only waits for a user,
// and a cached one renders at once instead of waiting for the profile refetch.
export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) return <DashboardLoading />

  if (!user.isApprovedSeller) {
    return <BuyerDashboard user={user} />
  }

  return <SellerDashboard username={user.profile?.username || 'Seller'} userId={user.id} />
}
