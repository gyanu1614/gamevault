/**
 * FileUploadBox — compact immediate-upload box.
 *
 * The file uploads to Supabase Storage the moment it is picked:
 * progress bar while uploading, thumbnail preview + uploaded tick when done,
 * retry on error. The parent receives an `UploadedDoc` (with storage path)
 * ONLY after the upload actually succeeded — required-field validation keys
 * off that path.
 */

'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Upload, FileText, X, Check, Loader2, RotateCcw, Eye } from 'lucide-react'

import { useImmediateUpload } from '../../hooks/useImmediateUpload'
import type { UploadedDoc } from '../../schemas'

interface FileUploadBoxProps {
  label: string
  description: string
  fileType: string
  doc: UploadedDoc | null
  onDocChange: (fileType: string, doc: UploadedDoc | null) => void
  bucket?: string
  required?: boolean
  /** JPG/PNG only, 5MB max (used for the Store Image). */
  imageOnly?: boolean
  /** External validation error (e.g. required doc missing on Continue). */
  error?: string
  sampleImage?: string
  sampleText?: string
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function FileUploadBox({
  label,
  description,
  fileType,
  doc,
  onDocChange,
  bucket = 'kyc-documents',
  required = false,
  imageOnly = false,
  error,
  sampleImage,
  sampleText,
}: FileUploadBoxProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [showExample, setShowExample] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    status,
    progress,
    error: uploadError,
    previewUrl,
    upload,
    remove,
  } = useImmediateUpload({
    bucket,
    keyPrefix: fileType,
    acceptTypes: imageOnly ? ['image/jpeg', 'image/png'] : undefined,
    maxSizeMB: imageOnly ? 5 : 10,
    onUploaded: (uploaded) => onDocChange(fileType, uploaded),
    onRemoved: () => onDocChange(fileType, null),
  })

  const handleFile = (file: File | undefined) => {
    if (!file) return
    void upload(file)
  }

  const openPicker = () => inputRef.current?.click()

  const isUploading = status === 'uploading'
  const hasDoc = !!doc && status !== 'uploading'
  const showError = error || (status === 'error' ? uploadError : null)

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-xs font-medium text-white sm:text-sm">
          {label} {required && <span className="text-error">*</span>}
        </label>
        {sampleImage && (
          <button
            type="button"
            onClick={() => setShowExample((v) => !v)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-white sm:text-xs"
          >
            <Eye className="h-3 w-3" />
            {showExample ? 'Hide Example' : 'View Example'}
          </button>
        )}
      </div>
      <p className="mb-2 text-[10px] text-text-secondary sm:text-xs">{description}</p>

      {/* Example popover (collapsible) */}
      {sampleImage && showExample && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-overlay p-2.5">
          <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-md border border-border-subtle bg-black/40">
            <Image src={sampleImage} alt={sampleText || 'Example document'} fill className="object-contain" unoptimized />
          </div>
          <p className="text-[10px] text-text-secondary sm:text-xs">
            {sampleText || 'Reference example'} — your document should look similar.
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={imageOnly ? '.jpg,.jpeg,.png' : '.jpg,.jpeg,.png,.pdf'}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {isUploading ? (
        /* Uploading state — progress bar */
        <div className="rounded-lg border border-border-default bg-bg-overlay p-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-lime-text" />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-white">Uploading…</span>
                <span className="flex-shrink-0 text-[10px] font-medium text-lime-text">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-lime transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : hasDoc ? (
        /* Uploaded state — preview + tick */
        <div className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-overlay p-3">
          {previewUrl ? (
            <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-md border border-border-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-white/5">
              <FileText className="h-5 w-5 text-text-secondary" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white sm:text-sm">{doc.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-text-secondary sm:text-xs">
              <span>{formatFileSize(doc.size)}</span>
              <span className="inline-flex items-center gap-1 text-lime-text">
                <Check className="h-3 w-3" strokeWidth={3} />
                Uploaded
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void remove(doc)}
            aria-label={`Remove ${label}`}
            className="flex-shrink-0 rounded-md p-1.5 text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : status === 'error' ? (
        /* Error state — retry */
        <button
          type="button"
          onClick={openPicker}
          className="flex w-full items-center gap-3 rounded-lg border border-error bg-error-bg p-3 text-left transition-colors hover:bg-error-bg/80"
        >
          <RotateCcw className="h-4 w-4 flex-shrink-0 text-error" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-error sm:text-sm">{uploadError || 'Upload failed'}</p>
            <p className="mt-0.5 text-[10px] text-text-secondary sm:text-xs">Click to try again</p>
          </div>
        </button>
      ) : (
        /* Idle state — compact dropzone */
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setIsDragging(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            handleFile(e.dataTransfer.files[0])
          }}
          onClick={openPicker}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openPicker()
            }
          }}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 transition-colors ${
            isDragging
              ? 'border-lime-tint-border bg-white/[0.06]'
              : 'border-white/20 bg-white/[0.02] hover:border-white/40 hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-white/5">
            <Upload className="h-4 w-4 text-text-secondary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white sm:text-sm">
              {isDragging ? 'Drop To Upload' : (
                <>
                  Drop your file here or <span className="text-lime-text">browse</span>
                </>
              )}
            </p>
            <p className="mt-0.5 text-[10px] text-text-tertiary sm:text-xs">
              {imageOnly ? 'JPG or PNG (max 5MB)' : 'JPG, PNG or PDF (max 10MB)'} — uploads instantly
            </p>
          </div>
        </div>
      )}

      {showError && <p className="mt-1.5 text-xs text-error">{showError}</p>}
    </div>
  )
}
