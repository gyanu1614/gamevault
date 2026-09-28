'use client'

/**
 * Keeps an approved seller's presence fresh while they have the site open.
 *
 * useMyPresence (src/hooks/use-seller-presence.ts) existed but was mounted
 * nowhere, so seller_presence was never updated and every "online" signal
 * on the site was stale. Mounted once, app-wide, for approved sellers only
 * (buyers have no presence row). Renders nothing.
 */

import { useAuth } from '@/hooks/use-auth'
import { useMyPresence } from '@/hooks/use-seller-presence'

function Heartbeat() {
  useMyPresence()
  return null
}

export function SellerPresenceHeartbeat() {
  const { user } = useAuth()
  return user?.isApprovedSeller ? <Heartbeat key={user.id} /> : null
}
