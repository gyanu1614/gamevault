/**
 * "Market price · updated HH:MM UTC · from N listings across M marketplaces"
 *
 * Shared by every game on the values pipeline. The timestamp is when a value
 * last MOVED (values_prices.price_changed_at), not when the crawl last ran: a
 * crawl that confirms the same price must not advertise new freshness.
 *
 * Self-hides when nothing is published, so a page with no price never shows a
 * freshness claim it cannot support.
 */
export function ValuesFreshnessBadge({
  lastChangedAt,
  listingCount,
  sourceCount,
  className,
}: {
  lastChangedAt: string | null
  listingCount: number
  sourceCount: number
  className?: string
}) {
  if (!lastChangedAt || listingCount <= 0) return null

  const when = new Date(lastChangedAt)
  const hhmm = `${String(when.getUTCHours()).padStart(2, '0')}:${String(
    when.getUTCMinutes(),
  ).padStart(2, '0')}`
  const marketplaces = Math.max(1, sourceCount)

  return (
    <p
      className={[
        'font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ct-text-faint)]',
        className ?? '',
      ].join(' ')}
    >
      Market price · updated {hhmm} UTC · from {listingCount.toLocaleString('en-US')}{' '}
      {listingCount === 1 ? 'listing' : 'listings'} across {marketplaces}{' '}
      {marketplaces === 1 ? 'marketplace' : 'marketplaces'}
    </p>
  )
}
