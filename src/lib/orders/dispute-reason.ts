/**
 * Dispute category label (as shown in the dispute modal) → the
 * dispute_reason_enum value stored on the dispute.
 *
 * Case-insensitive on purpose: the modal renders Title Case labels
 * ("Item Not As Described") while this map was written in sentence case,
 * so every dispute used to be stored as 'other'.
 */

const REASONS: Record<string, string> = {
  'item not as described': 'not_as_described',
  'did not receive order': 'item_not_received',
  'wrong item received': 'wrong_item',
  'account credentials invalid': 'account_issue',
  'seller unresponsive': 'seller_unresponsive',
  other: 'other',
}

export function disputeReasonFor(label: string | null | undefined): string {
  const key = (label ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  return REASONS[key] ?? 'other'
}
