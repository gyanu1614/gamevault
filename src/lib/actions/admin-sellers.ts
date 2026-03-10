'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from './admin-permissions'
// import { logAdminActivity } from '@/lib/admin/activity-log'

export interface KYCDocument {
  id: string
  document_type: string
  file_path: string
  file_name: string
  verified: boolean
  verified_by: string | null
  verified_at: string | null
  uploaded_at: string
}

export interface SellerApplication {
  id: string
  user_id: string

  // Basic Info
  display_name: string
  full_legal_name: string
  seller_type: 'individual' | 'business'

  // Contact
  phone_number: string
  alternate_email: string | null
  country: string
  state_province: string | null
  city: string | null

  // Business Info (if business)
  company_legal_name: string | null
  business_registration_number: string | null
  tax_id_vat: string | null
  company_address: string | null
  business_type: string | null
  year_established: number | null
  business_email: string | null
  business_phone: string | null

  // Games & Volume
  primary_games: string[]
  game_names?: string[] // Resolved game names from IDs
  expected_monthly_volume: string

  // Profile
  profile_bio: string | null
  languages_spoken: string[]
  business_hours: string | null
  timezone: string | null

  // Social
  discord_username: string | null
  twitter_handle: string | null
  twitch_channel: string | null
  youtube_channel: string | null

  // Policies
  refund_policy: string | null
  delivery_timeframe: string | null
  terms_of_service: string | null

  // Payment
  payout_method: string | null
  bank_account_holder_name: string | null
  bank_name: string | null
  paypal_email: string | null
  crypto_wallet_address: string | null
  tax_residency_country: string | null

  // Application Status
  status: 'pending' | 'under_review' | 'approved' | 'rejected'
  created_at: string
  submitted_at: string
  updated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  admin_notes: string | null
  rejection_reason: string | null

  // Verification Status
  identity_verified: boolean
  address_verified: boolean
  business_verified: boolean
  tax_verified: boolean

  // Documents
  documents: KYCDocument[]

  // User info from view (flattened)
  username?: string | null
  email?: string
  full_name?: string | null
  avatar_url?: string | null
  seller_status?: 'active' | 'restricted' | 'banned'
  seller_restriction_reason?: string | null
  seller_restricted_at?: string | null
  seller_restricted_by?: string | null

  // User info (legacy structure for backward compatibility)
  user: {
    email: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
    seller_status?: 'active' | 'restricted' | 'banned'
    seller_restriction_reason?: string | null
    seller_restricted_at?: string | null
    seller_restricted_by?: string | null
    created_at: string
  }
}

/**
 * Get all seller applications with filters
 */
export async function getSellerApplications(
  status?: 'pending' | 'approved' | 'rejected'
): Promise<SellerApplication[]> {
  await requireAdmin()

  const supabase = await createClient()

  // Get auth user to access email
  const { data: { user: authUser } } = await supabase.auth.getUser()

  let query = supabase
    .from('seller_applications')
    .select(`
      *,
      profiles!seller_applications_user_id_fkey (
        username,
        full_name,
        avatar_url,
        created_at
      ),
      seller_kyc_documents (
        id,
        document_type,
        file_path,
        file_name,
        verified,
        verified_by,
        verified_at,
        uploaded_at
      )
    `)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching applications:', error)
    throw new Error('Failed to fetch seller applications')
  }

  // Get emails from auth.users for each application using admin API
  const applicationsWithUserInfo = await Promise.all(
    (data || []).map(async (app) => {
      // Try to get email from profiles first (if migration is applied)
      let email = app.profiles?.email

      // If not in profiles, fetch from auth.users using admin API
      if (!email) {
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(app.user_id)
          if (!userError && userData?.user) {
            email = userData.user.email
          }
        } catch (err) {
          console.error('Error fetching user email:', err)
        }
      }

      return {
        ...app,
        user: {
          email: email || 'user@example.com',
          username: app.profiles?.username,
          full_name: app.profiles?.full_name,
          avatar_url: app.profiles?.avatar_url,
          created_at: app.profiles?.created_at
        },
        documents: app.seller_kyc_documents || []
      }
    })
  )

  return applicationsWithUserInfo
}

