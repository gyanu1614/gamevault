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
}

export const AvatarUpload = ({ onChange, username, defaultAvatar }: AvatarUploadProps) => {
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
    <div className="flex flex-col items-center gap-3">
      <div {...getRootProps()}>
        <motion.div
          onClick={handleClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'relative h-24 w-24 cursor-pointer rounded-full border-2 transition-all',
            isDragActive
              ? 'border-primary bg-primary/10'
              : 'border-white/20 bg-white/5 hover:border-primary/50'
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
              <User className="h-10 w-10 text-gray-400" />
            </div>
          )}

          {/* Upload Overlay */}
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity hover:opacity-100">
            <Upload className="h-6 w-6 text-white" />
          </div>

          {/* Remove Button */}
          {file && (
            <button
              onClick={handleRemove}
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-white">Profile Picture</p>
        <p className="text-xs text-gray-400">
          {file ? file.name : 'Click or drag to upload'}
        </p>
      </div>
    </div>
  )
}
