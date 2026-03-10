/**
 * Price History API
 *
 * Functions for tracking and analyzing listing price changes
 * Works with the listing_price_history table and auto-trigger
 */

import { createClient } from '@/lib/supabase/client'

// Types
export interface PriceHistoryEntry {
  id: string
  listing_id: string
  old_price: number
  new_price: number
  changed_by: string
  reason: 'manual_change' | 'market_adjustment' | 'promotion' | 'bulk_update'
  changed_at: string
}

export interface PriceChange {
  oldPrice: number
  newPrice: number
  changeAmount: number
  changePercentage: number
  changedAt: string
  reason: string
}

export interface PriceStats {
  currentPrice: number
  lowestPrice: number
  highestPrice: number
  averagePrice: number
  totalChanges: number
  priceIncreases: number
  priceDecreases: number
  lastChanged: string | null
}

/**
 * Get price history for a specific listing
 */
export async function getListingPriceHistory(
  listingId: string,
  limit: number = 50
): Promise<{
  success: boolean
  data?: PriceHistoryEntry[]
  error?: string
}> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('listing_price_history')
      .select('*')
      .eq('listing_id', listingId)
      .order('changed_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching price history:', error)
      return {
        success: false,
        error: error.message || 'Failed to fetch price history'
      }
    }

    return {
      success: true,
      data: data as PriceHistoryEntry[]
    }
  } catch (error) {
    console.error('Unexpected error fetching price history:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Get formatted price changes with calculations
 */
export async function getListingPriceChanges(
  listingId: string,
  limit: number = 50
): Promise<{
  success: boolean
  data?: PriceChange[]
  error?: string
}> {
  const result = await getListingPriceHistory(listingId, limit)

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error
    }
  }

  const priceChanges: PriceChange[] = result.data.map(entry => {
    const changeAmount = entry.new_price - entry.old_price
    const changePercentage = (changeAmount / entry.old_price) * 100

    return {
      oldPrice: entry.old_price,
      newPrice: entry.new_price,
      changeAmount: parseFloat(changeAmount.toFixed(2)),
      changePercentage: parseFloat(changePercentage.toFixed(2)),
      changedAt: entry.changed_at,
      reason: entry.reason
    }
  })

  return {
    success: true,
    data: priceChanges
  }
}

/**
 * Get price statistics for a listing
 */
