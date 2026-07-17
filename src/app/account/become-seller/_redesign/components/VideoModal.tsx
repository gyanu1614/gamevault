/**
 * VideoModal — a centered dialog with a 16:9 video frame for "watch how it
 * works". VIDEO_URL is null for now (the user supplies the mp4 later): when
 * null we render a graceful "Video coming soon" poster state instead of a
 * broken <video>. Wire a real URL into VIDEO_URL and the <video> lights up with
 * no other change. Light-world styling to match the shell.
 *
 * Entrance is CSS (animate-fade-in / animate-fade-up), deliberately NOT
 * framer-motion: rAF can stall in embedded/throttled contexts and freeze the
 * dialog mid-fade (same failure the navbar dropdowns hit). CSS always runs.
 */

'use client'

import { useEffect } from 'react'
import { X, PlayCircle } from 'lucide-react'
import { PALETTE } from '../theme'

/** The explainer video source. null until the user supplies the mp4. */
export const VIDEO_URL: string | null = null
/** Optional poster frame shown before playback (also used behind the fallback). */
export const VIDEO_POSTER: string | null = null

interface VideoModalProps {
  open: boolean
  onClose: () => void
}

export default function VideoModal({ open, onClose }: VideoModalProps) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How selling works"
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close video"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ backgroundColor: 'rgba(15,51,32,0.55)', backdropFilter: 'blur(4px)' }}
      />

      <div
        className="animate-fade-up relative w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: PALETTE.paper }}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-semibold" style={{ color: PALETTE.forest }}>
            How Selling Works
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 transition-colors hover:bg-black/5"
            style={{ color: PALETTE.ink2 }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 16:9 frame */}
        <div className="relative aspect-video w-full" style={{ backgroundColor: PALETTE.forest3 }}>
          {VIDEO_URL ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={VIDEO_URL}
              poster={VIDEO_POSTER ?? undefined}
              controls
              className="h-full w-full"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <PlayCircle className="h-12 w-12" style={{ color: PALETTE.lime }} />
              <div>
                <p className="text-sm font-semibold text-white">Video Coming Soon</p>
                <p className="mt-1 text-xs text-white/60">
                  A short walkthrough of how selling works is on its way.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
