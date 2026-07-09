import type { SoldItem } from '../hooks/useRecentSales'

export interface SoldRowProps {
  item: SoldItem
}

/**
 * V57 — Recently-sold pill, marquee edition.
 *
 * Restyled to the payments-marquee language: glass pill with a top
 * sheen, roomier type, lime price. The green dot keeps the "live"
 * heartbeat per pill.
 */
export function SoldRow({ item }: SoldRowProps) {
  return (
    <div className="relative inline-flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-full border border-border-subtle bg-[rgba(20,20,27,0.56)] px-5 py-3 backdrop-blur-md">
      {/* Top sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent)]"
      />
      <span className="relative h-[7px] w-[7px] flex-none rounded-full bg-success shadow-[0_0_8px_rgba(74,222,128,0.8)]" aria-hidden="true" />
      <span className="relative text-[14px] text-text-secondary">
        <b className="font-semibold text-text-primary">{item.game}</b>
        <span className="mx-1.5 text-text-disabled">·</span>
        {item.item}
      </span>
      <span className="relative text-[14.5px] font-bold tabular-nums text-lime-text">
        ${item.amount.toLocaleString()}
      </span>
      <span className="relative font-mono text-[11px] text-text-tertiary">{item.ago}</span>
    </div>
  )
}

export interface RecentlySoldTickerProps {
  items: SoldItem[]
}

/**
 * Horizontal infinite-scroll ticker. Renders the array twice for a seamless
 * -50% transform loop. Pauses on hover via .animate-ticker:hover (globals.css).
 */
export function RecentlySoldTicker({ items }: RecentlySoldTickerProps) {
  return (
    <div className="mask-fade-x overflow-hidden">
      <div className="flex w-max gap-4 animate-ticker">
        {items.map((item) => (
          <SoldRow key={`a-${item.id}`} item={item} />
        ))}
        {items.map((item) => (
          <SoldRow key={`b-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  )
}
