/**
 * Supabase Storage Integration - Delivery Evidence
 *
 * Handles upload and management of delivery evidence (screenshots/videos)
 * Bucket: delivery-evidence (private, 50MB limit, images + videos)
 * Used by SafeDrop escrow system
 */

import { createClient } from '@/lib/supabase/client'

// Constants
const BUCKET_NAME = 'delivery-evidence'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_FILES_PER_ORDER = 5
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
]
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo'
]
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]
const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.mp4',
  '.webm',
  '.mov',
  '.avi'
]

// Types
export interface UploadEvidenceResult {
  success: boolean
  path?: string
  fileType?: 'image' | 'video'
  error?: string
}

export interface DeleteEvidenceResult {
  success: boolean
  error?: string
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface SignedUrlResult {
  success: boolean
  url?: string
  expiresIn?: number
  error?: string
}

/**
 * Validate evidence file before upload
 */
export function validateEvidenceFile(file: File): ValidationResult {
  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)
    return {
      valid: false,
      error: `File size exceeds ${sizeMB}MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`
    }
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: images (JPG, PNG, WebP, GIF) and videos (MP4, WebM, MOV, AVI)`
    }
  }

  // Check file extension
  const fileName = file.name.toLowerCase()
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext))

  if (!hasValidExtension) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`
    }
  }

  return { valid: true }
}

/**
 * Determine if file is image or video
 */
function getFileType(mimeType: string): 'image' | 'video' {
  return ALLOWED_IMAGE_TYPES.includes(mimeType) ? 'image' : 'video'
}

/**
 * Generate unique file path for delivery evidence
 * Format: {orderId}/{timestamp}-{randomString}.{extension}
 */
function generateFilePath(orderId: string, fileName: string): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 10)
  const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg'

  return `${orderId}/${timestamp}-${randomString}.${extension}`
}

/**
 * Upload single delivery evidence file
 */
