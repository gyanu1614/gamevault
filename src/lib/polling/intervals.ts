/**
 * Client-side Supabase poll intervals — one place, one floor.
 *
 * Every badge/grid poll here is a FALLBACK: realtime channels or the
 * mutation that changed the data invalidate the query first, and React Query
 * refetches on window focus. A poll only has to catch what those miss, so
 * nothing polls faster than once a minute and nothing polls in a hidden tab.
 * Pinned by src/lib/polling/intervals.test.ts and
 * src/test/guards/client-polling.guard.test.ts.
 */

export const MIN_CLIENT_POLL_MS = 60_000

export const POLL_MS = {
  /** Navbar + account sidebar Messages badge (one shared query). Chat/realtime invalidates it first. */
  unreadMessages: 60_000,
  /** Navbar bell; the per-user notifications realtime channel invalidates it on INSERT. */
  navNotifications: 120_000,
  /** Navbar Live Orders; refreshed by the same notifications channel (new order / status notices). */
  navActiveOrders: 120_000,
  /** Admin header queue counts + bell. */
  adminHeader: 60_000,
  /** Admin list pages (notifications, activities). */
  adminPages: 60_000,
  /** /notifications inbox; the navbar realtime channel invalidates it on INSERT. */
  notificationsPage: 60_000,
  /** /account/messages conversation list; its messages realtime channel invalidates it. */
  sellerConversations: 60_000,
  /** Seller online dots (grids, chat, order header); the heartbeat writes every 2 min. */
  sellerPresence: 120_000,
  /** Homepage "just sold" ticker. */
  recentSales: 120_000,
  /** Profile re-read while a seller application is in flight (realtime is primary). */
  sellerApproval: 60_000,
} as const

/** React Query options for a poll that only runs while the tab is visible. */
export function foregroundPoll(ms: number) {
  if (ms < MIN_CLIENT_POLL_MS) {
    throw new Error(`client poll of ${ms} ms is under the ${MIN_CLIENT_POLL_MS} ms floor`)
  }
  return {
    refetchInterval: ms,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  } as const
}

/** True only in a browser tab the user can see. */
export function isTabVisible(
  doc: Pick<Document, 'visibilityState'> | undefined = typeof document === 'undefined' ? undefined : document,
): boolean {
  return doc?.visibilityState === 'visible'
}

/** Application states where an admin decision can still flip the user to seller. */
export const SELLER_APPLICATION_IN_FLIGHT = ['pending', 'under_review', 'info_requested'] as const

/**
 * Whether the auth provider should keep re-reading the profile to catch a
 * seller approval. Buyers who never applied, rejected applicants and approved
 * sellers have nothing to wait for.
 */
export function shouldPollSellerApproval(state: {
  isApprovedSeller?: boolean | null
  sellerApplicationStatus?: string | null
}): boolean {
  if (state.isApprovedSeller) return false
  const status = state.sellerApplicationStatus
  return !!status && (SELLER_APPLICATION_IN_FLIGHT as readonly string[]).includes(status)
}
