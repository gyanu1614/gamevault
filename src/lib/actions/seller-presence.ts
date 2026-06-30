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
    const { error } = await (supabase
      .from('seller_presence')
      .upsert as any)(
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

    const { error } = await (supabase
      .from('seller_presence')
      .update as any)({
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

    const { error } = await (supabase
      .from('seller_presence')
      .update as any)({
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
 * V21/P7.ae — Store pause ("Offline Mode").
 *
 * When a seller flips their store offline, all their offers go DOWN
 * (hidden from buyers) until they toggle back on — their listings are
 * preserved, just not visible/purchasable. Persisted on
 * `seller_presence.store_paused`.
 *
 * NOTE: requires the `store_paused boolean` column on `seller_presence`
 * (migration pending). These actions fail gracefully (no-op + flagged
 * error) if the column isn't there yet, so the UI doesn't crash.
 */
// V21/P7.ae — Offline Mode persisted on the `store_paused boolean` column
// (migration 20260625). Read path is backed by a partial index on
// (seller_id) WHERE store_paused = true.

export async function setStorePaused(paused: boolean): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await (supabase
      .from('seller_presence')
      .upsert as any)(
        { seller_id: user.id, store_paused: paused },
        { onConflict: 'seller_id' },
      )

    if (error) {
      console.error('Error setting store paused:', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (error: any) {
    console.error('Error in setStorePaused:', error)
    return { success: false, error: error.message || 'Failed to update store status' }
  }
}

/**
 * V21/P7.ae — All seller IDs currently in Offline Mode. Buyer-facing
 * listing queries exclude these so a paused store's offers disappear
 * from the marketplace. Returns [] on any error (fail-open: better to
 * show listings than to blank the catalogue on a transient read error).
 */
export async function getPausedSellerIds(): Promise<string[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('seller_presence')
      .select('seller_id')
      .eq('store_paused', true)
    if (error || !data) return []
    return (data as any[]).map((r) => r.seller_id).filter(Boolean)
  } catch {
    return []
  }
}

/** Read the current seller's store-paused flag (false on any error). */
export async function getMyStorePaused(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { data, error } = await supabase
      .from('seller_presence')
      .select('store_paused')
      .eq('seller_id', user.id)
      .maybeSingle()
    if (error) return false
    return !!(data as any)?.store_paused
  } catch {
    return false
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