export async function uploadDeliveryEvidence(
  file: File,
  orderId: string
): Promise<UploadEvidenceResult> {
  try {
    // Validate file
    const validation = validateEvidenceFile(file)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }

    // Generate unique file path
    const filePath = generateFilePath(orderId, file.name)
    const fileType = getFileType(file.type)

    // Get Supabase client
    const supabase = createClient()

    // Upload file
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Upload evidence error:', error)
      return {
        success: false,
        error: error.message || 'Failed to upload evidence'
      }
    }

    return {
      success: true,
      path: data.path,
      fileType
    }
  } catch (error) {
    console.error('Unexpected upload evidence error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Upload multiple delivery evidence files
 */
export async function uploadDeliveryEvidences(
  files: File[],
  orderId: string
): Promise<UploadEvidenceResult[]> {
  // Validate number of files
  if (files.length > MAX_FILES_PER_ORDER) {
    throw new Error(`Maximum ${MAX_FILES_PER_ORDER} files allowed per order`)
  }

  // Upload all files in parallel
  const uploadPromises = files.map(file => uploadDeliveryEvidence(file, orderId))
  const results = await Promise.all(uploadPromises)

  return results
}

/**
 * Delete single delivery evidence file
 */
export async function deleteDeliveryEvidence(
  filePath: string
): Promise<DeleteEvidenceResult> {
  try {
    if (!filePath) {
      return {
        success: false,
        error: 'No file path provided'
      }
    }

    const supabase = createClient()

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath])

    if (error) {
      console.error('Delete evidence error:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete evidence'
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected delete evidence error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Delete multiple delivery evidence files
 */
export async function deleteDeliveryEvidences(
  filePaths: string[]
): Promise<DeleteEvidenceResult> {
  try {
    if (!filePaths || filePaths.length === 0) {
      return {
        success: false,
        error: 'No file paths provided'
      }
    }

    const supabase = createClient()

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths)

    if (error) {
      console.error('Delete multiple evidences error:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete evidences'
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected delete error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Delete all delivery evidence for a specific order
 */
export async function deleteAllOrderEvidence(orderId: string): Promise<DeleteEvidenceResult> {
  try {
    const supabase = createClient()

    // List all files in the order folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(orderId)

    if (listError) {
      console.error('List evidence files error:', listError)
      return {
        success: false,
        error: listError.message || 'Failed to list evidence files'
      }
    }

    if (!files || files.length === 0) {
      return { success: true } // No files to delete
    }

    // Build full paths
    const filePaths = files.map(file => `${orderId}/${file.name}`)

    // Delete all files
    return await deleteDeliveryEvidences(filePaths)
  } catch (error) {
    console.error('Unexpected error deleting all evidence:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Get signed URL for viewing private delivery evidence
 * URL expires after specified time (default 1 hour)
 */
export async function getDeliveryEvidenceSignedUrl(
  filePath: string,
  expiresIn: number = 3600 // 1 hour in seconds
): Promise<SignedUrlResult> {
  try {
    if (!filePath) {
      return {
        success: false,
        error: 'No file path provided'
      }
    }

    const supabase = createClient()

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      console.error('Error creating signed URL:', error)
      return {
        success: false,
        error: error.message || 'Failed to create signed URL'
      }
    }

    return {
      success: true,
      url: data.signedUrl,
      expiresIn
    }
  } catch (error) {
    console.error('Unexpected error creating signed URL:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Get signed URLs for multiple delivery evidence files
 */
export async function getDeliveryEvidenceSignedUrls(
  filePaths: string[],
  expiresIn: number = 3600
): Promise<SignedUrlResult[]> {
  const urlPromises = filePaths.map(path =>
    getDeliveryEvidenceSignedUrl(path, expiresIn)
  )

  return await Promise.all(urlPromises)
}

/**
 * List all delivery evidence files for an order
 */
export async function listOrderEvidence(orderId: string): Promise<{
  success: boolean
  files?: Array<{
    name: string
    path: string
    size: number
    createdAt: string
  }>
  error?: string
}> {
  try {
    const supabase = createClient()

    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(orderId, {
        sortBy: { column: 'created_at', order: 'asc' }
      })

    if (error) {
      console.error('List order evidence error:', error)
      return {
        success: false,
        error: error.message || 'Failed to list evidence files'
      }
    }

    if (!files) {
      return {
        success: true,
        files: []
      }
    }

    // Map to more useful format
    const mappedFiles = files.map(file => ({
      name: file.name,
      path: `${orderId}/${file.name}`,
      size: file.metadata?.size || 0,
      createdAt: file.created_at || ''
    }))

    return {
      success: true,
      files: mappedFiles
    }
  } catch (error) {
    console.error('Unexpected error listing evidence:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Check if evidence exists for an order
 */
export async function hasDeliveryEvidence(orderId: string): Promise<boolean> {
  const result = await listOrderEvidence(orderId)
  return result.success && (result.files?.length || 0) > 0
}

/**
 * Get total size of all evidence files for an order
 */
export async function getOrderEvidenceSize(orderId: string): Promise<{
  success: boolean
  totalSizeBytes?: number
  totalSizeMB?: number
  error?: string
}> {
  const result = await listOrderEvidence(orderId)

  if (!result.success || !result.files) {
    return {
      success: false,
      error: result.error || 'Failed to calculate evidence size'
    }
  }

  const totalSizeBytes = result.files.reduce((sum, file) => sum + file.size, 0)
  const totalSizeMB = totalSizeBytes / (1024 * 1024)

  return {
    success: true,
    totalSizeBytes,
    totalSizeMB: parseFloat(totalSizeMB.toFixed(2))
  }
}

/**
 * Helper to check if bucket is accessible
 * Useful for debugging
 */
export async function checkBucketAccess(): Promise<{
  accessible: boolean
  error?: string
}> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 1 })

    if (error) {
      return {
        accessible: false,
        error: error.message
      }
    }

    return { accessible: true }
  } catch (error) {
    return {
      accessible: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
