import 'server-only'

import { afterResponse } from '@/lib/after-response'
import { postOpsAlert } from '@/lib/ops/discord-alert'
import type { UnmatchedListing } from './link'
import { notLinkedMessage } from './not-linked-message'

/**
 * A new listing went live with no item page: it sells something the catalogue
 * doesn't have, or its title and pick disagree. The owner hears about it after the
 * response (it never holds up the seller), and Admin → Games → Values lists them.
 */
export function reportNotLinked(rows: readonly UnmatchedListing[]): void {
  const text = notLinkedMessage(rows)
  if (text) afterResponse('listing-not-linked', () => postOpsAlert(text))
}
