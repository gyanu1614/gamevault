import { permanentRedirect } from 'next/navigation'

// Legacy escrow-brand URL (the escrow product was renamed to
// SafeDrop in the DropMarket rebrand). Permanent so crawlers
// transfer equity.
export default function SafeDropRedirect() {
  permanentRedirect('/safedrop')
}
