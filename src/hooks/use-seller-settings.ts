/**
 * Seller Settings Hook
 * Manages seller profile and settings updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, SellerProfile } from '@/lib/api/seller-compatible'
import { toast } from 'sonner'

export function useSellerSettings() {
  const queryClient = useQueryClient()

  // Fetch seller profile
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery<SellerProfile>({
    queryKey: ['seller', 'settings', 'profile'],
    queryFn: () => settingsApi.getProfile(),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  })

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: (updates: {
      username?: string
      full_name?: string
      bio?: string
      avatar_url?: string
      business_name?: string
      paypal_email?: string
      shop_name?: string
    }) => settingsApi.updateProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'settings'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'profile'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
      toast.success('Profile updated successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile')
    },
  })

  return {
    profile: profile || {
      id: '',
      username: '',
      seller_tier: 'bronze',
      total_sales: 0,
      seller_rating: 0,
      total_reviews: 0,
      shop_name: null,
      shop_slug: null,
      shop_name_updated_at: null,
    },
    isLoading,
    error,
    updateProfile: updateProfile.mutateAsync,
    isUpdating: updateProfile.isPending,
  }
}
