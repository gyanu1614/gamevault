'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireAdmin } from './admin-permissions'

/**
 * Get a signed URL for viewing/downloading a KYC document
 */
export async function getDocumentSignedUrl(
  filePath: string
): Promise<{ url: string | null; error?: string }> {
  try {
    await requireAdmin()

    // Use service role client to bypass RLS and access any user's documents
    const supabase = createServiceRoleClient()

    // Remove leading slash if present
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(cleanPath, 3600) // 3600 seconds = 1 hour

    if (error) {
      console.error('Error creating signed URL:', error)
      return { url: null, error: 'Failed to generate document URL' }
    }

    return { url: data.signedUrl }
  } catch (error: any) {
    console.error('Error in getDocumentSignedUrl:', error)
    return { url: null, error: error.message || 'Failed to generate document URL' }
  }
}

/**
 * Get signed URLs for multiple documents
 */
export async function getDocumentsSignedUrls(
  filePaths: string[]
): Promise<{ urls: Record<string, string>; error?: string }> {
  try {
    await requireAdmin()

    // Use service role client to bypass RLS and access any user's documents
    const supabase = createServiceRoleClient()
    const urls: Record<string, string> = {}

    console.log('[KYC] Requesting signed URLs for paths:', filePaths)

    // Generate signed URLs for all documents in parallel
    const results = await Promise.all(
      filePaths.map(async (filePath) => {
        const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath

        console.log(`[KYC] Attempting to create signed URL for: "${cleanPath}"`)

        const { data, error } = await supabase.storage
          .from('kyc-documents')
          .createSignedUrl(cleanPath, 3600)

        if (error) {
          console.error(`[KYC] Error generating signed URL for ${cleanPath}:`, error)
          return { filePath, url: null, error }
        }

        console.log(`[KYC] Successfully generated signed URL for: ${cleanPath}`)

        return {
          filePath,
          url: data?.signedUrl || null,
          error: null
        }
      })
    )

    // Build the URLs object
    for (const result of results) {
      if (result.url) {
        urls[result.filePath] = result.url
      } else {
        console.error(`[KYC] Failed to generate URL for ${result.filePath}:`, result.error)
      }
    }

    console.log(`[KYC] Successfully generated ${Object.keys(urls).length} out of ${filePaths.length} URLs`)

    return { urls }
  } catch (error: any) {
    console.error('[KYC] Error in getDocumentsSignedUrls:', error)
    return { urls: {}, error: error.message || 'Failed to generate document URLs' }
  }
}
