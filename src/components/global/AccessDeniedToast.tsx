'use client'

/**
 * V17e — Reads `?access=…` from the URL and surfaces a toast that
 * matches the reason the middleware bounced the user. Strips the
 * query param after firing so a hard refresh doesn't re-trigger.
 *
 * Mounted near the root so any redirect from middleware lands here
 * regardless of which page the bounce target is.
 */

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

const REASONS: Record<string, { title: string; description?: string }> = {
  'seller-only': {
    title: 'Sellers only',
    description: 'That section is for approved sellers.',
  },
}

export default function AccessDeniedToast() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const reason = searchParams?.get('access')
    if (!reason) return
    const copy = REASONS[reason]
    if (copy) {
      toast.error(copy.title, copy.description ? { description: copy.description } : undefined)
    }
    // Strip the param so refresh/back doesn't re-fire and the URL
    // stays clean.
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.delete('access')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname || '/')
  }, [searchParams, pathname, router])

  return null
}
