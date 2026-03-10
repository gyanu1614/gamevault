/**
 * Redirect: /orders/[orderId] → /account/orders/[orderId]
 */

import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{
    orderId: string
  }>
}

export default async function OrderDetailRedirect({ params }: PageProps) {
  const { orderId } = await params
  redirect(`/account/orders/${orderId}`)
}
