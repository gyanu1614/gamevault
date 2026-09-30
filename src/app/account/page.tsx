/**
 * /account has no page of its own: it opens the dashboard (sellers get the
 * seller dashboard, buyers their purchases overview). The old overview grid
 * repeated the sidebar, linked the removed wishlist and counted unread
 * messages on columns that don't exist.
 */
import { redirect } from 'next/navigation'

export const metadata = { title: 'My Account' }

export default function AccountPage() {
  redirect('/account/dashboard')
}
