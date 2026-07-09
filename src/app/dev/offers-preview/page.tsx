/**
 * DEV-ONLY offers-table design preview — the proposed seller "Offers"
 * pages (Currency / Items variants) rendered with real tokens and
 * primitives, on mock data, so the design can be approved before it's
 * wired to /account/listings. 404s outside development. Remove when
 * the offers revamp ships.
 */

import { notFound } from 'next/navigation'
import OffersPreview from './_OffersPreview'

export const metadata = { title: 'Offers Table Preview' }

export default function OffersPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <OffersPreview />
}
