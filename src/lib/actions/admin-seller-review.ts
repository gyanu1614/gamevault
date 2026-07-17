'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin, requireRole } from './admin-permissions'
import { revalidatePath } from 'next/cache'
import {
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
  sendInfoRequestedEmail,
} from '@/lib/email'
import { logAdminActivity } from '@/lib/admin/activity-log'
import { ADMIN_ACTIONS } from '@/lib/admin/permissions-constants'
import { slugify } from '@/lib/utils'

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

// Types
export interface ApplicationFilters {
  status?: string[]
  sellerType?: 'individual' | 'business'
  country?: string
  searchQuery?: string
  sortBy?: 'created_at' | 'submitted_at' | 'fraud_score'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface ApplicationStats {
  pending: number
  under_review: number
  approved: number
  rejected: number
  info_requested: number
  approvedToday: number
  pendingTrend?: number
  totalUsers?: number
  activeSellers?: number
  openDisputes?: number
}

/**
 * Get application statistics for dashboard
 */
export async function getApplicationStats(): Promise<ApplicationStats> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    // Get application counts by status
    const { data: applications, error } = await supabase
      .from('seller_applications')
      .select('status, created_at, reviewed_at') as any

    if (error) throw error

    const stats: ApplicationStats = {
      pending: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
      info_requested: 0,
      approvedToday: 0,
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    applications?.forEach((app: any) => {
      if (app.status in stats) {
        stats[app.status as keyof ApplicationStats]++
      }

      // Count approved today
      if (app.status === 'approved' && app.reviewed_at) {
        const reviewedDate = new Date(app.reviewed_at)
        if (reviewedDate >= today) {
          stats.approvedToday++
        }
      }
    })

    // Get total users count
    const { count: usersCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    stats.totalUsers = usersCount || 0

    // Get active sellers count (users with seller role)
    const { count: sellersCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'seller')

    stats.activeSellers = sellersCount || 0

    // Get open disputes count
    const { count: disputesCount } = await supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'under_review'])

    stats.openDisputes = disputesCount || 0

    return stats
  } catch (error) {
    console.error('Error fetching application stats:', error)
    return {
      pending: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
      info_requested: 0,
      approvedToday: 0,
    }
  }
}

/**
 * Get recent applications for dashboard
 */
export async function getRecentApplications(limit: number = 5) {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('seller_applications_with_users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit) as any

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error fetching recent applications:', error)
    return []
  }
}

/**
 * Get seller applications with filters
 */
