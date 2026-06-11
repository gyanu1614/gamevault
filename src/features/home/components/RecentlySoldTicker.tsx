import type { SoldItem } from '../hooks/useRecentSales'

export interface SoldRowProps {
  item: SoldItem
}

/**
 * Single recently-sold pill.
 */
export function SoldRow({ item }: SoldRowProps) {
  return (
    <div className="inline-flex items-center gap-[10px] py-[9px] px-[15px] bg-bg-raised border border-border-subtle rounded-full whitespace-nowrap">
      <span className="w-[7px] h-[7px] rounded-full bg-success flex-none" aria-hidden="true" />
      <span className="text-[13px] text-text-secondary">
        <b className="text-text-primary font-semibold">{item.game}</b> · {item.item}
      </span>
      <span className="text-[13px] font-semibold text-lime-text text-tabular">
        ${item.amount.toLocaleString()}
      </span>
      <span className="font-mono text-[11px] text-text-tertiary">{item.ago}</span>
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
      <div className="flex gap-3 w-max animate-ticker">
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
