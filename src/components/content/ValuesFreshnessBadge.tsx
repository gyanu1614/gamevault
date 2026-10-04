/**
 * The ONE values freshness badge: a live dot + a dated line. Two inputs, one
 * look (it used to be two components — a mono uppercase line here and a
 * pulsing-dot pill in src/lib/sab — so the hubs disagreed on the same cue).
 *
 *  - `updatedAt` (item heroes): "Updated Oct 4, 09:30 UTC"
 *  - `lastChangedAt` + counts (values pipeline):
 *    "Market price · updated HH:MM UTC · from N listings across M marketplaces"
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

function utcHhMm(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function badgeText(props: FreshnessBadgeProps): string | null {
  if ('lastChangedAt' in props) {
    const { lastChangedAt, listingCount, sourceCount } = props
    if (!lastChangedAt || listingCount <= 0) return null
    const when = new Date(lastChangedAt)
    if (Number.isNaN(when.getTime())) return null
    const marketplaces = Math.max(1, sourceCount)
    return (
      `Market price · updated ${utcHhMm(when)} UTC · from ${listingCount.toLocaleString('en-US')} ` +
      `${listingCount === 1 ? 'listing' : 'listings'} across ${marketplaces} ` +
      `${marketplaces === 1 ? 'marketplace' : 'marketplaces'}`
    )
  }
  if (!props.updatedAt) return null
  const date = new Date(props.updatedAt)
  if (Number.isNaN(date.getTime())) return null
  const label = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
  return `Updated ${label} UTC`
}

export function FreshnessBadge(props: FreshnessBadgeProps) {
  const text = badgeText(props)
  if (!text) return null

  return (
    <span
      className={`inline-flex items-center gap-2 text-[12.5px] font-medium leading-snug text-text-secondary ${props.className ?? ''}`}
    >
      <span aria-hidden className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      {text}
    </span>
  )
}

/** Values-pipeline name for the same badge (generic hub + item pages). */
export const ValuesFreshnessBadge = FreshnessBadge
