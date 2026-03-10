/**
 * Redirect: /purchases → /account/orders
 */

import { redirect } from 'next/navigation'

export default function PurchasesRedirect() {
  redirect('/account/orders')
}
