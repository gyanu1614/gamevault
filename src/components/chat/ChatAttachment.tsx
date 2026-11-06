'use client'

/**
 * One attachment inside a chat bubble. Stored paths (private bucket) are
 * exchanged for a 1-hour signed URL; the storage policy only signs it for
 * the order's buyer, seller or an admin. Legacy/optimistic values that are
 * already URLs render as they are.
 */

import { useEffect, useState } from 'react'
import { FileText, ImageOff, Loader2, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  CHAT_ATTACHMENT_BUCKET,
  isImageAttachment,
  isStoragePath,
  isVideoAttachment,
} from '@/lib/chat/attachments'

function useAttachmentUrl(value: string): { url: string | null; failed: boolean } {
  const needsSigning = isStoragePath(value)
  const [url, setUrl] = useState<string | null>(needsSigning ? null : value)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!needsSigning) {
      setUrl(value)
      return
    }
    let cancelled = false
    createClient()
      .storage.from(CHAT_ATTACHMENT_BUCKET)
      .createSignedUrl(value, 3600)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data?.signedUrl) setFailed(true)
        else setUrl(data.signedUrl)
      })
    return () => {
      cancelled = true
    }
  }, [value, needsSigning])

  return { url, failed }
}

export default function ChatAttachment({ value }: { value: string }) {
  const { url, failed } = useAttachmentUrl(value)
  const isImage = isImageAttachment(value)

  if (failed) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-[12px] text-text-tertiary">
        <ImageOff className="h-4 w-4" aria-hidden />
        Attachment unavailable
      </span>
    )
  }

  if (!url) {
    return (
      <span className="grid h-36 w-[220px] max-w-full place-items-center rounded-lg bg-black/20">
        <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" aria-hidden />
      </span>
    )
  }

  if (isImage) return <ImageThumb url={url} />
  if (isVideoAttachment(value)) return <VideoClip url={url} />

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-[12.5px] font-semibold text-text-primary hover:text-lime-text"
    >
      <FileText className="h-4 w-4 text-lime-text" aria-hidden />
      Open PDF
    </a>
  )
}

/**
 * Plays in the bubble. `#t=0.1` shows a first frame on iPhones, which otherwise draw a
 * blank box. A phone's HEVC file doesn't play in every desktop browser, so one that
 * can't play becomes a link to the file.
 */
function VideoClip({ url }: { url: string }) {
  const [cantPlay, setCantPlay] = useState(false)
  if (cantPlay) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-[12.5px] font-semibold text-text-primary hover:text-lime-text"
      >
        <Video className="h-4 w-4 text-lime-text" aria-hidden />
        Open Video
      </a>
    )
  }
  return (
    <video
      src={`${url}#t=0.1`}
      controls
      playsInline
      preload="metadata"
      onError={() => setCantPlay(true)}
      className="max-h-72 w-[260px] max-w-full rounded-lg bg-black/40"
    />
  )
}

/** A compact thumbnail; clicking it enlarges the photo in place (no new tab
 *  to the storage URL). */
function ImageThumb({ url }: { url: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View photo"
        className="block overflow-hidden rounded-lg bg-black/20 transition-opacity hover:opacity-90"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL */}
        <img src={url} alt="Photo" loading="lazy" className="h-36 w-[220px] max-w-full object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(94vw,960px)] border-white/10 bg-[#0B0D10] p-2 sm:p-3">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL */}
          <img src={url} alt="Photo" className="mx-auto max-h-[80dvh] w-auto max-w-full rounded-md object-contain" />
        </DialogContent>
      </Dialog>
    </>
  )
}
