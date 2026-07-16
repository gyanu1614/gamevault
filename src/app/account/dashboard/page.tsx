'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import BuyerDashboard from '@/components/account/BuyerDashboard'
import SellerDashboard from '@/components/account/SellerDashboard'
import AccountLoading from '@/app/account/loading'

// V22 — Dashboard router. Seller status comes straight from useAuth
// (`isApprovedSeller`, derived from the fresh profiles.role) — no separate
// seller_applications query here; that was a redundant per-load round-trip.
export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // While auth resolves, show the dashboard skeleton (not a centered spinner).
  // With the site-wide green top progress bar: top bar → skeleton → content.
  if (loading || !user) {
    return <AccountLoading />
  }

  if (!user.isApprovedSeller) {
    return <BuyerDashboard user={user} />
  }

  return <SellerDashboard username={user.profile?.username || 'Seller'} userId={user.id} />
}