export async function getSellerApplications(filters: ApplicationFilters = {}) {
  try {
    await requireAdmin()
    const supabase = await createClient()

    let query = supabase
      .from('seller_applications_with_users')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      // Handle "restricted" filter specially - it checks seller_status in profiles
      if (filters.status.includes('restricted')) {
        const otherStatuses = filters.status.filter(s => s !== 'restricted')
        if (otherStatuses.length > 0) {
          // If there are other statuses, we need a complex OR query
          query = query.or(`status.in.(${otherStatuses.join(',')}),seller_status.in.(restricted,banned)`)
        } else {
          // Only restricted filter
          query = query.in('seller_status', ['restricted', 'banned'])
        }
      } else {
        query = query.in('status', filters.status)
      }
    }

    if (filters.sellerType) {
      query = query.eq('seller_type', filters.sellerType)
    }

    if (filters.country) {
      query = query.eq('country', filters.country)
    }

    if (filters.searchQuery) {
      query = query.or(
        `display_name.ilike.%${filters.searchQuery}%,full_legal_name.ilike.%${filters.searchQuery}%,phone_number.ilike.%${filters.searchQuery}%`
      )
    }

    // Sorting
    const sortBy = filters.sortBy || 'created_at'
    const sortOrder = filters.sortOrder || 'desc'
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Pagination
    const page = filters.page || 1
    const limit = filters.limit || 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query.range(from, to)

    const { data, error, count } = await query as any

    if (error) {
      return { success: false, error: error.message }
    }

    // Resolve game names for all applications
    const { getGameNames } = await import('@/lib/utils/games')

    // Transform data to match expected format with nested user object
    const transformedData = await Promise.all((data || []).map(async (app: any) => {
      let gameNames: string[] = []
      if (app.primary_games && app.primary_games.length > 0) {
        try {
          gameNames = await getGameNames(app.primary_games)
        } catch (error) {
          gameNames = app.primary_games // Fallback to IDs
        }
      }

      // Submitted store image (public bucket) leads; the profile
      // avatar is only a fallback so pre-column legacy rows still show
      // something real instead of a generated avatar.
      const storeImageUrl = app.profile_picture_path
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-pictures/${app.profile_picture_path}`
        : null

      return {
        ...app,
        game_names: gameNames,
        store_image_url: storeImageUrl,
        user: {
          email: app.email || 'unknown@example.com',
          username: app.username,
          full_name: app.full_name,
          avatar_url: storeImageUrl || app.avatar_url || null,
          created_at: app.user_created_at || app.created_at,
          profile_picture_url: storeImageUrl
        }
      }
    }))

    return {
      success: true,
      applications: transformedData,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNextPage: to < (count || 0) - 1,
        hasPrevPage: page > 1,
      }
    }
  } catch (error: any) {
    console.error('Error fetching applications:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get single application with all details
 */
export async function getApplicationById(applicationId: string) {
  try {
    await requireAdmin()
    const supabase = await createClient()

    // Get application
    const { data: application, error: appError } = await supabase
      .from('seller_applications')
      .select('*')
      .eq('id', applicationId)
      .single() as any

    if (appError) throw appError

    // Get documents
    const { data: documents, error: docsError } = await supabase
      .from('seller_kyc_documents')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true }) as any

    // Get logs
    const { data: logs, error: logsError } = await supabase
      .from('seller_verification_logs')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false }) as any

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, full_name, avatar_url, email')
      .eq('id', application.user_id)
      .single() as any

    // Get game names for primary_games IDs
    let gameNames: string[] = []
    if (application.primary_games && application.primary_games.length > 0) {
      try {
        const { getGameNames } = await import('@/lib/utils/games')
        gameNames = await getGameNames(application.primary_games)
        console.log('🎮 Converted game IDs to names:', {
          ids: application.primary_games,
          names: gameNames
        })
      } catch (error) {
        console.error('Error fetching game names:', error)
        // Fallback: keep the IDs
        gameNames = application.primary_games
      }
    }

    return {
      success: true,
      application: {
        ...application,
        game_names: gameNames // Add resolved game names
      },
      documents: documents || [],
      logs: logs || [],
      profile,
    }
  } catch (error: any) {
    console.error('Error fetching application:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Start reviewing an application
 */
export async function startReview(applicationId: string) {
  try {
    const admin = await requireAdmin()
    const supabase = await createClient()

    // Update status to under_review
    const { error } = await (supabase
      .from('seller_applications')
      .update as any)({
        status: 'under_review',
        reviewed_by: admin.userId,
      })
      .eq('id', applicationId)
      .eq('status', 'pending') // Only if currently pending

    if (error) throw error

    // Log activity
    await logAdminActivity({
      action: ADMIN_ACTIONS.APPLICATION_REVIEW_STARTED,
      actionCategory: 'application',
      resourceType: 'seller_application',
      resourceId: applicationId,
    })

    // Add to verification logs
    await (supabase.from('seller_verification_logs').insert as any)({
      application_id: applicationId,
      action: 'review_started',
      performed_by: admin.userId,
      is_system_action: false,
      details: { admin_role: admin.role },
    })

    revalidatePath('/admin/sellers')
    revalidatePath(`/admin/sellers/${applicationId}`)

    return { success: true, message: 'Review started' }
  } catch (error: any) {
    console.error('Error starting review:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Approve seller application
 */
export async function approveApplication(applicationId: string, notes?: string) {
  try {
    const admin = await requireRole(['admin', 'super_admin'])
    const supabase = await createClient()

    // Get application details with user profile
    const { data: application } = await supabase
      .from('seller_applications')
      .select(`
        user_id,
        display_name,
        shop_name,
        full_legal_name,
        alternate_email,
        profiles!user_id (
          email,
          full_name,
          username
        )
      `)
      .eq('id', applicationId)
      .single() as any

    if (!application) {
      return { success: false, error: 'Application not found' }
    }

    // WRITE ORDER MATTERS (realtime race): the client's reactive auth effect
    // resubscribes when isApprovedSeller flips, which happens on the
    // seller_applications event. If that arrives BEFORE the profiles event,
    // the resubscribe can drop the profiles update carrying shop_name/role —
    // leaving the navbar stuck on username. So write profiles (identity)
    // FIRST and seller_applications (the status the client keys off) LAST,
    // making the identity update the one guaranteed to have already landed.
    const serviceClient = getServiceClient()

    const { data: currentProfile } = await serviceClient
      .from('profiles')
      .select('badges')
      .eq('id', application.user_id)
      .single() as any

    const currentBadges = currentProfile?.badges || []
    const newBadges = currentBadges.includes('verified')
      ? currentBadges
      : [...currentBadges, 'verified']

    // Generate shop_slug from shop_name or display_name
    const shopName = application.shop_name || application.display_name
    const baseSlug = slugify(shopName)

    // Check for uniqueness and append number if needed
    let shopSlug = baseSlug
    let counter = 0
    let slugExists = true

    while (slugExists) {
      const { data: existingProfile } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('shop_slug', shopSlug)
        .single() as any

      if (!existingProfile) {
        slugExists = false
      } else {
        counter++
        shopSlug = `${baseSlug}-${counter}`
      }
    }

    const { error: roleError } = await (serviceClient
      .from('profiles')
      .update as any)({
        role: 'seller',
        badges: newBadges,
        shop_name: shopName,
        shop_slug: shopSlug
      })
      .eq('id', application.user_id)

    if (roleError) {
      console.error('Error updating user role:', roleError)
      throw roleError
    }

    // Which verifications are complete, from the actually-uploaded KYC docs
    // (parity with the legacy admin-sellers copy this action replaced).
    const { data: kycDocs } = await supabase
      .from('seller_kyc_documents')
      .select('document_type')
      .eq('application_id', applicationId) as any
    const docTypes: string[] = kycDocs?.map((d: any) => d.document_type) || []
    const identity_verified = docTypes.some((t) => ['id_front', 'id_back', 'selfie_with_id'].includes(t))
    const address_verified = docTypes.includes('proof_of_address')
    const business_verified = docTypes.some((t) => ['certificate_of_incorporation', 'business_license', 'director_id'].includes(t))
    const tax_verified = docTypes.some((t) => ['w9_form', 'w8ben_form', 'bank_statement'].includes(t))

    // Status update LAST — this is the event the client's reactive effect
    // keys off; by now the profiles identity update has already been sent.
    const { error } = await (supabase
      .from('seller_applications')
      .update as any)({
        status: 'approved',
        reviewed_by: admin.userId,
        reviewed_at: new Date().toISOString(),
        admin_notes: notes,
        identity_verified,
        address_verified,
        business_verified,
        tax_verified,
      })
      .eq('id', applicationId)

    if (error) throw error

    // Send email notification
    const userEmail = (application.profiles as any)?.email || application.alternate_email
    if (userEmail) {
      await sendApplicationApprovedEmail({
        to: userEmail,
        name: application.full_legal_name || (application.profiles as any)?.full_name || 'Seller',
        displayName: application.display_name,
      })
    }

    // Log activity
    await logAdminActivity({
      action: ADMIN_ACTIONS.APPLICATION_APPROVED,
      actionCategory: 'application',
      resourceType: 'seller_application',
      resourceId: applicationId,
      resourceName: application.display_name,
      previousState: { status: 'pending' },
      newState: { status: 'approved' },
      notes: notes,
    })

    // Add to verification logs
    await (supabase.from('seller_verification_logs').insert as any)({
      application_id: applicationId,
      action: 'approved',
      performed_by: admin.userId,
      is_system_action: false,
      details: { notes, admin_role: admin.role },
    })

    // Beta C — nudge the applicant's open session. The realtime channel in
    // use-auth.tsx flips the CTA on approval, but if that session missed the
    // realtime window we also drop a notification row (via the service client,
    // since this is a cross-user insert). The navbar notification channel
    // surfaces it, giving the user an in-app link to their now-live dashboard.
    // Shape matches the notifications contract: { user_id, type, title,
    // message, link, is_read:false }.
    try {
      await (serviceClient.from('notifications').insert as any)({
        user_id: application.user_id,
        type: 'seller_application_approved',
        title: 'Seller Application Approved',
        message: 'Your seller access is now live. Head to your dashboard to set up your storefront.',
        link: '/account/dashboard',
        is_read: false,
      })
    } catch (notifyErr) {
      console.error('Failed to create approval notification:', notifyErr)
      // Non-fatal — approval already committed.
    }

    revalidatePath('/admin/sellers')
    revalidatePath(`/admin/sellers/${applicationId}`)

    return {
      success: true,
      message: `Application approved. ${application.display_name} is now a verified seller.`,
    }
  } catch (error: any) {
    console.error('Error approving application:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Reject seller application
 */
export async function rejectApplication(applicationId: string, reason: string, notes?: string) {
  try {
    const admin = await requireRole(['admin', 'super_admin'])
    const supabase = await createClient()

    // Get application details with user profile
    const { data: application } = await supabase
      .from('seller_applications')
      .select(`
        user_id,
        display_name,
        full_legal_name,
        alternate_email,
        profiles!user_id (
          email,
          full_name,
          username
        )
      `)
      .eq('id', applicationId)
      .single() as any

    const { error } = await (supabase
      .from('seller_applications')
      .update as any)({
        status: 'rejected',
        reviewed_by: admin.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
        admin_notes: notes,
      })
      .eq('id', applicationId)

    if (error) throw error

    // Send email notification
    if (application) {
      const userEmail = (application.profiles as any)?.email || application.alternate_email
      if (userEmail) {
        await sendApplicationRejectedEmail({
          to: userEmail,
          name: application.full_legal_name || (application.profiles as any)?.full_name || 'Seller',
          displayName: application.display_name,
          reason: reason,
        })
      }
    }

    // Log activity
    await logAdminActivity({
      action: ADMIN_ACTIONS.APPLICATION_REJECTED,
      actionCategory: 'application',
      resourceType: 'seller_application',
      resourceId: applicationId,
      resourceName: application?.display_name,
      previousState: { status: 'pending' },
      newState: { status: 'rejected', rejection_reason: reason },
      notes: notes,
    })

    // Add to verification logs
    await (supabase.from('seller_verification_logs').insert as any)({
      application_id: applicationId,
      action: 'rejected',
      performed_by: admin.userId,
      is_system_action: false,
      details: { reason, notes, admin_role: admin.role },
    })

    revalidatePath('/admin/sellers')
    revalidatePath(`/admin/sellers/${applicationId}`)

    return {
      success: true,
      message: 'Application rejected',
    }
  } catch (error: any) {
    console.error('Error rejecting application:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Request more information from applicant
 */
export async function requestMoreInfo(applicationId: string, message: string) {
  try {
    const admin = await requireAdmin()
    const supabase = await createClient()

    // Get application details with user profile
    const { data: application } = await supabase
      .from('seller_applications')
      .select(`
        user_id,
        display_name,
        full_legal_name,
        alternate_email,
        profiles!user_id (
          email,
          full_name,
          username
        )
      `)
      .eq('id', applicationId)
      .single() as any

    const { error } = await (supabase
      .from('seller_applications')
      .update as any)({
        status: 'info_requested',
        admin_notes: message,
      })
      .eq('id', applicationId)

    if (error) throw error

    // Send email notification
    if (application) {
      const userEmail = (application.profiles as any)?.email || application.alternate_email
      if (userEmail) {
        await sendInfoRequestedEmail({
          to: userEmail,
          name: application.full_legal_name || (application.profiles as any)?.full_name || 'Seller',
          displayName: application.display_name,
          message: message,
        })
      }
    }

    // Log activity
    await logAdminActivity({
      action: ADMIN_ACTIONS.APPLICATION_INFO_REQUESTED,
      actionCategory: 'application',
      resourceType: 'seller_application',
      resourceId: applicationId,
      resourceName: application?.display_name,
      newState: { status: 'info_requested', message },
      notes: message,
    })

    // Add to verification logs
    await (supabase.from('seller_verification_logs').insert as any)({
      application_id: applicationId,
      action: 'info_requested',
      performed_by: admin.userId,
      is_system_action: false,
      details: { message, admin_role: admin.role },
    })

    revalidatePath('/admin/sellers')
    revalidatePath(`/admin/sellers/${applicationId}`)

    return {
      success: true,
      message: 'Information request sent',
    }
  } catch (error: any) {
    console.error('Error requesting info:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Mark document as verified
 */
export async function verifyDocument(documentId: string, verified: boolean = true) {
  try {
    const admin = await requireAdmin()
    const supabase = await createClient()

    const { error } = await (supabase
      .from('seller_kyc_documents')
      .update as any)({
        verified,
        verified_by: admin.userId,
        verified_at: verified ? new Date().toISOString() : null,
      })
      .eq('id', documentId)

    if (error) throw error

    // Log activity
    await logAdminActivity({
      action: ADMIN_ACTIONS.DOCUMENT_VERIFIED,
      actionCategory: 'application',
      resourceType: 'kyc_document',
      resourceId: documentId,
      newState: { verified },
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error verifying document:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get signed URL for KYC document
 */
export async function getDocumentUrl(filePath: string) {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (error) throw error

    return { success: true, url: data.signedUrl }
  } catch (error: any) {
    console.error('Error getting document URL:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update fraud score
 */
export async function updateFraudScore(applicationId: string, score: number) {
  try {
    const admin = await requireRole(['admin', 'super_admin'])
    const supabase = await createClient()

    const { error } = await (supabase
      .from('seller_applications')
      .update as any)({ fraud_score: score })
      .eq('id', applicationId)

    if (error) throw error

    // Log activity
    await logAdminActivity({
      action: ADMIN_ACTIONS.FRAUD_SCORE_UPDATED,
      actionCategory: 'application',
      resourceType: 'seller_application',
      resourceId: applicationId,
      newState: { fraud_score: score },
    })

    revalidatePath(`/admin/sellers/${applicationId}`)

    return { success: true }
  } catch (error: any) {
    console.error('Error updating fraud score:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Check for duplicate applications
 */
export async function checkDuplicates(applicationId: string) {
  try {
    await requireAdmin()
    const supabase = await createClient()

    // Get current application
    const { data: currentApp } = await supabase
      .from('seller_applications')
      .select('phone_number, full_legal_name, user_id, alternate_email')
      .eq('id', applicationId)
      .single() as any

    if (!currentApp) return { success: false, error: 'Application not found' }

    // Check for duplicates by phone
    const { data: byPhone } = await supabase
      .from('seller_applications')
      .select('id, display_name, status, created_at')
      .eq('phone_number', currentApp.phone_number)
      .neq('id', applicationId) as any

    // Check for duplicates by name
    const { data: byName } = await supabase
      .from('seller_applications')
      .select('id, display_name, status, created_at')
      .eq('full_legal_name', currentApp.full_legal_name)
      .neq('id', applicationId) as any

    return {
      success: true,
      duplicates: {
        byPhone: byPhone || [],
        byName: byName || [],
        total: (byPhone?.length || 0) + (byName?.length || 0),
      },
    }
  } catch (error: any) {
    console.error('Error checking duplicates:', error)
    return { success: false, error: error.message }
  }
}