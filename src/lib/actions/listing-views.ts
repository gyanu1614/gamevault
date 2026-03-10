'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Track a listing view
 * Increments the view_count for a listing
 */
export async function trackListingView(listingId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current view count and increment
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('view_count')
      .eq('id', listingId)
      .single()

    if (fetchError) {
      console.error('Error fetching listing:', fetchError)
      return { success: false, error: fetchError.message }
    }

    // Increment view count
    const newCount = (listing.view_count || 0) + 1
    const { error: updateError } = await supabase
      .from('listings')
      .update({ view_count: newCount })
      .eq('id', listingId)

    if (updateError) {
      console.error('Error tracking view:', updateError)
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error tracking view:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get view count for a listing
 */
export async function getListingViewCount(listingId: string): Promise<{
  success: boolean
  viewCount?: number
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('listings')
      .select('view_count')
      .eq('id', listingId)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, viewCount: data.view_count || 0 }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
