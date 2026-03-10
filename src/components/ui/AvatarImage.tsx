'use client'

import { useState } from 'react'
import Image from 'next/image'
import { generateInitialsAvatar } from '@/lib/utils/avatar-fallback'

interface AvatarImageProps {
  src: string | null | undefined
  alt: string
  username: string
  width: number
  height: number
  className?: string
  unoptimized?: boolean
}

/**
 * Avatar Image component with automatic fallback to initials
 * Handles DiceBear API failures gracefully
 */
export function AvatarImage({
  src,
  alt,
  username,
  width,
  height,
  className = '',
  unoptimized = true,
}: AvatarImageProps) {
  const [imgSrc, setImgSrc] = useState(src || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`)
  const [hasError, setHasError] = useState(false)

  const handleError = () => {
    if (!hasError) {
      // Fallback to initials avatar
      setImgSrc(generateInitialsAvatar(username))
      setHasError(true)
    }
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={handleError}
      unoptimized={unoptimized}
    />
  )
}
