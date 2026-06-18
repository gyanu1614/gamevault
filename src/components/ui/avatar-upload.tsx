'use client'

import { cn } from '@/lib/utils'
import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, X, User } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { createAvatar } from '@dicebear/core'
import { avataaars } from '@dicebear/collection'

interface AvatarUploadProps {
  onChange?: (file: File | null) => void
  username?: string
  defaultAvatar?: string
  /** 'sm' = 80px (modal/compact), 'md' = 128px (full page default). */
  size?: 'sm' | 'md'
}

export const AvatarUpload = ({ onChange, username, defaultAvatar, size = 'md' }: AvatarUploadProps) => {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(defaultAvatar || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generate random avatar using DiceBear
  const getRandomAvatar = () => {
    if (!username) return null
    const avatar = createAvatar(avataaars, {
      seed: username,
      size: 128,
    })
    return avatar.toDataUri()
  }

  const handleFileChange = (newFiles: File[]) => {
    if (newFiles.length === 0) return

    const selectedFile = newFiles[0]

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    setFile(selectedFile)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)

    onChange?.(selectedFile)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFile(null)
    setPreview(null)
    onChange?.(null)
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const { getRootProps, isDragActive } = useDropzone({
    multiple: false,
    noClick: true,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    onDrop: handleFileChange,
  })

  const displayAvatar = preview || getRandomAvatar()

  return (
    // V17d — sm variant lays the avatar + upload button on one row
    // so the modal saves a chunk of vertical height. md keeps the
    // original stacked layout.
    <div
      className={cn(
        size === 'sm'
          ? 'flex flex-row items-center gap-4'
          : 'flex flex-col items-center gap-3',
      )}
    >
      <div {...getRootProps()}>
        <motion.div
          onClick={handleClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'relative cursor-pointer rounded-full border-4 transition-all',
            // V17c — sm variant for the auth modal where vertical space
            // is tight; the original 128px size was overflowing the panel.
            size === 'sm' ? 'h-20 w-20 border-[3px]' : 'h-32 w-32',
            isDragActive
              ? 'border-white bg-white/10'
              : file
                ? 'border-white/40 bg-white/5 hover:border-white/60'
                : 'border-white/20 bg-white/5 hover:border-white/40'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
            className="hidden"
          />

          {/* Avatar Preview */}
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt="Avatar"
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User
                className={cn(
                  'text-text-secondary',
                  size === 'sm' ? 'h-8 w-8' : 'h-14 w-14',
                )}
              />
            </div>
          )}

          {/* Upload Overlay */}
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity hover:opacity-100">
            <Upload className={cn('text-white', size === 'sm' ? 'h-5 w-5' : 'h-8 w-8')} />
          </div>

          {/* Remove Button */}
          {file && (
            <button
              onClick={handleRemove}
              className={cn(
                'absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg',
                size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
              )}
            >
              <X className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
            </button>
          )}
        </motion.div>
      </div>

      {/* Prominent Upload Button */}
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'flex items-center gap-2 rounded-lg bg-white font-medium text-black transition-all hover:bg-white/90 hover:shadow-lg',
          size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        )}
      >
        <Upload className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        {file ? 'Change' : 'Upload picture'}
      </button>

      {/* Compact mode skips the helper line — the modal needs every
          row of vertical space we can give it. */}
      {size !== 'sm' && (
        <div className="text-center">
          <p className="text-xs text-text-secondary">
            {file ? `✓ ${file.name}` : 'PNG, JPG or GIF (max 5MB)'}
          </p>
        </div>
      )}
    </div>
  )
}
