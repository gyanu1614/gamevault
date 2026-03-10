/**
 * Delivery Evidence Actions
 *
 * Server actions for managing delivery evidence (upload, delete)
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Upload delivery evidence files
 */
export async function uploadDeliveryEvidence(
  orderId: string,
  files: File[]
): Promise<{
  success: boolean
  urls?: string[]
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
        error: 'You must be logged in',
      }
    }

    // Verify seller owns this order
    const { data: order } = await supabase
      .from('orders')
      .select('seller_id, delivery_evidence_urls')
      .eq('id', orderId)
      .single()

    if (!order || order.seller_id !== user.id) {
      return {
        success: false,
        error: 'Order not found or you do not have permission',
      }
    }

    const uploadedUrls: string[] = []

    // Upload each file to Supabase Storage
    for (const file of files) {
      const fileName = `${Date.now()}-${file.name}`
      const filePath = `${orderId}/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('delivery-evidence')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        continue
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('delivery-evidence').getPublicUrl(filePath)

      uploadedUrls.push(publicUrl)
    }

    if (uploadedUrls.length === 0) {
      return {
        success: false,
        error: 'Failed to upload files',
      }
    }

    // Update order with new evidence URLs
    const existingUrls = order.delivery_evidence_urls || []
    const updatedUrls = [...existingUrls, ...uploadedUrls]

    const { error: updateError } = await supabase
      .from('orders')
      .update({ delivery_evidence_urls: updatedUrls })
      .eq('id', orderId)

    if (updateError) {
      return {
        success: false,
        error: 'Failed to update order',
      }
    }

    revalidatePath(`/seller/orders/${orderId}`)

    return {
      success: true,
      urls: uploadedUrls,
    }
  } catch (error: any) {
    console.error('Error in uploadDeliveryEvidence:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload delivery evidence',
    }
  }
}

/**
 * Delete delivery evidence file
 */
export async function deleteDeliveryEvidence(
  orderId: string,
  fileUrl: string
): Promise<{
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
        error: 'You must be logged in',
      }
    }

    // Verify seller owns this order
    const { data: order } = await supabase
      .from('orders')
      .select('seller_id, delivery_evidence_urls')
      .eq('id', orderId)
      .single()

    if (!order || order.seller_id !== user.id) {
      return {
        success: false,
        error: 'Order not found or you do not have permission',
      }
    }

    // Extract file path from URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/delivery-evidence/{orderId}/{fileName}
    const urlParts = fileUrl.split('/delivery-evidence/')
    if (urlParts.length < 2) {
      return {
        success: false,
        error: 'Invalid file URL',
      }
    }

    const filePath = urlParts[1]

    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from('delivery-evidence')
      .remove([filePath])

    if (deleteError) {
      console.error('Error deleting file from storage:', deleteError)
    }

    // Update order - remove URL from array
    const updatedUrls = (order.delivery_evidence_urls || []).filter(
      (url: string) => url !== fileUrl
    )

    const { error: updateError } = await supabase
      .from('orders')
      .update({ delivery_evidence_urls: updatedUrls })
      .eq('id', orderId)

    if (updateError) {
      return {
        success: false,
        error: 'Failed to update order',
      }
    }

    revalidatePath(`/seller/orders/${orderId}`)

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error in deleteDeliveryEvidence:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete delivery evidence',
    }
  }
}
