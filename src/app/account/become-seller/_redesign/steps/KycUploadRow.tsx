/**
 * KycUploadRow — the light "Forest Ledger" upload affordance for a single KYC
 * document. Reuses the shared `useImmediateUpload` hook, so the file uploads to
 * Supabase Storage the moment it is picked and the parent only receives an
 * `UploadedDoc` (carrying the storage `path`) once the upload actually
 * succeeded. Required-field validation keys off that path — never a local pick.
 *
 * Visually this is the light counterpart of the dark `FileUploadBox`: ivory
 * surfaces, forest text, hairline borders, a green focus/hover, and lime
 * reserved for the "uploaded" checkmark + the progress fill.
 */

'use client'

import { useRef, useState } from 'react'
import { Upload, FileText, X, Check, Loader2, RotateCcw } from 'lucide-react'

import { useImmediateUpload } from '../../hooks/useImmediateUpload'
import type { UploadedDoc } from '../../schemas'
import { PALETTE } from '../theme'

interface KycUploadRowProps {
  label: string
  description: string
  fileType: string
  doc: UploadedDoc | null
  onDocChange: (fileType: string, doc: UploadedDoc | null) => void
  bucket?: string
  required?: boolean
  /** Greyed-out completed state — e.g. covered by Didit video verification. */
  disabled?: boolean
  /** External validation error (e.g. required doc missing on Continue). */
  error?: string
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function KycUploadRow({
  label,
  description,
  fileType,
  doc,
  onDocChange,
  bucket = 'kyc-documents',
  required = false,
  disabled = false,
  error,
}: KycUploadRowProps) {
  const [isDragging, setIsDragging] = useState(false)
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
    <div
      className={disabled ? 'pointer-events-none select-none opacity-45 grayscale' : undefined}
      aria-disabled={disabled || undefined}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="block text-sm font-medium" style={{ color: PALETTE.ink }}>
          {label}{' '}
          {required && (
            <span style={{ color: PALETTE.forest2 }} aria-hidden>
              *
            </span>
          )}
        </label>
      </div>
      <p className="mb-2 text-xs" style={{ color: PALETTE.ink2 }}>
        {description}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {isUploading ? (
        /* Uploading — progress bar */
        <div
          className="rounded-xl border p-3.5"
          style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.paper }}
        >
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: PALETTE.forest2 }} />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs" style={{ color: PALETTE.ink }}>
                  Uploading…
                </span>
                <span className="shrink-0 text-[11px] font-semibold" style={{ color: PALETTE.forest2 }}>
                  {progress}%
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ backgroundColor: 'rgba(20,67,42,0.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${progress}%`, backgroundColor: PALETTE.lime }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : hasDoc ? (
        /* Uploaded — preview + lime tick */
        <div
          className="flex items-center gap-3 rounded-xl border p-3.5"
          style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.paper }}
        >
          {previewUrl ? (
            <div
              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border"
              style={{ borderColor: PALETTE.line }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'rgba(20,67,42,0.06)' }}
            >
              <FileText className="h-5 w-5" style={{ color: PALETTE.forest2 }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" style={{ color: PALETTE.ink }}>
              {doc.name}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: PALETTE.ink2 }}>
              <span>{formatFileSize(doc.size)}</span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium"
                style={{ backgroundColor: 'rgba(20,67,42,0.08)', color: PALETTE.forest }}
              >
                <Check className="h-3 w-3" strokeWidth={3} style={{ color: PALETTE.forest2 }} />
                Uploaded
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void remove(doc)}
            aria-label={`Remove ${label}`}
            className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-black/5"
            style={{ color: PALETTE.ink2 }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : status === 'error' ? (
        /* Error — retry */
        <button
          type="button"
          onClick={openPicker}
          className="flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors"
          style={{ borderColor: '#D9534F', backgroundColor: 'rgba(217,83,79,0.05)' }}
        >
          <RotateCcw className="h-4 w-4 shrink-0" style={{ color: '#B23B37' }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" style={{ color: '#B23B37' }}>
              {uploadError || 'Upload failed'}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: PALETTE.ink2 }}>
              Tap to try again
            </p>
          </div>
        </button>
      ) : (
        /* Idle — dropzone */
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
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3.5 transition-colors"
          style={{
            borderColor: isDragging ? PALETTE.forest2 : PALETTE.line,
            backgroundColor: isDragging ? 'rgba(20,67,42,0.04)' : PALETTE.paper,
          }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'rgba(20,67,42,0.06)' }}
          >
            <Upload className="h-4 w-4" style={{ color: PALETTE.forest2 }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" style={{ color: PALETTE.ink }}>
              {isDragging ? (
                'Drop To Upload'
              ) : (
                <>
                  Drop Your File Here Or{' '}
                  <span style={{ color: PALETTE.forest2 }}>Browse</span>
                </>
              )}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: PALETTE.ink2 }}>
              JPG, PNG Or PDF (Max 10MB) — Uploads Instantly
            </p>
          </div>
        </div>
      )}

      {showError && (
        <p className="mt-1.5 text-xs" style={{ color: '#B23B37' }}>
          {showError}
        </p>
      )}
    </div>
  )
}
