'use client'

/**
 * One attachment inside a chat bubble. Stored paths (private bucket) are
 * exchanged for a 1-hour signed URL; the storage policy only signs it for
 * the order's buyer, seller or an admin. Legacy/optimistic values that are
 * already URLs render as they are.
 */

import { useEffect, useState } from 'react'
import { FileText, ImageOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CHAT_ATTACHMENT_BUCKET,
  isImageAttachment,
  isStoragePath,
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
      <span className="grid aspect-video w-full min-w-[180px] place-items-center rounded-lg bg-black/20">
        <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" aria-hidden />
      </span>
    )
  }

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL */}
        <img
          src={url}
          alt="Attachment"
          loading="lazy"
          className="max-h-64 w-full min-w-[180px] rounded-lg bg-black/20 object-cover"
        />
      </a>
    )
  }

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
