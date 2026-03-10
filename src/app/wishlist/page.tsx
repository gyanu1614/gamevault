/**
 * Redirect: /wishlist → /account/wishlist
 */

import { redirect } from 'next/navigation'

export default function WishlistRedirect() {
  redirect('/account/wishlist')
}
