'use client'

/**
 * DeliveryEvidence — V21/P6
 *
 * Reads from `order.delivery_evidence_urls` (string[]) and renders a
 * 2-up grid (buyer view) or 3-up grid (admin). Each thumbnail opens
 * full-size in a lightweight in-page lightbox with keyboard nav. We
 * don't pull in a heavyweight lightbox dep — this is ~80 LOC.
 *
 * Empty: returns null so we don't render an empty card.
 */

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Image as ImageIcon, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { OrderCard } from './_OrderCard'

interface DeliveryEvidenceProps {
  role: 'buyer' | 'seller' | 'admin'
  urls: string[] | null | undefined
}

export function DeliveryEvidence({ role, urls }: DeliveryEvidenceProps) {
  const list = (urls ?? []).filter(Boolean)
  const [index, setIndex] = useState<number | null>(null)

  const close = useCallback(() => setIndex(null), [])
  const next = useCallback(
    () => setIndex((i) => (i === null ? null : (i + 1) % list.length)),
    [list.length],
  )
  const prev = useCallback(
    () =>
      setIndex((i) => (i === null ? null : (i - 1 + list.length) % list.length)),
    [list.length],
  )

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, close, next, prev])

  if (list.length === 0) return null

  const cols = role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <>
      <OrderCard className="px-5 py-4" padded={false}>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-[7px] bg-lime/[0.12] text-lime-text">
            <ImageIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[13.5px] font-bold tracking-tight text-text-primary">
            Delivery Evidence
          </span>
          <span className="ml-auto text-[11.5px] text-text-secondary">
            {list.length} {list.length === 1 ? 'Image' : 'Images'}
          </span>
        </div>
        <div className={`grid gap-2.5 ${cols}`}>
          {list.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className="group relative aspect-[4/3] overflow-hidden rounded-[10px] border border-border-default bg-bg-overlay/60 transition-all hover:border-lime/40"
              aria-label={`Open evidence image ${i + 1}`}
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, 320px"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                unoptimized
              />
            </button>
          ))}
        </div>
      </OrderCard>

      {/* Lightbox */}
      {index !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={close}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              close()
            }}
            className="absolute right-6 top-6 grid h-10 w-10 place-items-center rounded-full bg-white/[0.08] text-text-primary transition-colors hover:bg-white/[0.16]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  prev()
                }}
                className="absolute left-6 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/[0.08] text-text-primary transition-colors hover:bg-white/[0.16]"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  next()
                }}
                className="absolute right-6 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/[0.08] text-text-primary transition-colors hover:bg-white/[0.16]"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          <div
            className="relative max-h-[88vh] max-w-[88vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={list[index]}
              alt=""
              className="max-h-[88vh] max-w-[88vw] rounded-[10px] object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  )
}
