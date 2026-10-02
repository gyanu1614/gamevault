'use client'

import type { ValueEventInput } from './events'

/**
 * Fire-and-forget funnel beacon (task E). No cookies, no storage, no ids —
 * the payload is validated server-side to enums / slugs / a listing uuid.
 * `sendBeacon` survives the navigation a CTA click starts; falls back to a
 * keepalive fetch. Never throws.
 */
export function trackValueEvent(event: ValueEventInput): void {
  try {
    if (typeof window === 'undefined') return
    const body = JSON.stringify(event)
    if (navigator.sendBeacon?.('/api/events/value', new Blob([body], { type: 'text/plain' }))) return
    void fetch('/api/events/value', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {})
  } catch {
    // analytics must never break the page
  }
}
