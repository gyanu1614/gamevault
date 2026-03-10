/**
 * Supabase Storage Integration - Listing Images
 *
 * Handles upload, deletion, and management of listing images
 * Bucket: listing-images (public, 5MB limit, images only)
 */

import { createClient } from '@/lib/supabase/client'

// Constants
const BUCKET_NAME = 'listing-images'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGES_PER_LISTING = 10
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
]
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

// Types
export interface UploadImageResult {
  success: boolean
  url?: string
  path?: string
  error?: string
}

export interface DeleteImageResult {
  success: boolean
  error?: string
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): ValidationResult {
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
      error: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
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
 * Generate unique file path for listing image
 * Format: {listingId}/{timestamp}-{randomString}.{extension}
 */
function generateFilePath(listingId: string, fileName: string): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 10)
  const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg'

  return `${listingId}/${timestamp}-${randomString}.${extension}`
}

/**
 * Upload single image to listing-images bucket
 */
export async function uploadListingImage(
  file: File,
  listingId: string
): Promise<UploadImageResult> {
  try {
    // Validate file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }

    // Generate unique file path
    const filePath = generateFilePath(listingId, file.name)

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
      console.error('Upload error:', error)
      return {
        success: false,
        error: error.message || 'Failed to upload image'
      }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    return {
      success: true,
      url: publicUrl,
      path: data.path
    }
  } catch (error) {
    console.error('Unexpected upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Upload multiple images for a listing
 */
export async function uploadListingImages(
  files: File[],
  listingId: string
): Promise<UploadImageResult[]> {
  // Validate number of files
  if (files.length > MAX_IMAGES_PER_LISTING) {
    throw new Error(`Maximum ${MAX_IMAGES_PER_LISTING} images allowed per listing`)
  }

  // Upload all files in parallel
  const uploadPromises = files.map(file => uploadListingImage(file, listingId))
  const results = await Promise.all(uploadPromises)

  return results
}

/**
 * Delete single image from listing-images bucket
 */
export async function deleteListingImage(filePath: string): Promise<DeleteImageResult> {
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
      console.error('Delete error:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete image'
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
 * Delete multiple images from listing-images bucket
 */
export async function deleteListingImages(filePaths: string[]): Promise<DeleteImageResult> {
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
      console.error('Delete multiple images error:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete images'
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
 * Delete all images for a specific listing
 */
export async function deleteAllListingImages(listingId: string): Promise<DeleteImageResult> {
  try {
    const supabase = createClient()

    // List all files in the listing folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(listingId)

    if (listError) {
      console.error('List files error:', listError)
      return {
        success: false,
        error: listError.message || 'Failed to list images'
      }
    }

    if (!files || files.length === 0) {
      return { success: true } // No files to delete
    }

    // Build full paths
    const filePaths = files.map(file => `${listingId}/${file.name}`)

    // Delete all files
    return await deleteListingImages(filePaths)
  } catch (error) {
    console.error('Unexpected error deleting all images:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
  }
}

/**
 * Get public URL for a listing image
 */
export function getListingImageUrl(filePath: string): string {
  const supabase = createClient()

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath)

  return data.publicUrl
}

/**
 * Get public URLs for multiple listing images
 */
export function getListingImageUrls(filePaths: string[]): string[] {
  return filePaths.map(path => getListingImageUrl(path))
}

/**
 * Extract file path from full URL
 * Useful when you have a public URL and need the storage path
 */
export function extractFilePathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split(`/${BUCKET_NAME}/`)

    if (pathParts.length < 2) {
      return null
    }

    return pathParts[1]
  } catch (error) {
    console.error('Error extracting file path from URL:', error)
    return null
  }
}

/**
 * Replace old listing images with new ones
 * Useful when updating a listing with new images
 */
export async function replaceListingImages(
  listingId: string,
  oldFilePaths: string[],
  newFiles: File[]
): Promise<{
  success: boolean
  uploadResults?: UploadImageResult[]
  error?: string
}> {
  try {
    // Delete old images first
    if (oldFilePaths && oldFilePaths.length > 0) {
      const deleteResult = await deleteListingImages(oldFilePaths)
      if (!deleteResult.success) {
        return {
          success: false,
          error: `Failed to delete old images: ${deleteResult.error}`
        }
      }
    }

    // Upload new images
    const uploadResults = await uploadListingImages(newFiles, listingId)

    // Check if any uploads failed
    const failedUploads = uploadResults.filter(result => !result.success)
    if (failedUploads.length > 0) {
      return {
        success: false,
        uploadResults,
        error: `${failedUploads.length} image(s) failed to upload`
      }
    }

    return {
      success: true,
      uploadResults
    }
  } catch (error) {
    console.error('Error replacing listing images:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }
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
