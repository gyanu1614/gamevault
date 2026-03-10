'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from '@/components/navbar-floating'
import { Footer } from '@/components/footer'

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Don't show navbar and footer on admin pages
  const isAdminPage = pathname?.startsWith('/admin')

  // Check if we're on a seller page with sidebar (not /new or /edit)
  const isSellerPageWithSidebar = pathname?.startsWith('/seller') &&
    !pathname?.includes('/new') &&
    !pathname?.includes('/edit')

  // Account pages have sidebar, except for order detail pages
  const isOrderDetail = /^\/account\/orders\/[^/]+$/.test(pathname || '')
  const isAccountPage = pathname?.startsWith('/account') && !isOrderDetail

  const hasSidebar = isSellerPageWithSidebar || isAccountPage

  return (
    <div className="flex min-h-screen flex-col">
      {!isAdminPage && <Navbar />}
      <main className="flex-1">{children}</main>
      {!isAdminPage && <Footer hasSellerSidebar={hasSidebar} />}
    </div>
  )
}