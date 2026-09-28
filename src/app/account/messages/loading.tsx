/**
 * Messages route fallback — the same skeleton the page shows while its
 * conversations load (see _MessagesSkeleton), so there is one loading state.
 */

import { MessagesSkeleton } from './_MessagesSkeleton'

export default function MessagesLoading() {
  return <MessagesSkeleton />
}
