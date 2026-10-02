'use client'

import { useEffect } from 'react'
import { trackListingView } from '@/lib/actions/listing-views'

interface ViewTrackerProps {
  listingId: string
}

/**
 * Counts one view when a listing page opens in a browser (so crawlers and
 * link prefetches don't). Fire and forget: a missed count never matters to
 * the visitor, so failures stay silent. Dedupe and the seller's own views are
 * handled by the action.
 */
export default function ViewTracker({ listingId }: ViewTrackerProps) {
  useEffect(() => {
    trackListingView(listingId).catch(() => {})
  }, [listingId])

  return null
}
