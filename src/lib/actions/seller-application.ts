/**
 * Server Actions for Seller Application Submission
 *
 * Handles:
 * - Form data submission to database
 * - File uploads to Supabase Storage
 * - Validation and error handling
 * - Audit logging
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Type definitions (inline to avoid missing module error)
type Step1FormData = any
type Step2FormData = any
type Step3FormData = any
type Step4FormData = any
type Step5FormData = any
type Step6FormData = any

interface FileMetadata {
  path: string
  name: string
  size: number
  type: string
}

interface SubmitApplicationData {
  step1: Step1FormData
  step2: Step2FormData
  step3?: Step3FormData
  step4?: Step4FormData
  step5?: Step5FormData
  step6?: Step6FormData
  uploadedFilePaths?: Record<string, FileMetadata | null>
  profilePicturePath?: FileMetadata | null
  selectedLanguages?: string[]
}

interface SubmitApplicationResult {
  success: boolean
  applicationId?: string
  error?: string
  message?: string
}

/**
 * Main function to submit seller application
 */
export async function submitSellerApplication(
  data: SubmitApplicationData
): Promise<SubmitApplicationResult> {
  try {
    // Validate required data
    if (!data || !data.step1 || !data.step2) {
      return {
        success: false,
        error: 'Missing required form data. Please complete all required steps.',
      }
    }

    const supabase = await createClient()

    // 1. Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'You must be logged in to submit an application.',
      }
    }

    // 2. Block a duplicate while one is actively in the pipeline. An
    // info_requested row is EDITABLE — the admin asked for changes, so a
    // resubmit must UPDATE that same row (preserving its history/thread),
    // never insert a second application for the user.
    const { data: activeApp } = await supabase
      .from('seller_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'under_review', 'approved'])
      .maybeSingle() as any

    if (activeApp) {
      return {
        success: false,
        error: `You already have ${activeApp.status === 'approved' ? 'an approved' : 'a pending'} application.`,
        applicationId: activeApp.id,
      }
    }

    // An editable row to resubmit into (info_requested = admin wants changes).
    const { data: editableApp } = await supabase
      .from('seller_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'info_requested')
      .maybeSingle() as any

    // 3. Insert seller application into database
    console.log('📝 Submitting seller application with data:', {
      hasStep1: !!data.step1,
      hasStep2: !!data.step2,
      hasStep3: !!data.step3,
      hasStep4: !!data.step4,
      hasStep5: !!data.step5,
      hasStep6: !!data.step6,
    })

    const applicationPayload = {
        user_id: user.id,
        status: 'pending' as const,

        // Step 1: Eligibility
        is_18_or_older: data.step1?.is18OrOlder ?? false,
        seller_type: data.step1?.sellerType ?? '',
        primary_games: data.step1?.primaryGames || [],
        other_games: data.step1?.otherGames?.trim() || null,
        // Redesign: per-game category selections (jsonb). Absent from the
        // legacy wizard payload → null, so old submissions are unaffected.
        games_categories: (data.step1 as any)?.gamesCategories ?? null,
        expected_monthly_volume: data.step1?.expectedVolume ?? '',
        referral_code: data.step1?.referralCode || null,

        // Store image / logo uploaded in the wizard (profile-pictures
        // bucket) — persisted so admin review surfaces can show the
        // submitted store image instead of a generated avatar.
        profile_picture_path: data.profilePicturePath?.path ?? null,

        // Step 2: Business Information
        full_legal_name: data.step2?.fullLegalName ?? '',
        display_name: data.step2?.displayName ?? '',
        // Public storefront name the seller chose — load-bearing: the shop
        // slug is built from this at approval (admin-seller-review). Falls
        // back to the OTHER free-text country when the country is "Other".
        shop_name: data.step2?.shopName ?? null,
        country:
          data.step2?.country === 'OTHER'
            ? (data.step2?.countryOther?.trim() || 'Other')
            : (data.step2?.country ?? ''),
        state_province: data.step2?.stateProvince || null,
        city: data.step2?.city || null,
        phone_number: data.step2?.phoneNumber ?? '',
        phone_verified: false,
        alternate_email: data.step2?.alternateEmail || null,

        // Business-specific fields (conditional)
        company_legal_name: data.step2?.companyLegalName || null,
        business_registration_number: data.step2?.businessRegistrationNumber || null,
        tax_id_vat: data.step2?.taxIdVat || null,
        company_address: data.step2?.companyAddress || null,
        business_type: data.step2?.businessType || null,
        year_established: data.step2?.yearEstablished ? parseInt(data.step2.yearEstablished) : null,
        business_email: data.step2?.businessEmail || null,
        business_phone: data.step2?.businessPhone || null,

        // Step 4: Profile (if provided)
        profile_bio: data.step4?.bio || null,
        business_hours: data.step4?.businessHours || null,
        timezone: data.step4?.timezone || null,
        languages_spoken: data.selectedLanguages || [],
        discord_username: data.step4?.discordUsername || null,
        twitter_handle: data.step4?.twitterHandle || null,
        twitch_channel: data.step4?.twitchChannel || null,
        youtube_channel: data.step4?.youtubeChannel || null,
        refund_policy: data.step4?.refundPolicy || null,
        delivery_timeframe: data.step4?.deliveryTimeframe || null,
        terms_of_service: data.step4?.termsOfService || null,

        // Step 5: Payment (if provided). The wizard's 'crypto' value maps to
        // the DB's legacy 'cryptocurrency' — the payout_method CHECK
        // constraint only allows ('bank_transfer','paypal','cryptocurrency'),
        // so writing 'crypto' rejects the whole application.
        payout_method:
          data.step5?.payoutMethod === 'crypto'
            ? 'cryptocurrency'
            : data.step5?.payoutMethod || null,
        bank_account_holder_name: data.step5?.accountHolderName || null,
        bank_name: data.step5?.bankName || null,
        bank_account_number_encrypted: data.step5?.accountNumber || null, // TODO: Encrypt in production
        bank_routing_code: data.step5?.routingCode || null,
        bank_swift_code: data.step5?.swiftCode || null,
        bank_iban: data.step5?.iban || null,
        crypto_wallet_address: data.step5?.cryptoWalletAddress || null,
        crypto_type: data.step5?.cryptoType || null,
        // Redesign: preferred payout currency (nullable; legacy = null).
        payout_currency: (data.step5 as any)?.payoutCurrency || null,
        tax_residency_country: data.step5?.taxResidencyCountry || null,

        // Step 6: Agreements. accepted_commission_structure is the legacy
        // column name for the fee-schedule consent the wizard now collects
        // (acceptedFeeSchedule) — same legal meaning, existing column reused.
        accepted_seller_agreement: data.step6?.acceptedSellerAgreement || false,
        accepted_privacy_policy: data.step6?.acceptedPrivacyPolicy || false,
        accepted_anti_fraud_policy: data.step6?.acceptedAntiFraudPolicy || false,
        accepted_commission_structure: data.step6?.acceptedFeeSchedule || false,
        accepted_data_processing: data.step6?.acceptedDataProcessing || false,
        information_accurate_confirmed: data.step6?.informationAccurate || false,

        // Redesign: the e-signature record (typed legal name + signed time)
        // and the optional selling-experience note. Legacy payload lacks
        // these keys → null, so nothing changes for old submissions.
        seller_signature: (data.step6 as any)?.sellerSignature || null,
        seller_signed_at: (data.step6 as any)?.sellerSignedAt || null,
        selling_experience: (data.step6 as any)?.sellingExperience || null,

        // Metadata
        submitted_at: new Date().toISOString(),
        fraud_score: 0, // TODO: Implement fraud detection
    }

    // Resubmit into the existing info_requested row, else create a fresh one.
    // The update clears the prior admin_notes so a stale "changes requested"
    // note doesn't linger after the seller has addressed it.
    const { data: application, error: insertError } = editableApp
      ? await (supabase
          .from('seller_applications')
          .update as any)({ ...applicationPayload, admin_notes: null, reviewed_at: null, reviewed_by: null })
          .eq('id', editableApp.id)
          .select()
          .single()
      : await (supabase
          .from('seller_applications')
          .insert as any)(applicationPayload)
          .select()
          .single()

    if (insertError) {
      console.error('Error saving application:', insertError)
      return {
        success: false,
        error: 'Failed to submit application. Please try again.',
      }
    }

    // 4. Insert KYC documents metadata
    if (data.uploadedFilePaths && Object.keys(data.uploadedFilePaths).length > 0) {
      const kycDocuments = []

      for (const [fileType, fileMetadata] of Object.entries(data.uploadedFilePaths) as any) {
        if (fileMetadata) {
          kycDocuments.push({
            application_id: application.id,
            user_id: user.id,
            document_type: mapFileTypeToDocumentType(fileType),
            file_path: fileMetadata.path,
            file_name: fileMetadata.name,
            file_size: fileMetadata.size,
            file_type: fileMetadata.type,
            verified: false,
          })
        }
      }

      if (kycDocuments.length > 0) {
        const { error: docsError } = await (supabase
          .from('seller_kyc_documents')
          .insert as any)(kycDocuments)

        if (docsError) {
          console.error('Error inserting KYC documents:', docsError)
          // Don't fail the entire submission if documents fail
          // Admin can request re-upload
        }
      }
    }

    // 5. Notify admin team about new seller application
    try {
      const { notifyAdmins } = await import('@/lib/utils/notifications')
      await notifyAdmins({
        permission: 'sellers.review',
        type: 'new_seller_application',
        title: 'New Seller Application',
        message: `${data.step2.displayName} (${data.step1.sellerType}) has submitted a seller application`,
        link: `/admin/sellers`,
      })
      console.log('[SellerApplication] Admin notifications sent')
    } catch (error) {
      console.error('[SellerApplication] Failed to notify admins:', error)
      // Non-fatal - application is already submitted
    }

    // 5b. Confirmation email to the applicant. Fire-and-forget-with-catch:
    // a Resend outage must never fail an already-committed submission.
    try {
      const { sendApplicationReceivedEmail } = await import('@/lib/email')
      const applicantEmail = user.email || data.step1?.alternateEmail || data.step2?.alternateEmail
      if (applicantEmail) {
        await sendApplicationReceivedEmail({
          to: applicantEmail,
          name: data.step2?.fullLegalName || data.step2?.displayName || 'there',
          displayName: data.step2?.displayName || data.step2?.shopName || 'your store',
          applicationId: application.id,
        })
        console.log('[SellerApplication] Confirmation email sent')
      }
    } catch (error) {
      console.error('[SellerApplication] Failed to send confirmation email:', error)
      // Non-fatal - application is already submitted
    }

    // 6. Revalidate paths
    revalidatePath('/account/become-seller')
    revalidatePath('/account/seller-status')

    return {
      success: true,
      applicationId: application.id,
      message: 'Application submitted successfully! You will receive an email confirmation shortly.',
    }
  } catch (error) {
    console.error('Unexpected error in submitSellerApplication:', error)
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    }
  }
}

