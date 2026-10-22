/**
 * The ONE values freshness badge: a live dot + a dated line. Two inputs, one
 * look (it used to be two components — a mono uppercase line here and a
 * pulsing-dot pill in src/lib/sab — so the hubs disagreed on the same cue).
 *
 *  - `updatedAt` (item heroes): "Updated Oct 4, 09:30 UTC"
 *  - `lastChangedAt` + counts (values pipeline):
 *    "Prices Updated HH:MM UTC | Verified Daily | N Offers Tracked" (owner,
 *    2026-10-21: no "from N listings across 1 marketplace").
 *    The timestamp is when a value last MOVED (values_prices.price_changed_at),
 *    not when the crawl last ran: a crawl that confirms the same price must not
 *    advertise new freshness.
 *
 * Self-hides when there is nothing to vouch for, so a page with no price never
 * shows a freshness claim it cannot support. Server-safe (no hooks).
 */

type SnapshotProps = {
  updatedAt: string | null | undefined
  className?: string
}

type PipelineProps = {
  lastChangedAt: string | null
  listingCount: number
  sourceCount: number
  className?: string
}

export type FreshnessBadgeProps = SnapshotProps | PipelineProps

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function utcHhMm(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** The badge's parts, shown with hairline dividers; null when there is nothing to vouch for. */
export function badgeParts(props: FreshnessBadgeProps): string[] | null {
  if ('lastChangedAt' in props) {
    const { lastChangedAt, listingCount } = props
    if (!lastChangedAt || listingCount <= 0) return null
    const when = new Date(lastChangedAt)
    if (Number.isNaN(when.getTime())) return null
    // Whole strings per part, never `+`-split literals: the production server
    // build once dropped the trailing spaces of split literals while the
    // client kept them, a hydration mismatch (React #425) on
    // /murder-mystery-2/values, 2026-10-07.
    const offers = `${listingCount.toLocaleString('en-US')} ${listingCount === 1 ? 'Offer' : 'Offers'} Tracked`
    return [`Prices Updated ${utcHhMm(when)} UTC`, 'Verified Daily', offers]
  }
  if (!props.updatedAt) return null
  const date = new Date(props.updatedAt)
  if (Number.isNaN(date.getTime())) return null
  // Built by hand, not toLocaleString: iOS Safari renders the same options as
  // "Oct 10 at 10:18" while Node prints "Oct 10, 10:18" — a hydration mismatch.
  const label = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${utcHhMm(date)}`
  return [`Updated ${label} UTC`]
}

/** One-line form (tests, plain-text uses). */
export function badgeText(props: FreshnessBadgeProps): string | null {
  return badgeParts(props)?.join(' · ') ?? null
}

export function FreshnessBadge(props: FreshnessBadgeProps) {
  const parts = badgeParts(props)
  if (!parts) return null

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] font-medium leading-snug text-text-secondary ${props.className ?? ''}`}
    >
      <span aria-hidden className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      {parts.map((part, i) => (
        <span key={part} className="inline-flex items-center gap-2.5">
          {i > 0 && <span aria-hidden className="h-3 w-px bg-white/15" />}
          <span className={i === 0 ? 'text-text-primary' : undefined}>{part}</span>
        </span>
      ))}
    </span>
  )
}

/** Values-pipeline name for the same badge (generic hub + item pages). */
export const ValuesFreshnessBadge = FreshnessBadge
