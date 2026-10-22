/**
 * Seller profile and store settings.
 *
 * Part of the browser seller API, split out of lib/api/seller-compatible.ts
 * (2026-10-20, files under ~400 lines). Import from '@/lib/api/seller-compatible'.
 */
import { supabase } from './client'
import { slugify } from '@/lib/utils'
import { type SellerTier, DEFAULT_TIER } from '@/lib/seller/tiers'
import type { SellerProfile } from './types'

// =====================================================
// SETTINGS API
// =====================================================

export const settingsApi = {
  /**
   * Update seller profile
   */
  async updateProfile(updates: {
    username?: string
    full_name?: string
    bio?: string
    avatar_url?: string
    business_name?: string
    paypal_email?: string
    shop_name?: string
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const updateData: any = { ...updates }

    // Username: validate + check availability BEFORE writing. Without this
    // the write reached Postgres and the unique-constraint violation was
    // shown to the user verbatim ("duplicate key value violates unique
    // constraint \"profiles_username_key\"").
    if (updates.username !== undefined) {
      const username = updates.username.trim()

      if (username.length < 3 || username.length > 30) {
        throw new Error('Username must be between 3 and 30 characters')
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        throw new Error('Username can only use letters, numbers, hyphens and underscores')
      }

      // Case-insensitive: "GPandeyy" and "gpandeyy" must not coexist. Own
      // row is excluded, so changing only the casing of your own handle
      // is still allowed.
      const { data: clash } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .neq('id', user.id)
        .limit(1)
        .maybeSingle() as any

      if (clash) {
        throw new Error('That username is already taken. Try another.')
      }

      updateData.username = username
    }

    // If shop_name is being updated, validate and generate shop_slug
    if (updates.shop_name !== undefined) {
      // Validate shop_name format
      if (updates.shop_name.length < 3 || updates.shop_name.length > 50) {
        throw new Error('Shop name must be between 3 and 50 characters')
      }

      // Get current profile to check last update time
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('shop_name_updated_at')
        .eq('id', user.id)
        .single() as any

      if (profileError) throw profileError

      // Check 30-day restriction (only if shop_name was previously updated)
      if (currentProfile.shop_name_updated_at) {
        const lastUpdate = new Date(currentProfile.shop_name_updated_at)
        const now = new Date()
        const daysSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)

        if (daysSinceLastUpdate < 30) {
          const daysRemaining = Math.ceil(30 - daysSinceLastUpdate)
          throw new Error(`You can change your shop name again in ${daysRemaining} days`)
        }
      }

      // Generate shop_slug using the database function
      const baseSlug = slugify(updates.shop_name)

      // Call database function to get unique slug
      const { data: slugData, error: slugError } = await (supabase
        .rpc as any)('generate_shop_slug', { name: updates.shop_name })

      if (slugError) throw slugError

      // Add generated slug and timestamp to updates
      updateData.shop_slug = slugData || baseSlug
      updateData.shop_name_updated_at = new Date().toISOString()
    }

    const { error } = await (supabase
      .from('profiles')
      .update as any)(updateData)
      .eq('id', user.id)

    if (error) {
      // Backstop for the race between the check above and this write, and
      // for any other constraint. Never surface raw Postgres text.
      if (error.code === '23505' || /duplicate key value/i.test(error.message ?? '')) {
        if (/username/i.test(error.message ?? '')) {
          throw new Error('That username is already taken. Try another.')
        }
        if (/shop_slug|shop_name/i.test(error.message ?? '')) {
          throw new Error('That shop name is already taken. Try another.')
        }
        throw new Error('Those details are already in use. Try different values.')
      }
      throw new Error(error.message || 'Could not save your profile. Try again.')
    }
  },

  /**
   * Get current seller profile
   */
  async getProfile(): Promise<SellerProfile> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error} = await supabase
      .from('profiles')
      .select('id, username, seller_tier, total_sales, seller_rating, total_reviews, shop_name, shop_slug, shop_name_updated_at')
      .eq('id', user.id)
      .single() as any

    if (error) throw error
    // Null/legacy tier values fall back to the entry rank (Bronze).
    return { ...data, seller_tier: (data?.seller_tier as SellerTier) || DEFAULT_TIER }
  },
}
