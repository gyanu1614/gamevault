/**
 * Redirect: /wallet → /account/wallet
 */

import { redirect } from 'next/navigation'

export default function WalletRedirect() {
  redirect('/account/wallet')
}
