'use client'

import { useAuth } from '@/hooks/use-auth'
import AccountSidebar from '@/components/account/AccountSidebar'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/account')}`)
    }
  }, [user, loading, pathname, router])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render protected content if not authenticated
  if (!user) {
    return null
  }

  // Flatten profile data for AccountSidebar
  const sidebarUser = user ? {
    username: user.profile?.username || user.email?.split('@')[0] || '',
    email: user.email || '',
    avatar_url: user.profile?.avatar_url,
    seller_tier: user.profile?.seller_tier,
    isApprovedSeller: user.isApprovedSeller,
    shop_name: user.profile?.shop_name,
    shop_slug: user.profile?.shop_slug,
    seller_status: user.profile?.seller_status as 'active' | 'restricted' | 'banned',
  } : undefined

  // Hide sidebar on certain pages for a clean full-width view
  const isOrderDetail = /^\/account\/orders\/[^/]+$/.test(pathname || '')
  const isBecomeSeller = pathname === '/account/become-seller'
  const isSellerStatus = pathname === '/account/seller-status'

  if (isOrderDetail || isBecomeSeller || isSellerStatus) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] pt-8 sm:pt-10 md:pt-12">
        {children}
      </div>
    )
  }

  return (
    <>
      <AccountSidebar user={sidebarUser} />
      <div className="min-h-screen bg-black pt-[4.5rem] lg:pl-72">
        {children}
      </div>
    </>
  )
}
