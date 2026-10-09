'use client'

import { useState } from 'react'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * The (i) next to a currency delivery method ("Gamepass", "UID / Login"):
 * opens the admin's explanation. Hover opens it with a mouse; a tap toggles
 * it on touch, and a tap outside closes it (a hover-only tooltip never opens
 * on a phone).
 */
export function DeliveryMethodInfo({
  label,
  description,
  className,
}: {
  label: string
  description: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (!description) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label={`What ${label} means`}
        onClick={(e) => e.stopPropagation()}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true) }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOpen(false) }}
        className={cn(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:text-text-primary',
          className,
        )}
      >
        <InfoOutlinedIcon aria-hidden style={{ fontSize: 16 }} />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-[min(22rem,calc(100vw-2rem))] p-3.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-[14px] font-semibold text-text-primary">{label}</p>
        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-text-secondary">{description}</p>
      </PopoverContent>
    </Popover>
  )
}
