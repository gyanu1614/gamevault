/**
 * Seller Presence Actions
 *
 * Server actions for managing seller online/offline status
 */

'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Update seller presence to online
 */
export async function updatePresenceOnline(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    // Upsert presence record
    const { error } = await supabase
      .from('seller_presence')
      .upsert(
        {
          seller_id: user.id,
          is_online: true,
          last_active_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: 'seller_id',
        }
      )

    if (error) {
      console.error('Error updating presence:', error)
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error in updatePresenceOnline:', error)
    return {
      success: false,
      error: error.message || 'Failed to update presence',
    }
  }
}

/**
 * Update seller presence to offline
 */
export async function updatePresenceOffline(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    const { error } = await supabase
      .from('seller_presence')
      .update({
        is_online: false,
      })
      .eq('seller_id', user.id)

    if (error) {
      console.error('Error updating presence to offline:', error)
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error in updatePresenceOffline:', error)
    return {
      success: false,
      error: error.message || 'Failed to update presence',
    }
  }
}

/**
 * Update seller status message
 */
export async function updateStatusMessage(message: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    const { error } = await supabase
      .from('seller_presence')
      .update({
        status_message: message,
      })
      .eq('seller_id', user.id)

    if (error) {
      console.error('Error updating status message:', error)
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error in updateStatusMessage:', error)
    return {
      success: false,
      error: error.message || 'Failed to update status message',
    }
  }
}

/**
 * Get seller presence status
 */
export async function getSellerPresence(sellerId: string): Promise<{
  success: boolean
  presence?: {
    is_online: boolean
    last_seen_at: string
    status_message?: string
  }
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: presence, error } = await supabase
      .from('seller_presence')
      .select('is_online, last_seen_at, status_message')
      .eq('seller_id', sellerId)
      .single()

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      presence,
    }
  } catch (error: any) {
    console.error('Error in getSellerPresence:', error)
    return {
      success: false,
      error: error.message || 'Failed to get seller presence',
    }
  }
}

/**
 * Get all online sellers
 */
export async function getOnlineSellers(): Promise<{
  success: boolean
  sellers?: Array<{
    seller_id: string
    last_seen_at: string
    status_message?: string
  }>
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: sellers, error } = await supabase
      .from('seller_presence')
      .select('seller_id, last_seen_at, status_message')
      .eq('is_online', true)
      .order('last_seen_at', { ascending: false })

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      sellers: sellers || [],
    }
  } catch (error: any) {
    console.error('Error in getOnlineSellers:', error)
    return {
      success: false,
      error: error.message || 'Failed to get online sellers',
    }
  }
}
