'use client'

/**
 * ShopLink — wraps seller chips/cards in a link to the seller's canonical
 * storefront, and degrades to a plain element when there is no slug.
 *
 * Exists because several surfaces built `/shop/{...}` from whatever seller
 * field was nearest — including the DISPLAY name, which produced dead URLs
 * like `/shop/BloxMarket` — and others emitted `/shop/undefined` for
 * sellers with no shop. Both failure modes are impossible here.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { sellerShopHref, type SellerIdentityInput } from '@/lib/seller/identity'

interface ShopLinkProps {
  /** Canonical slug (preferred), or a seller-shaped object to derive it. */
  slug?: string | null
  seller?: SellerIdentityInput | null
  className?: string
  children: ReactNode
}

export default function ShopLink({ slug, seller, className, children }: ShopLinkProps) {
  const href = slug ? `/shop/${slug}` : sellerShopHref(seller)

  if (!href) {
    return <div className={className}>{children}</div>
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