export async function getListingPriceStats(listingId: string): Promise<{
  success: boolean
  data?: PriceStats
  error?: string
}> {
  try {
    const supabase = createClient()

    // Get current listing price
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('price')
      .eq('id', listingId)
      .single()

    if (listingError) {
      return {
        success: false,
        error: 'Failed to fetch listing data'
      }
    }

    // Get all price history
    const historyResult = await getListingPriceHistory(listingId, 1000)

    if (!historyResult.success || !historyResult.data) {
      return {
        success: false,
        error: historyResult.error
      }
    }

    const history = historyResult.data

    // Calculate stats
    if (history.length === 0) {
      return {
        success: true,
        data: {
          currentPrice: listing.price,
          lowestPrice: listing.price,
          highestPrice: listing.price,
          averagePrice: listing.price,
          totalChanges: 0,
          priceIncreases: 0,
          priceDecreases: 0,
          lastChanged: null
        }
      }
    }

    const allPrices = [
      ...history.map(h => h.old_price),
      ...history.map(h => h.new_price),
      listing.price
    ]

    const lowestPrice = Math.min(...allPrices)
    const highestPrice = Math.max(...allPrices)
    const averagePrice = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length

    const priceIncreases = history.filter(h => h.new_price > h.old_price).length
    const priceDecreases = history.filter(h => h.new_price < h.old_price).length

    return {
      success: true,
      data: {
        currentPrice: listing.price,
        lowestPrice: parseFloat(lowestPrice.toFixed(2)),
        highestPrice: parseFloat(highestPrice.toFixed(2)),
        averagePrice: parseFloat(averagePrice.toFixed(2)),
        totalChanges: history.length,
        priceIncreases,
        priceDecreases,
        lastChanged: history[0]?.changed_at || null
      }
    }
  } catch (error) {
    console.error('Unexpected error calculating price stats:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Get price history for multiple listings (for seller dashboard)
 */
export async function getSellerPriceHistory(
  sellerId: string,
  limit: number = 100
): Promise<{
  success: boolean
  data?: Array<PriceHistoryEntry & { listing_title?: string }>
  error?: string
}> {
  try {
    const supabase = createClient()

    // Get seller's listings first
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id, title')
      .eq('seller_id', sellerId)

    if (listingsError) {
      return {
        success: false,
        error: 'Failed to fetch seller listings'
      }
    }

    const listingIds = listings.map(l => l.id)

    if (listingIds.length === 0) {
      return {
        success: true,
        data: []
      }
    }

    // Get price history for all listings
    const { data: history, error: historyError } = await supabase
      .from('listing_price_history')
      .select('*')
      .in('listing_id', listingIds)
      .order('changed_at', { ascending: false })
      .limit(limit)

    if (historyError) {
      return {
        success: false,
        error: 'Failed to fetch price history'
      }
    }

    // Add listing titles
    const historyWithTitles = history.map(entry => {
      const listing = listings.find(l => l.id === entry.listing_id)
      return {
        ...entry,
        listing_title: listing?.title
      }
    })

    return {
      success: true,
      data: historyWithTitles as Array<PriceHistoryEntry & { listing_title?: string }>
    }
  } catch (error) {
    console.error('Unexpected error fetching seller price history:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Get price trend data for charting (last N days)
 */
export async function getListingPriceTrend(
  listingId: string,
  days: number = 30
): Promise<{
  success: boolean
  data?: Array<{ date: string; price: number }>
  error?: string
}> {
  try {
    const supabase = createClient()

    // Get current price
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('price, created_at')
      .eq('id', listingId)
      .single()

    if (listingError) {
      return {
        success: false,
        error: 'Failed to fetch listing'
      }
    }

    // Get ALL price history (not limited by days for the query)
    const { data: history, error: historyError } = await supabase
      .from('listing_price_history')
      .select('*')
      .eq('listing_id', listingId)
      .order('changed_at', { ascending: true })

    if (historyError) {
      return {
        success: false,
        error: 'Failed to fetch price history'
      }
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Build trend data with proper date filling
    const trendData: Array<{ date: string; price: number }> = []

    if (!history || history.length === 0) {
      // No price changes - show flat line at current price
      const createdDate = new Date(listing.created_at)
      const displayStartDate = createdDate > startDate ? createdDate : startDate

      trendData.push({
        date: displayStartDate.toISOString().split('T')[0],
        price: listing.price
      })
      trendData.push({
        date: endDate.toISOString().split('T')[0],
        price: listing.price
      })
    } else {
      // Build a map of date -> price from history
      const priceMap = new Map<string, number>()

      // Get the initial price (old_price of first entry)
      const firstEntry = history[0]
      const firstDate = new Date(firstEntry.changed_at)

      // Set initial price point
      let currentPrice = firstEntry.old_price

      // Add data point for the start of the period (or listing creation, whichever is later)
      const createdDate = new Date(listing.created_at)
      const displayStartDate = createdDate > startDate ? createdDate : startDate
      const displayStartDateStr = displayStartDate.toISOString().split('T')[0]

      // If the first change happened after our display start, show the old price
      if (firstDate >= displayStartDate) {
        priceMap.set(displayStartDateStr, currentPrice)
      }

      // Process all price changes
      for (const entry of history) {
        const changeDate = new Date(entry.changed_at)
        const changeDateStr = changeDate.toISOString().split('T')[0]

        // Only include changes within our date range
        if (changeDate >= displayStartDate && changeDate <= endDate) {
          priceMap.set(changeDateStr, entry.new_price)
        }

        // Update current price
        currentPrice = entry.new_price
      }

      // Add today's price
      const todayStr = endDate.toISOString().split('T')[0]
      priceMap.set(todayStr, listing.price)

      // Convert map to sorted array
      const sortedDates = Array.from(priceMap.keys()).sort()

      for (const date of sortedDates) {
        trendData.push({
          date,
          price: priceMap.get(date)!
        })
      }
    }

    return {
      success: true,
      data: trendData
    }
  } catch (error) {
    console.error('Unexpected error fetching price trend:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Check if a listing's price has changed recently (within last N days)
 */
export async function hasRecentPriceChange(
  listingId: string,
  days: number = 7
): Promise<boolean> {
  try {
    const supabase = createClient()

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('listing_price_history')
      .select('id')
      .eq('listing_id', listingId)
      .gte('changed_at', startDate.toISOString())
      .limit(1)

    if (error) {
      console.error('Error checking recent price change:', error)
      return false
    }

    return data && data.length > 0
  } catch (error) {
    console.error('Unexpected error checking recent price change:', error)
    return false
  }
}

/**
 * Get price volatility score (0-100, higher = more volatile)
 */
export async function getPriceVolatility(listingId: string): Promise<{
  success: boolean
  score?: number
  description?: string
  error?: string
}> {
  const statsResult = await getListingPriceStats(listingId)

  if (!statsResult.success || !statsResult.data) {
    return {
      success: false,
      error: statsResult.error
    }
  }

  const stats = statsResult.data

  if (stats.totalChanges === 0) {
    return {
      success: true,
      score: 0,
      description: 'No price changes'
    }
  }

  // Calculate volatility based on price range and frequency of changes
  const priceRange = stats.highestPrice - stats.lowestPrice
  const rangePercentage = (priceRange / stats.averagePrice) * 100
  const changeFrequency = stats.totalChanges / 30 // Normalize to 30 days

  // Volatility score (0-100)
  const volatilityScore = Math.min(
    100,
    Math.round(rangePercentage * 0.7 + changeFrequency * 30)
  )

  let description = 'Stable'
  if (volatilityScore > 70) description = 'Highly volatile'
  else if (volatilityScore > 40) description = 'Moderately volatile'
  else if (volatilityScore > 20) description = 'Slightly volatile'

  return {
    success: true,
    score: volatilityScore,
    description
  }
}