/**
 * Get single seller application by ID
 */
export async function getSellerApplication(applicationId: string): Promise<SellerApplication | null> {
  await requireAdmin()

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('seller_applications')
    .select(`
      *,
      profiles!seller_applications_user_id_fkey (
        username,
        full_name,
        email,
        avatar_url,
        created_at,
        seller_status,
        seller_restriction_reason,
        seller_restricted_at,
        seller_restricted_by
      ),
      seller_kyc_documents (
        id,
        document_type,
        file_path,
        file_name,
        verified,
        verified_by,
        verified_at,
        uploaded_at
      )
    `)
    .eq('id', applicationId)
    .single()

  if (error || !data) {
    console.error('Error fetching application:', error)
    return null
  }

  // Get email from profiles or fallback to admin API
  let email = data.profiles?.email

  if (!email) {
    try {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(data.user_id)
      if (!userError && userData?.user) {
        email = userData.user.email
      }
    } catch (err) {
      console.error('Error fetching user email:', err)
    }
  }

  // Get game names for primary_games IDs
  let gameNames: string[] = []
  if (data.primary_games && data.primary_games.length > 0) {
    try {
      const { getGameNames } = await import('@/lib/utils/games')
      gameNames = await getGameNames(data.primary_games)
      console.log('🎮 Converted game IDs to names:', {
        ids: data.primary_games,
        names: gameNames
      })
    } catch (error) {
      console.error('❌ Error fetching game names:', error)
      // Fallback: keep the IDs
      gameNames = data.primary_games
    }
  }

  return {
    ...data,
    user: {
      email: email || 'user@example.com',
      username: data.profiles?.username,
      full_name: data.profiles?.full_name,
      avatar_url: data.profiles?.avatar_url,
      created_at: data.profiles?.created_at,
      seller_status: data.profiles?.seller_status,
      seller_restriction_reason: data.profiles?.seller_restriction_reason,
      seller_restricted_at: data.profiles?.seller_restricted_at,
      seller_restricted_by: data.profiles?.seller_restricted_by
    },
    documents: data.seller_kyc_documents || [],
    game_names: gameNames // Add resolved game names
  }
}

/**
 * Approve a seller application
 */
