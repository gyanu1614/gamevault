/**
 * /checkout/paid/[orderId] — "Order Paid → Go to Order" (same-tab pay,
 * owner 2026-10-16). Payssion's return lands here (via /checkout/return)
 * when the order is paid or Payssion says it is; the view confirms against
 * our DB before it says "paid". Private: the buyer's own order only.
 */

import { redirect } from 'next/navigation'

import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'
import { isUuid } from '@/lib/ids'
import { createClient } from '@/lib/supabase/server'
import { OrderPaidView } from '../../_components/OrderPaidView'
import { loadPaidOrderSummary } from '../../_components/paid-order'

export const dynamic = 'force-dynamic'

export default async function OrderPaidPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  if (!isUuid(orderId)) redirect('/account/orders')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/checkout/paid/${orderId}`)

  const order = await loadPaidOrderSummary(supabase, orderId, user.id)
  if (!order) redirect('/account/orders')

  // Site navbar (layout-wrapper keeps it here and drops the footer); the order
  // hero art behind it, deeply dimmed and sized to the screen (hero-fit), so it
  // never adds a scroll nor leaves a band under the navbar (owner 2026-10-19).
  return (
    <>
      <HeroBackdropPreload name="order" />
      <HeroBackdrop name="order" className="hero-dim-deep hero-fit min-h-[calc(100dvh-var(--navbar-bottom,0px))]">
        <OrderPaidView order={order} />
      </HeroBackdrop>
    </>
  )
}
