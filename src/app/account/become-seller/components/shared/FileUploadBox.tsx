/**
 * FileUploadBox Component
 *
 * A reusable file upload component with drag-and-drop support,
 * grid background pattern, and sample image display.
 *
 * Features:
 * - Drag and drop support
 * - File type validation (JPG, PNG, PDF)
 * - Size validation (max 10MB)
 * - Grid pattern background (Aceternity UI style)
 * - Sample image with hover effects
 * - File preview with remove option
 */

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Upload, File, X } from 'lucide-react'

interface FileUploadBoxProps {
  label: string
  description: string
  fileType: string
  uploadedFile: File | null
  onFileUpload: (fileType: string, file: File | null) => void
  required?: boolean
  sampleImage?: string
  sampleText?: string
}

export default function FileUploadBox({
  label,
  description,
  fileType,
  uploadedFile,
  onFileUpload,
  required = false,
  sampleImage,
  sampleText,
}: FileUploadBoxProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && isValidFile(file)) {
      onFileUpload(fileType, file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && isValidFile(file)) {
      onFileUpload(fileType, file)
    }
  }

  const isValidFile = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf']
    const maxSize = 10 * 1024 * 1024 // 10MB
    return validTypes.includes(file.type) && file.size <= maxSize
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <p className="mb-3 text-[10px] text-text-secondary sm:mb-4 sm:text-xs">{description}</p>

      {!uploadedFile ? (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-[1fr,200px] lg:grid-cols-[1fr,240px]">
          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all ${
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-white/20 bg-gradient-to-br from-white/[0.05] to-white/[0.02] hover:border-primary/50'
            }`}
          >
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileChange}
              className="absolute inset-0 z-10 cursor-pointer opacity-0"
            />

            {/* Grid Background */}
            <div className="pointer-events-none absolute inset-0 opacity-30">
              <div className="grid h-full w-full grid-cols-10 grid-rows-5 sm:grid-cols-12 sm:grid-rows-6">
                {Array.from({ length: 72 }).map((_, i) => (
                  <div
                    key={i}
                    className={`border border-white/5 ${
                      i % 3 === 0 ? 'bg-bg-overlay shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]' : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="relative flex min-h-[160px] flex-col items-center justify-center gap-2.5 pb-3 pt-16 sm:min-h-[170px] sm:gap-3 sm:pb-4 sm:pt-20">
              <motion.div
                animate={isDragging ? { y: -10, x: 10 } : { y: 0, x: 0 }}
                transition={{ duration: 0.3 }}
                className={`rounded-full p-2.5 transition-all sm:p-3 ${
                  isDragging ? 'bg-primary/20 shadow-lg shadow-primary/20' : 'bg-white/5 group-hover:bg-primary/10'
                }`}
              >
                <Upload
                  className={`h-6 w-6 transition-all sm:h-7 sm:w-7 ${
                    isDragging ? 'text-primary' : 'text-text-secondary group-hover:text-primary'
                  }`}
                />
              </motion.div>
              <div className="text-center">
                <p className="text-sm font-medium text-white sm:text-base">
                  {isDragging ? (
                    'Drop it!'
                  ) : (
                    <>
                      Drop your file here or <span className="text-primary">browse</span>
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-text-tertiary sm:mt-1 sm:text-xs">JPG, PNG or PDF (max 10MB)</p>
              </div>
            </div>
          </div>

          {/* Sample Image on Right */}
          {sampleImage && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3 shadow-lg sm:p-4"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative">
                <div className="mb-2 flex items-center gap-1.5 sm:mb-3">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/80 sm:text-xs">
                    Example
                  </span>
                </div>

                <div className="relative mb-2 overflow-hidden rounded-lg border border-primary/30 bg-black/40 sm:mb-3">
                  <Image
                    src={sampleImage}
                    alt={sampleText || 'Sample document'}
                    width={240}
                    height={160}
                    className="h-auto w-full object-contain"
                    unoptimized
                  />
                  {/* Scanline effect */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent opacity-50" />
                </div>

                <div>
                  <p className="text-xs font-medium text-white sm:text-sm">
                    {sampleText || 'Reference example'}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-text-secondary sm:text-xs">
                    Your document should look similar
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-4 shadow-lg backdrop-blur-sm sm:gap-4 sm:p-5">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 shadow-inner sm:h-14 sm:w-14">
            <File className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white sm:text-base">{uploadedFile.name}</p>
            <p className="mt-0.5 text-xs text-text-secondary sm:text-sm">{formatFileSize(uploadedFile.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onFileUpload(fileType, null)}
            className="flex-shrink-0 rounded-lg p-2 transition-all hover:bg-error-bg sm:p-2.5"
          >
            <X className="h-5 w-5 text-error sm:h-6 sm:w-6" />
          </button>
        </div>
      )}
    </div>
  )
}
