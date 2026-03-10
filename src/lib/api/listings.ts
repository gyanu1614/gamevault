import { createClient } from '@/lib/supabase/client'
import type { ListingWithRelations } from '@/types/database'

export interface ListingsFilters {
  gameId?: string
  categoryId?: string
  minPrice?: number
  maxPrice?: number
  search?: string
  sortBy?: 'created_at' | 'price' | 'sales'
  sortOrder?: 'asc' | 'desc'
}

export async function getListings(filters: ListingsFilters = {}) {
  const supabase = createClient()

  let query = supabase
    .from('listings')
    .select(`
      *,
      seller:profiles!listings_seller_id_fkey(*),
      game:games!listings_game_id_fkey(*),
      category:categories!listings_category_id_fkey(*)
    `)
    .eq('status', 'active')

  // Apply filters
  if (filters.gameId) {
    query = query.eq('game_id', filters.gameId)
  }

  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId)
  }

  if (filters.minPrice !== undefined) {
    query = query.gte('price', filters.minPrice)
  }

  if (filters.maxPrice !== undefined) {
    query = query.lte('price', filters.maxPrice)
  }

  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  // Apply sorting
  const sortBy = filters.sortBy || 'created_at'
  const sortOrder = filters.sortOrder || 'desc'
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching listings:', error)
    return { data: null, error }
  }

  return { data: data as ListingWithRelations[], error: null }
}

export async function getListing(id: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      seller:profiles!listings_seller_id_fkey(*),
      game:games!listings_game_id_fkey(*),
      category:categories!listings_category_id_fkey(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching listing:', error)
    return { data: null, error }
  }

  // Increment view count
  await supabase
    .from('listings')
    .update({ views: (data.views || 0) + 1 })
    .eq('id', id)

  return { data: data as ListingWithRelations, error: null }
}

export async function getGames() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('is_active', true)
    .order('name')

  return { data, error }
}

export async function getCategories() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  return { data, error }
}