/**
 * Upload KYC document to Supabase Storage
 */
async function uploadKYCDocument(
  userId: string,
  fileType: string,
  file: File
): Promise<string | null> {
  try {
    const supabase = await createClient()

    // Generate unique file name
    const timestamp = Date.now()
    const fileName = `${userId}/${fileType}-${timestamp}.${file.name.split('.').pop()}`

    // Upload to storage
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error(`Error uploading ${fileType}:`, error)
      return null
    }

    // Get public URL (even though bucket is private, we need the path)
    const {
      data: { publicUrl },
    } = supabase.storage.from('kyc-documents').getPublicUrl(data.path)

    return data.path // Return path, not publicUrl (for private bucket)
  } catch (error) {
    console.error(`Unexpected error uploading ${fileType}:`, error)
    return null
  }
}

/**
 * Upload profile picture to Supabase Storage
 */
async function uploadProfilePicture(userId: string, file: File): Promise<string | null> {
  try {
    const supabase = await createClient()

    // Generate unique file name
    const timestamp = Date.now()
    const fileName = `${userId}/profile-${timestamp}.${file.name.split('.').pop()}`

    // Upload to storage
    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true, // Allow overwrite
      })

    if (error) {
      console.error('Error uploading profile picture:', error)
      return null
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('profile-pictures').getPublicUrl(data.path)

    return publicUrl
  } catch (error) {
    console.error('Unexpected error uploading profile picture:', error)
    return null
  }
}

