'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * The gallery's hero image. A photo at least as big as the frame fills it
 * (object-cover, as before). A smaller one — a 256px game icon the bulk
 * importer copied, say — is drawn at its own size, centred, instead of being
 * stretched to 360 CSS px (720 device px on a retina screen), which is what
 * made imported pets look soft. It stays hidden until decoded so it never
 * flashes at the wrong size; `complete` covers an image that finished loading
 * before hydration (React never sees that onLoad).
 */
const HERO_FRAME_PX = 360

export default function HeroImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null)
  const [fit, setFit] = useState<'pending' | 'fill' | 'native'>('pending')
  const measure = (img: HTMLImageElement) => {
    const longEdge = Math.max(img.naturalWidth, img.naturalHeight)
    setFit(longEdge > 0 && longEdge < HERO_FRAME_PX ? 'native' : 'fill')
  }
  useEffect(() => {
    const img = ref.current
    if (img?.complete && img.naturalWidth > 0) measure(img)
  }, [])
  return (
    <motion.img
      ref={ref}
      src={src}
      alt={alt}
      onLoad={(e) => measure(e.currentTarget)}
      onError={() => setFit('fill')}
      initial={{ opacity: 0 }}
      animate={{ opacity: fit === 'pending' ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className={
        fit === 'native'
          ? 'absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full'
          : 'absolute inset-0 h-full w-full rounded-lg object-cover'
      }
    />
  )
}
