'use client'

/**
 * Store availability ("vacation mode") for the Seller tab.
 *
 * Nothing new server-side: `setStorePaused` already exists and the
 * marketplace queries already exclude paused sellers' offers. It was only
 * reachable from a small toggle in the navbar account dropdown, where a
 * seller going away for a week would never think to look. Every comparable
 * marketplace (eBay "Time Away", Etsy "Vacation Mode") puts this in settings.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Power } from 'lucide-react'
import { getMyStorePaused, setStorePaused } from '@/lib/actions/seller-presence'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export default function StoreAvailabilitySection() {
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let active = true
    getMyStorePaused()
      .then((value) => { if (active) setPaused(value) })
      .catch(() => { /* default to "live"; a read failure must not imply paused */ })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const toggle = async (next: boolean) => {
    // Optimistic, but reverted on failure — a toggle that silently lies
    // about whether your store is live is worse than a slow one.
    setPending(true)
    setPaused(next)

    const result = await setStorePaused(next)
    setPending(false)

    if (!result?.success) {
      setPaused(!next)
      toast.error('Couldn’t update your store status', { description: 'Try again in a moment.' })
      return
    }

    toast.success(next ? 'Store paused' : 'Store is live', {
      description: next
        ? 'Your offers are hidden from buyers until you switch this back.'
        : 'Your offers are visible to buyers again.',
    })
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold text-text-primary">Store Availability</h2>

      <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-raised/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
              paused
                ? 'border-warning/30 bg-warning-bg text-warning'
                : 'border-lime-tint-border bg-lime/15 text-lime-text',
            )}
          >
            <Power className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary">
              {loading ? 'Checking…' : paused ? 'Paused — Offers Hidden' : 'Live — Accepting Orders'}
            </div>
            <p className="mt-0.5 text-xs text-text-tertiary">
              Pause while you’re away. Your listings stay saved and reappear the moment you
              switch back. Orders already placed still need fulfilling.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />}
          <Switch
            checked={paused}
            onCheckedChange={toggle}
            disabled={loading || pending}
            aria-label="Pause my store"
          />
        </div>
      </div>
    </div>
  )
}
