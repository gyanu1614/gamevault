/**
 * SubmissionLoader Component
 *
 * Full-screen loader shown while the application record is submitted.
 * Documents are already uploaded at pick time, so there are only two
 * stages: submitting → complete. Lime-on-dark per the design system.
 */

'use client'

import { motion } from 'framer-motion'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface SubmissionLoaderProps {
  stage: 'submitting' | 'complete'
  message?: string
}

export default function SubmissionLoader({ stage, message }: SubmissionLoaderProps) {
  const text =
    message ??
    (stage === 'complete'
      ? 'All set — taking you to your application status.'
      : 'Sending your application for review…')

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop Blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-lg"
      />

      {/* Loader Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative z-10 mx-4 w-full max-w-sm"
      >
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/90 shadow-2xl backdrop-blur-xl">
          <div className="relative p-7 sm:p-8">
            {/* Icon */}
            <div className="mb-5 flex justify-center">
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-full bg-lime/20 blur-xl"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-lime">
                  {stage === 'submitting' ? (
                    <Loader2 className="h-7 w-7 animate-spin text-black" />
                  ) : (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', duration: 0.5 }}
                    >
                      <CheckCircle2 className="h-7 w-7 text-black" />
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="mb-2 text-center text-lg font-bold text-white sm:text-xl">
              {stage === 'submitting' ? 'Submitting Application' : 'Application Received'}
            </h2>

            {/* Message */}
            <p className="mb-5 text-center text-sm text-text-secondary">{text}</p>

            {/* Loading Dots */}
            <div className="flex items-center justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-lime"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.4, 1, 0.4],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
