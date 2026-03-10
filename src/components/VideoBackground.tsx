'use client'

import { useState } from 'react'

export function VideoBackground() {
  const [videoError, setVideoError] = useState(false)

  return (
    <div className="absolute inset-0 z-0">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70 z-10" />

      {/* Video element */}
      {!videoError && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{
            filter: 'blur(4px) brightness(0.5)',
            transform: 'scale(1.05)', // Prevent blur edge artifacts
          }}
          onError={() => setVideoError(true)}
        >
          <source src="/videos/hero-background.mp4" type="video/mp4" />
          <source src="/videos/hero-background.webm" type="video/webm" />
        </video>
      )}

      {/* Fallback gradient background (shown if video fails to load) */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-purple-900/30 to-blue-900/40 -z-10" />
    </div>
  )
}
