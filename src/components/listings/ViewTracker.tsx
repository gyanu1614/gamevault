'use client'

import { useEffect } from 'react'
import { trackListingView } from '@/lib/actions/listing-views'

interface ViewTrackerProps {
  listingId: string
}

/**
 * Client component to track listing views
 * Automatically tracks when the listing page is viewed
 */
export default function ViewTracker({ listingId }: ViewTrackerProps) {
  useEffect(() => {
    // Track view on mount
    const trackView = async () => {
      try {
        console.log('📊 Tracking view for listing:', listingId)
        const result = await trackListingView(listingId)
        if (result.success) {
          console.log('✅ View tracked successfully')
        } else {
          console.error('❌ View tracking failed:', result.error)
        }
      } catch (error) {
        console.error('❌ Failed to track view:', error)
      }
    }

    trackView()
  }, [listingId])

  // This component doesn't render anything
  return null
}
