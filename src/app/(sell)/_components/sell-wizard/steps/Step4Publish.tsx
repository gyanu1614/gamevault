'use client'

import { quantityUnit } from '@/lib/currency/quantity-unit'
import { visiblePlatformKinds } from '@/app/(sell)/_components/PlatformFieldsBlock'

import { BundleSection } from './publish/BundleSection'
import { DeliverySection } from './publish/DeliverySection'
import { DescriptionSection } from './publish/DescriptionSection'
import { ListingDetailsSection } from './publish/ListingDetailsSection'
import { PhotosSection } from './publish/PhotosSection'
import { PriceSection } from './publish/PriceSection'
import { QuantitySection } from './publish/QuantitySection'
import { TitleSection } from './publish/TitleSection'
import type { Step4Props } from './publish/types'

export type { Step4Props } from './publish/types'

/**
 * The publish fields of the Details step, one section per decision:
 * title, listing details (currency), bundle (fixed-bundle currency),
 * description, photos, quantity, price, delivery. Currency listings skip the
 * title and photos (the server fills them from the currency record).
 */
export function Step4Publish(p: Step4Props) {
  const isCurrency = p.categorySlug === 'currency'
  // Bundle mode belongs to the GAME's currency config (it sells fixed
  // bundles), not to whether a bundle is picked yet.
  const isBundleMode = isCurrency && (p.bundles?.length ?? 0) > 0
  // Bundles ARE the unit ("1,000 units"); a flexible currency uses its
  // granularity suffix ("K Tokens"); other categories have none. Shared with
  // the buyer page so a seller's "100 M" is the buyer's "100 M".
  const suffix = isBundleMode ? 'unit' : isCurrency ? quantityUnit(p.granularity, p.unitLabel) : null

  return (
    <div className="space-y-4 sm:space-y-5">
      {!isCurrency && <TitleSection p={p} />}
      {isCurrency && visiblePlatformKinds(p.platformFields).length > 0 && <ListingDetailsSection p={p} />}
      {isBundleMode && <BundleSection p={p} />}
      <DescriptionSection p={p} isCurrency={isCurrency} />
      {!isCurrency && <PhotosSection p={p} />}
      <QuantitySection p={p} isCurrency={isCurrency} isBundleMode={isBundleMode} suffix={suffix} />
      <PriceSection p={p} isCurrency={isCurrency} isBundleMode={isBundleMode} suffix={suffix} />
      <DeliverySection p={p} />
    </div>
  )
}
