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
import { Loader2 } from 'lucide-react'
import { getMyStorePaused, setStorePaused } from '@/lib/actions/seller-presence'
import { Switch } from '@/components/ui/switch'
import { SettingsCard } from '@/components/account/AccountSurface'
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
    <SettingsCard
      title="Store Availability"
      description="Pause while you’re away. Your offers stay saved and come back the moment you switch back on. Orders already placed still need delivering."
      aside={<StatusPill loading={loading} paused={paused} />}
    >
      <div className="flex items-center justify-between gap-4 rounded-md bg-bg-overlay px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Pause My Store</p>
          <p className="mt-0.5 text-[12.5px] text-text-tertiary">
            {paused ? 'Your offers are hidden from buyers.' : 'Buyers can see and order your offers.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" aria-hidden />}
          <Switch
            checked={paused}
            onCheckedChange={toggle}
            disabled={loading || pending}
            aria-label="Pause my store"
          />
        </div>
      </div>
    </SettingsCard>
  )
}

function StatusPill({ loading, paused }: { loading: boolean; paused: boolean }) {
  if (loading) return <span className="skeleton block h-6 w-16 rounded-full" aria-hidden />
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold',
        paused ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success',
      )}
    >
      {paused ? 'Paused' : 'Live'}
    </span>
  )
}
