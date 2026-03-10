'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './use-auth'
import { toast } from 'sonner'

export interface WishlistItem {
  id: string
  user_id: string
  listing_id: string
  created_at: string
  listing?: {
    id: string
    title: string
    price: number
    original_price?: number
    images?: string[]
    slug: string
    quantity: number
    is_unlimited: boolean
    seller_id: string
    game_id: string
    game?: {
      id: string
      name: string
      slug: string
      emoji: string
      image_url?: string | null
    }
    category?: {
      id: string
      name: string
      slug: string
    }
    seller?: {
      id: string
      username: string
      seller_tier: string
      is_verified: boolean
    }
  }
}

export function useWishlist() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Fetch user's wishlist
  const { data: wishlistItems = [], isLoading } = useQuery({
    queryKey: ['wishlist', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      // First, get all wishlist entries
      const { data: wishlistEntries, error: wishlistError } = await supabase
        .from('wishlists')
        .select('id, user_id, listing_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (wishlistError) {
        console.error('Error fetching wishlist entries:', wishlistError)
        return []
      }

      if (!wishlistEntries || wishlistEntries.length === 0) {
        return []
      }

      // Then fetch full listing details for each entry
      const listingIds = wishlistEntries.map(entry => entry.listing_id)
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select(`
          id,
          title,
          price,
          original_price,
          images,
          slug,
          quantity,
          is_unlimited,
          seller_id,
          game_id,
          games (id, name, slug, emoji, image_url),
          categories (id, name, slug),
          seller:profiles!listings_seller_id_fkey (id, username, seller_tier, is_verified)
        `)
        .in('id', listingIds)

      if (listingsError) {
        console.error('Error fetching listings:', listingsError)
        return []
      }

      // Combine wishlist entries with listing data
      const combinedData = wishlistEntries.map(entry => {
        const listing = listings?.find(l => l.id === entry.listing_id)
        return {
          id: entry.id,
          user_id: entry.user_id,
          listing_id: entry.listing_id,
          created_at: entry.created_at,
          listing: listing ? {
            id: listing.id,
            title: listing.title,
            price: listing.price,
            original_price: listing.original_price,
            images: listing.images,
            slug: listing.slug,
            quantity: listing.quantity,
            is_unlimited: listing.is_unlimited,
            seller_id: listing.seller_id,
            game_id: listing.game_id,
            game: listing.games,
            category: listing.categories,
            seller: listing.seller
          } : undefined
        }
      })

      return combinedData as WishlistItem[]
    },
    enabled: !!user?.id,
  })

  // Add to wishlist
  const addToWishlistMutation = useMutation({
    mutationFn: async (listingId: string) => {
      if (!user?.id) {
        throw new Error('You must be logged in to add items to your wishlist')
      }

      const { data, error } = await supabase
        .from('wishlists')
        .insert({
          user_id: user.id,
          listing_id: listingId,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('Item already in wishlist')
        }
        throw error
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist', user?.id] })
      toast.success('Added to wishlist', {
        description: 'Item has been added to your wishlist',
      })
    },
    onError: (error: any) => {
      if (error.message !== 'Item already in wishlist') {
        toast.error('Failed to add to wishlist', {
          description: error.message || 'Please try again',
        })
      }
    },
  })

  // Remove from wishlist
  const removeFromWishlistMutation = useMutation({
    mutationFn: async (listingId: string) => {
      if (!user?.id) {
        throw new Error('You must be logged in')
      }

      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist', user?.id] })
      toast.success('Removed from wishlist')
    },
    onError: (error: any) => {
      toast.error('Failed to remove from wishlist', {
        description: error.message || 'Please try again',
      })
    },
  })

  // Check if item is in wishlist
  const isInWishlist = (listingId: string): boolean => {
    return wishlistItems.some(item => item.listing_id === listingId)
  }

  // Toggle wishlist
  const toggleWishlist = async (listingId: string) => {
    if (!user) {
      toast.error('Please log in', {
        description: 'You need to be logged in to add items to your wishlist',
      })
      return
    }

    if (isInWishlist(listingId)) {
      await removeFromWishlistMutation.mutateAsync(listingId)
    } else {
      await addToWishlistMutation.mutateAsync(listingId)
    }
  }

  return {
    wishlistItems,
    isLoading,
    addToWishlist: addToWishlistMutation.mutateAsync,
    removeFromWishlist: removeFromWishlistMutation.mutateAsync,
    toggleWishlist,
    isInWishlist,
    wishlistCount: wishlistItems.length,
    isAddingToWishlist: addToWishlistMutation.isPending,
    isRemovingFromWishlist: removeFromWishlistMutation.isPending,
  }
}
