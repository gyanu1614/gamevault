/**
 * Seller Listings Hook
 * Fetches and manages seller listings with mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listingsApi, Listing, ListingStatus } from '@/lib/api/seller-compatible'
import { toast } from 'sonner'

interface UseListingsOptions {
  status?: ListingStatus
  game?: string
  category?: string
  search?: string
}

export function useSellerListings(options?: UseListingsOptions) {
  const queryClient = useQueryClient()

  // Fetch listings
  const {
    data: listings,
    isLoading,
    error,
  } = useQuery<Listing[]>({
    queryKey: ['seller', 'listings', options],
    queryFn: () => listingsApi.getAll(options),
  })

  // Create listing mutation
  const createListing = useMutation({
    mutationFn: (listing: {
      game_id: string
      category_id: string
      title: string
      description: string
      price: number
      quantity?: number
      is_unlimited?: boolean
      delivery_time?: string
      delivery_method?: string
      images?: string[]
      status?: ListingStatus
    }) => listingsApi.create(listing),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
      toast.success('Listing created successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create listing')
    },
  })

  // Update listing mutation
  const updateListing = useMutation({
    mutationFn: ({ id, updates, silent }: { id: string; updates: Partial<Listing>; silent?: boolean }) =>
      listingsApi.update(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
      // Only show toast if not silent
      if (!variables.silent) {
        toast.success('Listing updated successfully!')
      }
    },
    onError: (error: any, variables) => {
      // Only show toast if not silent
      if (!variables.silent) {
        toast.error(error.message || 'Failed to update listing')
      }
    },
  })

  // Delete listing mutation
  const deleteListing = useMutation({
    mutationFn: (variables: { id: string; silent?: boolean } | string) => {
      // Support both old format (string) and new format (object with silent)
      const listingId = typeof variables === 'string' ? variables : variables.id
      return listingsApi.delete(listingId)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
      // Only show toast if not silent
      const silent = typeof variables === 'object' && variables.silent
      if (!silent) {
        toast.success('Listing deleted successfully!')
      }
    },
    onError: (error: any, variables) => {
      // Only show toast if not silent
      const silent = typeof variables === 'object' && variables.silent
      if (!silent) {
        toast.error(error.message || 'Failed to delete listing')
      }
    },
  })

  // Bulk update mutation
  const bulkUpdate = useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: Partial<Listing> }) =>
      listingsApi.bulkUpdate(ids, updates),
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
      toast.success(`${ids.length} listings updated successfully!`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update listings')
    },
  })

  // Bulk delete mutation
  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) => listingsApi.bulkDelete(ids),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
      toast.success(`${ids.length} listings deleted successfully!`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete listings')
    },
  })

  return {
    listings: listings || [],
    isLoading,
    error,
    createListing: createListing.mutateAsync,
    updateListing: updateListing.mutateAsync,
    deleteListing: deleteListing.mutateAsync,
    bulkUpdate: bulkUpdate.mutateAsync,
    bulkDelete: bulkDelete.mutateAsync,
    isCreating: createListing.isPending,
    isUpdating: updateListing.isPending,
    isDeleting: deleteListing.isPending,
  }
}

// Hook for a single listing
export function useListing(id: string | null) {
  const { data, isLoading, error } = useQuery<Listing | null>({
    queryKey: ['seller', 'listing', id],
    queryFn: () => (id ? listingsApi.getById(id) : null),
    enabled: !!id,
  })

  return {
    listing: data,
    isLoading,
    error,
  }
}
