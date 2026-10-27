'use client'

/**
 * Notify Me (owner, 2026-10-24): an item nobody sells gets an in-stock email
 * alert instead of a dead end (and never a link to the value page). Signed
 * out: the sign-in dialog, back to this page. Signed in: one tap sets the
 * alert ("Alert Set"), another removes it. The email goes out when the first
 * listing of the item goes live (stock_alerts + sendDueStockAlerts). With a
 * `variant` (the pet page's trait picker) the alert waits for that trait only;
 * `itemName` is then the full name ("Neon Fly Ride Parrot").
 */
import { useState, useTransition } from 'react'
import { IconBell, IconBellCheck } from '@tabler/icons-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { clearStockAlert, setStockAlert } from '@/lib/actions/stock-alerts'
import { stockAlertKey } from '@/lib/stock-alerts/key'
import { cn } from '@/lib/utils'
import { useStockAlerts } from './stock-alerts-context'

export function NotifyMeButton({
  gameSlug,
  itemSlug,
  itemName,
  variant = null,
  className,
}: {
  gameSlug: string
  itemSlug: string
  itemName: string
  variant?: string | null
  className?: string
}) {
  const { user } = useAuth()
  const { open: openAuth } = useAuthDialog()
  const shared = useStockAlerts()
  const [own, setOwn] = useState(false)
  const [pending, start] = useTransition()
  const key = stockAlertKey(itemSlug, variant)
  const isSet = shared ? shared.slugs.has(key) : own

  const mark = (on: boolean) => {
    if (shared) shared.setLocal(key, on)
    else setOwn(on)
  }

  const onClick = () => {
    if (!user) {
      openAuth('login', { redirect: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/' })
      return
    }
    start(async () => {
      const r = isSet ? await clearStockAlert(gameSlug, itemSlug, variant) : await setStockAlert(gameSlug, itemSlug, variant)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      mark(!isSet)
      toast.success(isSet ? `Alert removed for ${itemName}` : `We'll email you when ${itemName} is listed`)
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={isSet}
      className={cn(
        'relative z-10 inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-semibold transition-colors disabled:opacity-60',
        isSet ? 'bg-lime-tint-bg text-lime-text hover:bg-[rgba(86,184,127,0.18)]' : 'bg-white/[0.07] text-text-primary hover:bg-white/[0.11]',
        className,
      )}
    >
      {isSet ? <IconBellCheck aria-hidden size={15} stroke={2} /> : <IconBell aria-hidden size={15} stroke={2} />}
      {isSet ? 'Alert Set' : 'Notify Me'}
    </button>
  )
}
