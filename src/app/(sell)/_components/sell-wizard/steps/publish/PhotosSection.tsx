'use client'

import { Loader2, Upload, X as IconX } from 'lucide-react'

import { SubCard } from '../../ui/SubCard'
import { TipBox } from '../../ui/form-fields'
import type { Step4Props } from './types'

/** Up to five photos; the first is the thumbnail (not asked for currency: the server uses its icon). */
export function PhotosSection({ p }: { p: Pick<Step4Props, 'images' | 'onUpload' | 'onRemoveImage' | 'imageUploading'> }) {
  return (
<SubCard
  title="Photos"
  right={<span className="text-xs text-text-tertiary">{p.images.length}/5</span>}
>
  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
    {p.images.map((src, i) => (
      <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-border-default">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
        {/* Remove — always visible on touch (hover-reveal only at sm+),
            36px hitbox around the 24px visual circle. */}
        <button
          type="button"
          onClick={() => p.onRemoveImage(i)}
          aria-label="Remove photo"
          className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-error text-text-primary">
            <IconX className="h-3 w-3" />
          </span>
        </button>
        {i === 0 && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-lime px-1.5 py-0.5 text-[10px] font-bold text-text-inverse">
            Main
          </span>
        )}
      </div>
    ))}
    {p.images.length < 5 && (
      <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border-default bg-bg-inset transition-colors hover:border-lime hover:bg-bg-raised-hover">
        {p.imageUploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-lime-text" />
        ) : (
          <>
            <Upload className="h-5 w-5 text-text-tertiary" />
            <span className="text-xs text-text-tertiary">Upload</span>
          </>
        )}
        <input
          type="file"
          multiple
          accept="image/*"
          disabled={p.imageUploading}
          onChange={(e) => { p.onUpload(e.target.files); e.currentTarget.value = '' }}
          className="hidden"
        />
      </label>
    )}
  </div>
  <TipBox>At least 800px square. Your first photo is the thumbnail.</TipBox>
</SubCard>
  )
}
