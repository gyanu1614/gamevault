'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export const LayoutTextFlip = ({
  text = 'Build Amazing',
  words = ['Landing Pages', 'Component Blocks', 'Page Sections', '3D Shaders'],
  duration = 3000,
}: {
  text: string
  words: string[]
  duration?: number
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length)
    }, duration)

    return () => clearInterval(interval)
  }, [duration, words.length])

  return (
    <>
      <motion.span
        layoutId="subtext"
        className="text-xl font-bold tracking-tight md:text-2xl lg:text-3xl"
      >
        {text}
      </motion.span>

      <motion.span
        layout
        className="relative w-fit overflow-hidden rounded-xl border-2 border-white/30 bg-gradient-to-br from-white/10 to-white/5 px-4 py-2 font-sans text-xl font-black tracking-tight text-white shadow-[0_0_20px_rgba(255,255,255,0.2)] backdrop-blur-md md:px-5 md:py-2.5 md:text-2xl lg:text-3xl"
        style={{
          boxShadow: '0 0 20px rgba(255,255,255,0.15), inset 0 0 15px rgba(255,255,255,0.08)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 animate-pulse" />
        <AnimatePresence mode="popLayout">
          <motion.span
            key={currentIndex}
            initial={{ y: -40, filter: 'blur(10px)' }}
            animate={{ y: 0, filter: 'blur(0px)' }}
            exit={{ y: 50, filter: 'blur(10px)', opacity: 0 }}
            transition={{ duration: 0.4 }}
            className={cn('relative inline-block whitespace-nowrap z-10')}
          >
            {words[currentIndex]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </>
  )
}
