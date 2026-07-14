/**
 * Sitewide Open Graph image — DropMarket brand card.
 */

import { ImageResponse } from 'next/og'
import { OgCard, OG_SIZE } from '@/lib/seo/og-template'

export const alt =
  'DropMarket — Buy & Sell Game Currency, Items & Accounts. Covered by SafeDrop Buyer Protection.'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Image() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="The Gaming Marketplace"
        title="Buy & Sell Game Currency, Items & Accounts"
        subtitle="Verified Sellers · Instant Delivery · Seller Fees From 5%"
      />
    ),
    { ...OG_SIZE }
  )
}
