'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { hasSitePageBehind } from '@/lib/navigation/scroll-memory'
import { cn } from '@/lib/utils'

/**
 * Back to the page the buyer came from when it is ours, else to `href` (they
 * arrived from a search result or a shared link). Really going back keeps that page's
 * search, filters and place. `document.referrer` only knows the first page of a visit,
 * so moves inside the site are counted as well.
 */
export function BackButton({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter()
  const goBack = () => {
    let fromUs = hasSitePageBehind()
    if (!fromUs) try {
      fromUs = window.history.length > 1 && !!document.referrer && new URL(document.referrer).origin === window.location.origin
    } catch {
      fromUs = false
    }
    if (fromUs) router.back()
    else router.push(href)
  }
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Back"
      className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-md text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring', className)}
    >
      {children}
    </button>
  )
}
