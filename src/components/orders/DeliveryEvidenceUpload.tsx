/**
 * Delivery Evidence Upload Component
 *
 * Allows sellers to upload delivery proof (screenshots, videos)
 */

'use client'

import React, { useState } from 'react'
import { Upload, X, FileImage, FileVideo, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { uploadDeliveryEvidence, deleteDeliveryEvidence } from '@/lib/actions/delivery-evidence'

interface DeliveryEvidenceUploadProps {
  orderId: string
  existingEvidence: string[]
  disabled?: boolean
}

export default function DeliveryEvidenceUpload({
  orderId,
  existingEvidence,
  disabled = false
}: DeliveryEvidenceUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [evidence, setEvidence] = useState<string[]>(existingEvidence)
  const router = useRouter()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    if (files.length === 0) return

    // Validate file types
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'video/mp4', 'video/webm']
    const invalidFiles = files.filter(file => !validTypes.includes(file.type))

    if (invalidFiles.length > 0) {
      toast.error('Only images (PNG, JPG) and videos (MP4, WebM) are allowed')
      return
    }

    // Validate file sizes (max 10MB per file)
    const maxSize = 10 * 1024 * 1024 // 10MB
    const oversizedFiles = files.filter(file => file.size > maxSize)

    if (oversizedFiles.length > 0) {
      toast.error('Files must be under 10MB each')
      return
    }

    setUploading(true)

    try {
      // TODO: Implement uploadDeliveryEvidence server action
      // This should:
      // 1. Upload files to Supabase Storage (delivery-evidence bucket)
      // 2. Update order.delivery_evidence_urls array
      // 3. Return the new URLs

      // Temporary mock upload
      await new Promise(resolve => setTimeout(resolve, 1500))
      const mockUrls = files.map((file, i) => `https://storage.example.com/delivery-evidence/${orderId}/${Date.now()}-${i}-${file.name}`)

      setEvidence([...evidence, ...mockUrls])
      toast.success(`${files.length} file(s) uploaded successfully`)
      router.refresh()
    } catch (error) {
      console.error('Error uploading evidence:', error)
      toast.error('Failed to upload files. Please try again.')
    } finally {
      setUploading(false)
      e.target.value = '' // Reset input
    }
  }

  const handleDeleteEvidence = async (url: string) => {
    try {
      // TODO: Implement deleteDeliveryEvidence server action
      // This should:
      // 1. Delete file from Supabase Storage
      // 2. Update order.delivery_evidence_urls array

      setEvidence(evidence.filter(e => e !== url))
      toast.success('Evidence deleted')
      router.refresh()
    } catch (error) {
      console.error('Error deleting evidence:', error)
      toast.error('Failed to delete file')
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div>
        <label
          className={`
            relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors
            ${disabled
              ? 'border-gray-700 bg-gray-900/50 cursor-not-allowed'
              : 'border-white/[0.1] bg-bg-overlay hover:border-lime hover:bg-lime/5'
            }
          `}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {uploading ? (
              <>
                <Loader2 className="w-10 h-10 mb-3 text-lime-text animate-spin" />
                <p className="text-sm text-text-secondary">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 mb-3 text-text-secondary" />
                <p className="mb-2 text-sm text-text-secondary">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-text-tertiary">
                  PNG, JPG, MP4, WebM (max 10MB each)
                </p>
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            multiple
            accept="image/png,image/jpeg,image/jpg,video/mp4,video/webm"
            onChange={handleFileUpload}
            disabled={disabled || uploading}
          />
        </label>
      </div>

      {/* Evidence List */}
      {evidence.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white">Uploaded Evidence</h3>
          <div className="grid grid-cols-1 gap-2">
            {evidence.map((url, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-bg-overlay border border-border-subtle rounded-lg"
              >
                <div className="flex-shrink-0">
                  {url.includes('.mp4') || url.includes('.webm') ? (
                    <FileVideo className="w-5 h-5 text-lime-text" />
                  ) : (
                    <FileImage className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    Evidence #{index + 1}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {url.split('/').pop()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-bg-overlay rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  </a>
                  {!disabled && (
                    <button
                      onClick={() => handleDeleteEvidence(url)}
                      className="p-2 hover:bg-bg-overlay rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-error" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
