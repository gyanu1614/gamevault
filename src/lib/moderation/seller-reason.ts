/**
 * What a seller reads on a listing staff have acted on. Staff text is stored with
 * a prefix on a take-down and with a report count on an automatic hide, neither of
 * which is meant for the seller.
 */
export interface ListingReviewText {
  status: string
  rejection_reason?: string | null
  moderation_notes?: string | null
}

const TAKEN_DOWN = /^Taken down:\s*/i
const AUTO_HIDDEN = /^Auto-hidden/i

function present(text: string | null | undefined): string | null {
  const trimmed = text?.trim()
  return trimmed ? trimmed : null
}

export function sellerFacingReason(listing: ListingReviewText): { label: 'Reason' | 'Requested'; text: string } | null {
  const notes = present(listing.moderation_notes)
  if (listing.status === 'changes_requested') return notes ? { label: 'Requested', text: notes } : null
  if (listing.status === 'rejected') {
    const text = present(listing.rejection_reason) ?? notes
    return text ? { label: 'Reason', text } : null
  }
  if (listing.status === 'suspended' && notes) {
    if (AUTO_HIDDEN.test(notes)) return { label: 'Reason', text: 'Hidden while our team reviews buyer reports.' }
    return { label: 'Reason', text: notes.replace(TAKEN_DOWN, '') }
  }
  return null
}
