/**
 * useImmediateUpload — upload a file to Supabase Storage the moment it is
 * picked, with real progress events.
 *
 * supabase-js `upload()` exposes no progress, so we ask for a signed upload
 * URL and PUT the file with XMLHttpRequest (onprogress). The resolved
 * `UploadedDoc` carries the storage path — the required-field schemas treat
 * a doc as valid ONLY when this path exists, i.e. the upload actually
 * succeeded (not just a local file selection).
 */

'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UploadedDoc } from '../schemas'

export type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

interface UseImmediateUploadOptions {
  /** Storage bucket, e.g. 'kyc-documents' or 'profile-pictures'. */
  bucket: string
  /** File-name prefix inside the user folder, e.g. 'idDocument'. */
  keyPrefix: string
  /** Allowed MIME types. */
  acceptTypes?: string[]
  maxSizeMB?: number
  onUploaded?: (doc: UploadedDoc) => void
  onRemoved?: () => void
}

interface UseImmediateUploadResult {
  status: UploadStatus
  /** 0-100 while uploading. */
  progress: number
  error: string | null
  /** Local object URL for image previews (valid for this mount only). */
  previewUrl: string | null
  upload: (file: File) => Promise<UploadedDoc | null>
  /** Removes the object from storage (best effort) and resets state. */
  remove: (doc?: UploadedDoc | null) => Promise<void>
  reset: () => void
}

const DEFAULT_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

export function useImmediateUpload({
  bucket,
  keyPrefix,
  acceptTypes = DEFAULT_TYPES,
  maxSizeMB = 10,
  onUploaded,
  onRemoved,
}: UseImmediateUploadOptions): UseImmediateUploadResult {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)

  const clearPreview = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }
    setPreviewUrl(null)
  }, [])

  const reset = useCallback(() => {
    clearPreview()
    setStatus('idle')
    setProgress(0)
    setError(null)
  }, [clearPreview])

  const upload = useCallback(
    async (file: File): Promise<UploadedDoc | null> => {
      // Client-side validation before any network work
      if (!acceptTypes.includes(file.type)) {
        setStatus('error')
        setError('Unsupported file type. Use JPG, PNG or PDF.')
        return null
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setStatus('error')
        setError(`File is too large. Maximum size is ${maxSizeMB}MB.`)
        return null
      }

      setStatus('uploading')
      setProgress(0)
      setError(null)

      // Image preview appears immediately, while the upload runs
      clearPreview()
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        previewRef.current = url
        setPreviewUrl(url)
      }

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setStatus('error')
          setError('You must be logged in to upload files.')
          return null
        }

        const ext = file.name.split('.').pop() || 'bin'
        const path = `${user.id}/${keyPrefix}-${Date.now()}.${ext}`

        const { data: signed, error: signError } = await supabase.storage
          .from(bucket)
          .createSignedUploadUrl(path)

        if (signError || !signed?.signedUrl) {
          console.error(`[useImmediateUpload] sign error for ${keyPrefix}:`, signError)
          setStatus('error')
          setError('Could not start the upload. Please try again.')
          return null
        }

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', signed.signedUrl)
          xhr.setRequestHeader('content-type', file.type)
          xhr.setRequestHeader('x-upsert', 'false')
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100))
            }
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve()
            else reject(new Error(`Upload failed with status ${xhr.status}`))
          }
          xhr.onerror = () => reject(new Error('Network error during upload'))
          xhr.send(file)
        })

        const doc: UploadedDoc = {
          path,
          name: file.name,
          size: file.size,
          type: file.type,
        }
        setProgress(100)
        setStatus('done')
        onUploaded?.(doc)
        return doc
      } catch (err) {
        console.error(`[useImmediateUpload] upload error for ${keyPrefix}:`, err)
        setStatus('error')
        setError('Upload failed. Check your connection and try again.')
        return null
      }
    },
    [acceptTypes, bucket, clearPreview, keyPrefix, maxSizeMB, onUploaded]
  )

  const remove = useCallback(
    async (doc?: UploadedDoc | null) => {
      // Best effort — never block the user on a failed storage delete;
      // replacement files always get a fresh timestamped path anyway.
      if (doc?.path) {
        try {
          const supabase = createClient()
          await supabase.storage.from(bucket).remove([doc.path])
        } catch (err) {
          console.error(`[useImmediateUpload] remove error for ${keyPrefix}:`, err)
        }
      }
      reset()
      onRemoved?.()
    },
    [bucket, keyPrefix, onRemoved, reset]
  )

  return { status, progress, error, previewUrl, upload, remove, reset }
}
