/**
 * SubmissionLoader Component
 *
 * Fancy gaming-themed full-screen loader shown during application submission
 * Features:
 * - Animated progress bar
 * - File upload counter
 * - Particle effects
 * - Gamey neon styling
 */

'use client'

import { motion } from 'framer-motion'
import { Loader2, Upload, CheckCircle2, Rocket } from 'lucide-react'

interface SubmissionLoaderProps {
  currentFile: number
  totalFiles: number
  stage: 'uploading' | 'submitting' | 'complete'
  message?: string
}

export default function SubmissionLoader({
  currentFile,
  totalFiles,
  stage,
  message = 'Processing your application...'
}: SubmissionLoaderProps) {
  const progress = totalFiles > 0 ? (currentFile / totalFiles) * 100 : 0

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop Blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-lg"
      />

      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-lime/30"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              scale: [1, 1.5, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Main Loader Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-lg mx-4"
      >
        {/* Glow Effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-lime/20 via-indigo-500/20 to-purple-500/20 blur-2xl" />

        {/* Card */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl">
          {/* Animated Border Gradient */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-lime/0 via-violet-500/50 to-lime/0 opacity-50">
            <motion.div
              className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          {/* Content */}
          <div className="relative p-8 sm:p-10">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                {/* Pulsing Glow */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-lime/30 blur-xl"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />

                {/* Icon Container */}
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-lime to-indigo-500">
                  {stage === 'uploading' && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Upload className="h-10 w-10 text-white" />
                    </motion.div>
                  )}
                  {stage === 'submitting' && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 className="h-10 w-10 text-white" />
                    </motion.div>
                  )}
                  {stage === 'complete' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', duration: 0.5 }}
                    >
                      <CheckCircle2 className="h-10 w-10 text-white" />
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Title */}
            <motion.h2
              className="text-center text-2xl font-bold text-white mb-3"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {stage === 'uploading' && '🎮 Uploading Files'}
              {stage === 'submitting' && '🚀 Submitting Application'}
              {stage === 'complete' && '✅ Complete!'}
            </motion.h2>

            {/* Message */}
            <p className="text-center text-text-secondary mb-6 text-sm">
              {message}
            </p>

            {/* Upload Progress */}
            {stage === 'uploading' && totalFiles > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-text-secondary">Files</span>
                  <span className="font-medium text-lime-text">
                    {currentFile} / {totalFiles}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-lime via-indigo-500 to-purple-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  >
                    {/* Shine Effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    />
                  </motion.div>
                </div>
              </div>
            )}

            {/* Loading Animation Dots */}
            <div className="flex items-center justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-2 w-2 rounded-full bg-violet-400"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>

            {/* Fun Gaming Message */}
            <motion.div
              className="mt-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-xs text-text-tertiary flex items-center justify-center gap-2">
                <Rocket className="h-3 w-3" />
                <span>Leveling up your seller profile...</span>
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
