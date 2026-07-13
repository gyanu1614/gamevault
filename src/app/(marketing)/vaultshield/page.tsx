import { permanentRedirect } from 'next/navigation'

// Legacy protection-brand URL (the buyer-protection product was
// renamed to SafeDrop in the DropMarket rebrand). Permanent so
// crawlers transfer equity.
export default function SafeDropRedirect() {
  permanentRedirect('/safedrop')
}
