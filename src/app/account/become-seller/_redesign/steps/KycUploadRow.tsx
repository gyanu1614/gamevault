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
import Image from 'next/image'
import { Upload, FileText, X, Check, Loader2, RotateCcw, HelpCircle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useImmediateUpload } from '../../hooks/useImmediateUpload'
import type { UploadedDoc } from '../../schemas'
import { PALETTE } from '../theme'

/** A "See sample" helper shown next to a doc's label — opens a small dialog
 *  with a picture + do/don't tips so the seller knows exactly what to upload. */
export interface DocSample {
  title: string
  /** Optional image in /public showing a good example of the document. */
  imageSrc?: string
  tips: string[]
}

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
  /** When set, shows a "See sample" link that opens a helper dialog. */
  sample?: DocSample
}

/** Compact drawn "sample document" — a little page with a letterhead, the
 *  name/address block highlighted, body lines, and a date stamp. Used when a
 *  sample has no real image. Pure SVG, matches the Forest Ledger palette. */
function SampleDocGraphic() {
  return (
    <svg width="150" height="120" viewBox="0 0 150 120" aria-hidden="true">
      {/* page + fold */}
      <rect x="25" y="4" width="100" height="112" rx="5" fill="#FFFFFF" stroke={PALETTE.line} strokeWidth="1.5" />
      {/* letterhead */}
      <rect x="34" y="14" width="26" height="7" rx="2" fill={PALETTE.forest2} opacity="0.85" />
      <rect x="96" y="14" width="20" height="5" rx="2" fill="#D9DCD0" />
      {/* highlighted name + address block */}
      <rect x="32" y="30" width="62" height="20" rx="3" fill="#EFF6EA" stroke="#BFD9A8" strokeWidth="1" />
      <rect x="37" y="35" width="40" height="4" rx="2" fill={PALETTE.forest} opacity="0.75" />
      <rect x="37" y="42" width="50" height="4" rx="2" fill={PALETTE.forest} opacity="0.45" />
      {/* body lines */}
      <rect x="34" y="60" width="82" height="4" rx="2" fill="#E3E5DB" />
      <rect x="34" y="69" width="72" height="4" rx="2" fill="#E3E5DB" />
      <rect x="34" y="78" width="78" height="4" rx="2" fill="#E3E5DB" />
      <rect x="34" y="87" width="56" height="4" rx="2" fill="#E3E5DB" />
      {/* date stamp */}
      <rect x="88" y="96" width="28" height="12" rx="3" fill="none" stroke={PALETTE.forest2} strokeWidth="1.2" opacity="0.7" />
      <rect x="92" y="100" width="20" height="4" rx="2" fill={PALETTE.forest2} opacity="0.55" />
    </svg>
  )
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
  sample,
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
        {sample && (
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold transition-opacity hover:opacity-80"
                style={{ color: '#2C6BB0' }}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                See sample
              </button>
            </DialogTrigger>
            <DialogContent
              className="max-w-sm rounded-lg border p-6 sm:rounded-lg [&>button]:text-current"
              style={{ backgroundColor: '#FFFFFF', borderColor: PALETTE.line, color: PALETTE.ink }}
            >
              <DialogHeader className="text-left">
                <DialogTitle style={{ color: PALETTE.ink }}>{sample.title}</DialogTitle>
                <DialogDescription style={{ color: PALETTE.ink2 }}>
                  Here&rsquo;s what a good upload looks like.
                </DialogDescription>
              </DialogHeader>

              {/* Small sample-document illustration */}
              <div
                className="mx-auto my-1 flex items-center justify-center rounded-lg border px-6 py-4"
                style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.ivory }}
              >
                {sample.imageSrc ? (
                  <Image
                    src={sample.imageSrc}
                    alt={`${sample.title} sample`}
                    width={200}
                    height={130}
                    className="h-auto max-h-[130px] w-auto object-contain"
                  />
                ) : (
                  <SampleDocGraphic />
                )}
              </div>

              <ul className="mt-1 space-y-2">
                {sample.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: PALETTE.ink2 }}>
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: PALETTE.forest2 }} strokeWidth={2.5} />
                    {tip}
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {description && (
        <p className="mb-2 text-xs" style={{ color: PALETTE.ink2 }}>
          {description}
        </p>
      )}

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
          className="rounded-lg border p-3.5"
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
          className="flex items-center gap-3 rounded-lg border p-3.5"
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
            className="-m-2 shrink-0 rounded-lg p-3.5 transition-colors hover:bg-black/5"
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
          className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors"
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
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3.5 transition-colors"
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
