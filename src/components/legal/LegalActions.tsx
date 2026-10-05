'use client'

/**
 * Small client islands for the legal layout:
 *  - `CopySectionLink` — the link button beside each section heading. Copies
 *    the section's absolute URL (with #anchor), updates the address bar, and
 *    confirms with a polite live-region message. Visible on hover/focus on
 *    desktop, always visible on touch screens (no hover there).
 *  - `PrintButton` — window.print(); the layout's print CSS does the rest.
 */

import { useEffect, useRef, useState } from 'react'
import { LinkSimpleIcon } from '@phosphor-icons/react/dist/csr/LinkSimple'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { PrinterIcon } from '@phosphor-icons/react/dist/csr/Printer'
import { cn } from '@/lib/utils'

export function CopySectionLink({ id, label }: { id: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  async function copy() {
    const url = `${window.location.origin}${window.location.pathname}#${id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the hash
      // update below still leaves a shareable URL in the address bar.
    }
    window.history.replaceState(null, '', `#${id}`)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy link to section: ${label}`}
        className={cn(
          'ml-2 inline-grid h-8 w-8 shrink-0 translate-y-[-1px] place-items-center rounded-md align-middle text-text-tertiary transition-[opacity,background-color,color] hover:bg-white/[0.06] hover:text-text-primary print:hidden',
          'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/heading:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100',
          copied && '[@media(hover:hover)]:opacity-100 text-text-primary',
        )}
      >
        {copied ? (
          <CheckIcon size={15} weight="bold" aria-hidden />
        ) : (
          <LinkSimpleIcon size={15} weight="bold" aria-hidden />
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Link copied' : ''}
      </span>
    </>
  )
}

export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md bg-white/[0.06] px-3 text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.10] active:scale-[0.98] print:hidden',
        className,
      )}
    >
      <PrinterIcon size={15} weight="bold" aria-hidden />
      Print
    </button>
  )
}
