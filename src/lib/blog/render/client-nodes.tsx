'use client'

/**
 * The two blocks that need the browser: copying a code, and loading a
 * YouTube video only when the reader asks (no iframe, no third-party JS on
 * page load — the thumbnail is a plain image).
 */
import { useState } from 'react'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import CheckRounded from '@mui/icons-material/CheckRounded'
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded'

export function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(code).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
      aria-label={done ? `Copied ${code}` : `Copy ${code}`}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[7px] bg-white/[0.06] px-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-white/[0.1] hover:text-text-primary"
    >
      {done ? <CheckRounded aria-hidden sx={{ fontSize: 16 }} /> : <ContentCopyRounded aria-hidden sx={{ fontSize: 15 }} />}
      {/* Announced when it flips to "Copied" (the label alone changes silently). */}
      <span aria-live="polite">{done ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

export function YouTubeLite({ id, title }: { id: string; title: string }) {
  const [play, setPlay] = useState(false)
  const label = title || 'Watch the video'
  if (play) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`}
        title={label}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-[10px] border-0"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setPlay(true)}
      aria-label={`Play: ${label}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-[10px] bg-black"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        width={480}
        height={360}
        className="h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
      />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-black/70 text-white">
          <PlayArrowRounded aria-hidden sx={{ fontSize: 34 }} />
        </span>
      </span>
    </button>
  )
}
