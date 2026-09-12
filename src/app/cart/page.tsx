/**
 * Redirect: /cart → /browse
 *
 * ROUTE-007. The cart system was removed in favour of direct "Buy Now"
 * checkout (Feb 2026); see progress/24feb/03_CHECKOUT_SAFEDROP_CART_FIXES.md.
 *
 * This was a 'use client' page that redirected from a useEffect behind a
 * spinner — 200 + a JS bundle + a layout shift where one 307 will do. It also
 * sat in PROTECTED_ROUTE_PREFIXES, so a logged-out visitor was bounced to
 * /login and, after authenticating, landed on a spinner that threw them to
 * /browse: an auth round-trip for a dead route. Both are fixed — this matches
 * the sibling deprecated stubs (/wallet, /purchases, /wishlist, /reviews).
 */

import { redirect } from 'next/navigation'

export default function CartRedirect() {
  redirect('/browse')
}