export async function approveApplication(
  applicationId: string,
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()

  // Check if admin can approve applications
  // TODO: Re-implement permission checks when canPerformAction is available
  // const canApprove = await canPerformAction('seller_applications', 'approve')
  // if (!canApprove) {
  //   return { success: false, error: 'You do not have permission to approve applications' }
  // }

  const supabase = await createClient()

  // Get uploaded documents for this application
  const { data: documents } = await supabase
    .from('seller_kyc_documents')
    .select('document_type')
    .eq('application_id', applicationId)

  // Determine which verifications are complete based on uploaded documents
  const docTypes = documents?.map(d => d.document_type) || []
  const identity_verified = docTypes.some(t => ['id_front', 'id_back', 'selfie_with_id'].includes(t))
  const address_verified = docTypes.includes('proof_of_address')
  const business_verified = docTypes.some(t => ['certificate_of_incorporation', 'business_license', 'director_id'].includes(t))
  const tax_verified = docTypes.some(t => ['w9_form', 'w8ben_form', 'bank_statement'].includes(t))

  // Update application status with verification flags
  const { error } = await supabase
    .from('seller_applications')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.userId,
      admin_notes: adminNotes || null,
      updated_at: new Date().toISOString(),
      identity_verified,
      address_verified,
      business_verified,
      tax_verified
    })
    .eq('id', applicationId)

  if (error) {
    console.error('Error approving application:', error)
    return { success: false, error: 'Failed to approve application' }
  }

  // Get application details for logging
  const { data: app } = await supabase
    .from('seller_applications')
    .select('user_id, display_name')
    .eq('id', applicationId)
    .single()

  if (app) {
    // Update user's avatar_url with their uploaded profile picture
    const { data: profilePics } = await supabase.storage
      .from('profile-pictures')
      .list(app.user_id, {
        limit: 1,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (profilePics && profilePics.length > 0) {
      // Get public URL for the profile picture
      const { data: publicUrlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(`${app.user_id}/${profilePics[0].name}`)

      if (publicUrlData?.publicUrl) {
        // Update profiles table with the avatar URL
        await supabase
          .from('profiles')
          .update({ avatar_url: publicUrlData.publicUrl })
          .eq('id', app.user_id)
      }
    }

    // TODO: Re-implement activity logging when logAdminActivity is integrated
    // await logAdminActivity({
    //   action: 'approve_seller',
    //   actionCategory: 'seller',
    //   resourceType: 'seller_application',
    //   resourceId: applicationId,
    //   metadata: { admin_notes: adminNotes }
    // })

    // TODO: Re-implement notifications when createAdminNotification is available
    // await createAdminNotification({
    //   type: 'seller_approved',
    //   title: 'Seller Application Approved',
    //   message: `Seller application for "${app.display_name}" has been approved`,
    //   target_roles: ['admin', 'super_admin'],
    //   target_user_id: app.user_id
    // })
  }

  return { success: true }
}

/**
 * Reject a seller application with tiered cooldown system
 *
 * Cooldown tiers:
 * - 1st rejection: 7 days
 * - 2nd rejection: 30 days
 * - 3rd rejection: 90 days
 * - 4+ rejections: Permanent ban (requires appeal)
 */
export async function rejectApplication(
  applicationId: string,
  rejectionReason: string,
  rejectionCategory: string,
  adminNotes?: string
): Promise<{
  success: boolean
  error?: string
  data?: {
    rejection_count: number
    can_reapply_at: string
    cooldown_days: number
    is_permanent_ban: boolean
  }
}> {
  const admin = await requireAdmin()

  // Check if admin can reject applications
  // TODO: Re-implement permission checks when canPerformAction is available
  // const canReject = await canPerformAction('seller_applications', 'reject')
  // if (!canReject) {
  //   return { success: false, error: 'You do not have permission to reject applications' }
  // }

  if (!rejectionReason?.trim()) {
    return { success: false, error: 'Rejection reason is required' }
  }

  if (!rejectionCategory?.trim()) {
    return { success: false, error: 'Rejection category is required' }
  }

  const supabase = await createClient()

  // Call database function to handle rejection with tiered cooldown
  const { data, error } = await supabase.rpc('reject_seller_application', {
    application_id_param: applicationId,
    admin_id_param: admin.userId,
    rejection_reason_param: rejectionReason,
    rejection_category_param: rejectionCategory
  })

  if (error) {
    console.error('Error rejecting application:', error)
    return { success: false, error: 'Failed to reject application' }
  }

  // Update admin notes separately if provided
  if (adminNotes) {
    await supabase
      .from('seller_applications')
      .update({
        admin_notes: adminNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId)
  }

  // Get application details for logging
  const { data: app } = await supabase
    .from('seller_applications')
    .select('user_id, display_name')
    .eq('id', applicationId)
    .single()

  if (app) {
    // TODO: Re-implement activity logging when logAdminActivity is integrated
    // await logAdminActivity({
    //   action: 'reject_seller',
    //   actionCategory: 'seller',
    //   resourceType: 'seller_application',
    //   resourceId: applicationId,
    //   metadata: {
    //     rejection_reason: rejectionReason,
    //     rejection_category: rejectionCategory,
    //     admin_notes: adminNotes,
    //     rejection_count: data.rejection_count,
    //     cooldown_days: data.cooldown_days
    //   }
    // })

    // TODO: Re-implement notifications when createAdminNotification is available
    // await createAdminNotification({
    //   type: 'seller_rejected',
    //   title: 'Seller Application Rejected',
    //   message: `Seller application for "${app.display_name}" has been rejected`,
    //   target_roles: ['admin', 'super_admin'],
    //   target_user_id: app.user_id
    // })
  }

  return {
    success: true,
    data: {
      rejection_count: data.rejection_count,
      can_reapply_at: data.can_reapply_at,
      cooldown_days: data.cooldown_days,
      is_permanent_ban: data.is_permanent_ban
    }
  }
}
