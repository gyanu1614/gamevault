/**
 * Value page → listing funnel events (Bundle 2, task E).
 *
 * First-party, because Vercel Analytics custom events can't be joined to
 * orders. Privacy by construction: every field is an enum, a slug or a
 * listing uuid — no user id, no IP, no cookie, no browser storage, no free
 * text. The IP is only used (and never stored here) by the route's rate limit.
 *
 *   value_view      a value item page or calculator was viewed
 *   cta_click       the buy button was clicked (state = which of the three)
 *   fallback_shown  an item listings page had nothing for the request and
 *                   showed other variants / similar items
 *   listing_opened  a listing card was opened from a value surface
 *   (alert_created  reserved for task D)
 */
import { z } from 'zod'

export const VALUE_EVENTS = ['value_view', 'cta_click', 'fallback_shown', 'listing_opened'] as const
export const VALUE_SURFACES = ['value_item', 'calculator', 'item_buy'] as const
export const BUY_STATES = ['in_stock', 'other_variants', 'none'] as const

export type ValueEventName = (typeof VALUE_EVENTS)[number]
export type ValueSurface = (typeof VALUE_SURFACES)[number]

const slug = z.string().max(128).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const schema = z.object({
  event: z.enum(VALUE_EVENTS),
  surface: z.enum(VALUE_SURFACES),
  game: slug,
  item: slug.optional().nullable(),
  variant: slug.optional().nullable(),
  state: z.enum(BUY_STATES).optional().nullable(),
  listing: z.string().uuid().optional().nullable(),
})

export type ValueEventInput = z.input<typeof schema>

export interface ValueEventRow {
  event: ValueEventName
  surface: ValueSurface
  game_slug: string
  item_slug: string | null
  variant: string | null
  state: (typeof BUY_STATES)[number] | null
  listing_id: string | null
}

export function parseValueEvent(input: unknown): ValueEventRow | null {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return null
  const e = parsed.data
  return {
    event: e.event,
    surface: e.surface,
    game_slug: e.game,
    item_slug: e.item ?? null,
    variant: e.variant ?? null,
    state: e.state ?? null,
    listing_id: e.listing ?? null,
  }
}
