import { createClient } from '@/lib/supabase/client'
import type { ListingWithRelations } from '@/types/database'
import {
  BROWSE_CATEGORY_SELECT,
  BROWSE_GAME_SELECT,
  BROWSE_LISTING_SELECT,
  cleanListingSearch,
  listingOrder,
} from './listings-query'

export interface ListingsFilters {
  gameId?: string
  categoryId?: string
  minPrice?: number
  maxPrice?: number
  search?: string
  sortBy?: 'created_at' | 'price' | 'sales'
  /** Overrides the sort's natural direction (price: cheapest first, else newest first). */
  sortOrder?: 'asc' | 'desc'
  /** Page size and start row; no limit = the whole result (legacy callers). */
  limit?: number
  offset?: number
}

export async function getListings(filters: ListingsFilters = {}) {
  const supabase = createClient()

  // SEO hygiene: `!inner` + eq on the joined seller excludes listings from
  // test/demo accounts (profiles.is_test) from all public results — filters
  // parent rows via the inner join, works client- and server-side.
  let query = supabase
    .from('listings')
    .select(BROWSE_LISTING_SELECT)
    .eq('status', 'active')
    .eq('seller.is_test', false)

  // Apply filters
  if (filters.gameId) {
    query = query.eq('game_id', filters.gameId)
  }

  if (filters.categoryId) {
    query = query.eq('game_category_id', filters.categoryId)
  }

  if (filters.minPrice !== undefined) {
    query = query.gte('price', filters.minPrice)
  }

  if (filters.maxPrice !== undefined) {
    query = query.lte('price', filters.maxPrice)
  }

  const search = filters.search ? cleanListingSearch(filters.search) : ''
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  }

  const order = listingOrder(filters.sortBy)
  const ascending = filters.sortOrder ? filters.sortOrder === 'asc' : order.ascending
  // Ties broken by id, so pages never overlap or skip a row.
  query = query.order(order.column, { ascending }).order('id', { ascending: true })

  if (filters.limit) {
    const from = filters.offset ?? 0
    query = query.range(from, from + filters.limit - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching listings:', error)
    return { data: null, error }
  }

  return { data: data as ListingWithRelations[], error: null }
}

export async function getGames() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('games')
    .select(BROWSE_GAME_SELECT)
    .eq('is_active', true)
    .order('name') as any

  return { data, error }
}

export async function getCategories() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('game_categories')
    .select(BROWSE_CATEGORY_SELECT)
    .eq('is_enabled', true)
    .order('name') as any

  return { data, error }
}
