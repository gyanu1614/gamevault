/**
 * Redirect: /orders/[orderId] → /account/orders/[orderId]
 */

import { notFound, redirect } from 'next/navigation'

import { isUuid } from '@/lib/ids'

interface PageProps {
  params: Promise<{
    orderId: string
  }>
}

export default async function OrderDetailRedirect({ params }: PageProps) {
  const { orderId } = await params
  // ROUTE-009 — 404 at the boundary instead of propagating a malformed id
  // into the redirect target, where it would only 404 one hop later.
  if (!isUuid(orderId)) notFound()
  redirect(`/account/orders/${orderId}`)
}
