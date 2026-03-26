'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireRole } from './admin-permissions'
import { revalidatePath } from 'next/cache'

// Create service role client that bypasses RLS
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createServiceClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Fix approved sellers who don't have the seller role
 * This is a one-time fix for existing data
 */
export async function fixApprovedSellers() {
  try {
    await requireRole(['super_admin', 'admin'])
    const supabase = await createClient()

    // Get all approved applications
    const { data: approvedApps, error: appsError } = await supabase
      .from('seller_applications')
      .select('user_id, display_name')
      .eq('status', 'approved')

    if (appsError) throw appsError

    if (!approvedApps || approvedApps.length === 0) {
      return {
        success: true,
        message: 'No approved applications found',
        updated: 0
      }
    }

    const userIds = approvedApps.map((app: any) => app.user_id)

    // Get profiles that need updating (approved sellers without seller role)
    const { data: profilesToUpdate, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role, badges')
      .in('id', userIds)
      .neq('role', 'seller')

    if (profilesError) throw profilesError

    console.log('🔍 Fix check:', {
      totalApprovedApps: approvedApps.length,
      uniqueUserIds: userIds.length,
      profilesToUpdate: profilesToUpdate?.length || 0,
      profiles: profilesToUpdate
    })

    if (!profilesToUpdate || profilesToUpdate.length === 0) {
      return {
        success: true,
        message: 'All approved sellers already have the seller role',
        updated: 0
      }
    }

    // Update each profile using service client to bypass RLS
    let updated = 0
    const errors: string[] = []
    const serviceClient = getServiceClient()

    for (const profile of (profilesToUpdate as any)) {
      const currentBadges = profile.badges || []
      const newBadges = currentBadges.includes('verified')
        ? currentBadges
        : [...currentBadges, 'verified']

      // Use service client to bypass RLS
      const { data: updateData, error: updateError } = await (serviceClient
        .from('profiles')
        .update as any)({
          role: 'seller',
          badges: newBadges
        })
        .eq('id', profile.id)
        .select()

      console.log('📝 Update result:', {
        userId: profile.id,
        success: !updateError,
        error: updateError,
        data: updateData,
        rowsAffected: updateData?.length || 0
      })

      if (updateError) {
        console.error('❌ Update error:', updateError)
        errors.push(`Failed to update user ${profile.id}: ${updateError.message}`)
      } else if (!updateData || updateData.length === 0) {
        console.error('❌ Update succeeded but no rows affected')
        errors.push(`User ${profile.id} not found or no changes made`)
      } else {
        console.log('✅ Successfully updated user:', profile.id)
        updated++
      }
    }

    // Revalidate dashboard to update Active Sellers count
    revalidatePath('/admin')
    revalidatePath('/admin/utils')

    return {
      success: true,
      message: `Successfully updated ${updated} seller profiles`,
      updated,
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (error: any) {
    console.error('Error fixing approved sellers:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Get stats about approved sellers and their role status
 */
export async function getApprovedSellerStats() {
  try {
    await requireRole(['super_admin', 'admin'])
    const supabase = await createClient()

    // Get all approved applications
    const { data: approvedApps, error: appsError } = await supabase
      .from('seller_applications')
      .select('user_id, display_name')
      .eq('status', 'approved')

    if (appsError) throw appsError

    const approvedCount = approvedApps?.length || 0

    if (approvedCount === 0) {
      return {
        success: true,
        totalApproved: 0,
        uniqueUsers: 0,
        hasSellerRole: 0,
        needsUpdate: 0
      }
    }

    // Get unique user IDs
    const userIds = Array.from(new Set(approvedApps!.map((app: any) => app.user_id)))
    const uniqueUsersCount = userIds.length

    // Check how many have seller role
    const { data: sellersWithRole, error: roleError } = await supabase
      .from('profiles')
      .select('id')
      .in('id', userIds)
      .eq('role', 'seller')

    if (roleError) throw roleError

    const hasSellerRoleCount = sellersWithRole?.length || 0
    const needsUpdateCount = uniqueUsersCount - hasSellerRoleCount

    return {
      success: true,
      totalApproved: approvedCount,
      uniqueUsers: uniqueUsersCount,
      hasSellerRole: hasSellerRoleCount,
      needsUpdate: needsUpdateCount
    }
  } catch (error: any) {
    console.error('Error getting approved seller stats:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