/**
 * Map file type keys to database document_type enum
 */
function mapFileTypeToDocumentType(fileType: string): string {
  const mapping: Record<string, string> = {
    idDocument: 'id_front',
    selfieWithId: 'selfie_with_id',
    proofOfAddress: 'proof_of_address',
    certificateOfIncorporation: 'certificate_of_incorporation',
    businessLicense: 'business_license',
    directorId: 'director_id',
    bankStatement: 'bank_statement',
  }

  return mapping[fileType] || 'other'
}

/**
 * Get application status for the current user
 */
export async function getApplicationStatus(): Promise<{
  success: boolean
  application?: any
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'You must be logged in to view your application status.',
      }
    }

    const { data: application, error } = await supabase
      .from('seller_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // No application found is not an error
      if (error.code === 'PGRST116') {
        return {
          success: true,
          application: null,
        }
      }

      return {
        success: false,
        error: 'Failed to fetch application status.',
      }
    }

    return {
      success: true,
      application,
    }
  } catch (error) {
    console.error('Unexpected error in getApplicationStatus:', error)
    return {
      success: false,
      error: 'An unexpected error occurred.',
    }
  }
}

/**
 * Withdraw a seller application
 * Allows users to cancel their pending/under_review application
 */
export async function withdrawApplication(): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'You must be logged in to withdraw an application.',
      }
    }

    // Check if user has a pending or under_review application
    const { data: application, error: fetchError } = await supabase
      .from('seller_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'under_review'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as any

    if (fetchError || !application) {
      return {
        success: false,
        error: 'No application found to withdraw.',
      }
    }

    // Only allow withdrawal of pending or under_review applications
    if (application.status !== 'pending' && application.status !== 'under_review') {
      return {
        success: false,
        error: `Cannot withdraw ${application.status} application. Only pending or under review applications can be withdrawn.`,
      }
    }

    // Update application status to withdrawn
    const { error: updateError } = await (supabase
      .from('seller_applications')
      .update as any)({
        status: 'withdrawn',
        updated_at: new Date().toISOString(),
      })
      .eq('id', application.id)

    if (updateError) {
      console.error('Error withdrawing application:', updateError)
      return {
        success: false,
        error: 'Failed to withdraw application. Please try again.',
      }
    }

    // Revalidate paths
    revalidatePath('/account/seller-status')
    revalidatePath('/account/become-seller')

    return {
      success: true,
      message: 'Application withdrawn successfully. You can submit a new application anytime.',
    }
  } catch (error) {
    console.error('Unexpected error in withdrawApplication:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while withdrawing the application.',
    }
  }
}
