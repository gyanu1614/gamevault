/**
 * Step 4 — what an import may do to the status of a listing it owns.
 *
 * The importer owns one listing per (store, game, item, variant), for good
 * (`listings_import_identity_key` has no status filter — see the migration).
 * So a re-import always finds the same row, whatever happened to it since,
 * and these rules decide what the new batch may change. Order and refund
 * triggers keep moving listings between statuses; nothing here may undo a
 * moderator's decision or switch a sold-out listing back on without stock.
 */

export interface ExistingListingState {
  status: string
  /** The quantity the re-import is about to write. */
  quantity: number
  isUnlimited: boolean
}

export type ReimportDecision =
  /** Write price/stock; `status` is the new status, or null to leave it. */
  | { kind: 'update'; status: 'active' | null }
  | { kind: 'refuse'; reason: string }

export function reimportDecision(l: ExistingListingState): ReimportDecision {
  switch (l.status) {
    case 'active':
      return { kind: 'update', status: null }
    case 'sold':
      // Restocked → back on sale. Still empty → stays sold.
      return { kind: 'update', status: l.isUnlimited || l.quantity > 0 ? 'active' : null }
    case 'archived':
      // Removed with its batch earlier; importing it again re-lists the same
      // listing (same URL) rather than creating a twin.
      return { kind: 'update', status: 'active' }
    case 'suspended':
      return { kind: 'refuse', reason: 'This listing was taken down by a moderator — restore it from Moderation first.' }
    case 'rejected':
      return { kind: 'refuse', reason: 'This listing was rejected by moderation — an import does not re-list it.' }
    default:
      // paused (its batch's Resume, or a strike, decides), pending_approval,
      // changes_requested, draft: price and stock only.
      return { kind: 'update', status: null }
  }
}

/**
 * Batch Pause / Resume / Remove: the listing statuses each one moves FROM.
 * Pause takes live listings only and Resume returns paused ones only, so a
 * sold-out listing never comes back with no stock. Remove leaves moderation's
 * decisions alone (a taken-down listing is restored only by a moderator —
 * `trg_listings_suspended_guard` would refuse the whole update otherwise).
 */
export const BATCH_STATUS_FROM: Record<'paused' | 'active' | 'archived', readonly string[]> = {
  paused: ['active'],
  active: ['paused'],
  archived: ['active', 'paused', 'sold', 'draft', 'pending_approval', 'changes_requested'],
}
