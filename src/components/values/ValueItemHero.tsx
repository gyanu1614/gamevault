import type { ReactNode, Ref } from 'react'
import { NewTag } from './NewTag'
import { ValueArt } from './ValueArt'
import { VALUE_LABEL, VALUE_SURFACE } from './styles'
import { titleCaseValue } from '@/lib/values/title-case'

/**
 * The ONE item-page hero for every values hub (Steal a Brainrot, Adopt Me and
 * the generic values_* pipeline). Game differences come in through props and
 * slots: every game passes its variants as `picker` — the universal
 * VariantSelector (SAB mutations, Adopt Me tier/potion, MM2 forms). Layout:
 * the picture · the identity (the title, the item's facts — Type, Rarity,
 * Availability, … — then the selector as a row under them on desktop, owner
 * 2026-10-14: under the art it showed two mutations; phones keep it under the
 * picture) · the price column top right — `panel` (ValueBuyPanel: our price,
 * the market reference, Buy, SafeDrop, a quiet Sell line) or the older
 * `price` + `actions` pair; the identity starts at the top (owner,
 * 2026-10-12); the freshness line sits under the buttons; then `below`.
 *
 * Look (owner, 2026-10-11/12 revamp): one flat raised card (#1D1E23, 8px),
 * the art as a cut-out with no tile behind it, no blur glow, no empty middle.
 *
 * No hooks, so the server-rendered generic page can use it directly.
 */
export function ValueItemHero({
  anchorRef,
  accent,
  art,
  title,
  titleAs: Title = 'h1',
  isNew,
  stats,
  price,
  actions,
  panel,
  footer,
  picker,
  below,
}: {
  /** Scroll target (heroes scroll back into view after a phone pick). */
  anchorRef?: Ref<HTMLDivElement>
  /** Per-item accent (mutation / variant colour). */
  accent?: string
  /** `caption`: a small line under the art (e.g. a CC-BY-SA image credit). */
  art?: { src: string | null; alt: string; pixelated?: boolean; caption?: ReactNode } | null
  title: ReactNode
  titleAs?: 'h1' | 'h2'
  /** Released (else added) in the last 14 days (isNewItem): a New tag beside the title, outside the h1. */
  isNew?: boolean
  stats?: ReadonlyArray<{ label: string; value: ReactNode }>
  price?: {
    label?: ReactNode
    value?: ReactNode
    /** Lines under the headline: freshness, secondary price, badges. */
    children?: ReactNode
  }
  /** Usually ValueBuyActions. */
  actions?: ReactNode
  /** The whole price column (ValueBuyPanel); replaces `price` + `actions`. */
  panel?: ReactNode
  /** Freshness line, shown under the Buy / Sell buttons (bottom right). */
  footer?: ReactNode
  /** The VariantSelector, rendered under the title inside the card. */
  picker?: ReactNode
  below?: ReactNode
}) {
  return (
    <div className="space-y-4">
      <div ref={anchorRef} className="relative scroll-mt-20 overflow-hidden rounded-[8px] bg-[#1D1E23]">
        <div
          className={`relative grid gap-6 p-5 sm:p-6 lg:items-start ${
            art ? 'lg:grid-cols-[232px_minmax(0,1fr)_260px]' : 'lg:grid-cols-[minmax(0,1fr)_280px]'
          }`}
        >
          {art && (
            // The picture (a cut-out, no tile) with the variant picker right
            // under it (owner, 2026-10-12).
            <div className="flex min-w-0 flex-col items-center gap-4">
              <ValueArt src={art.src} alt={art.alt} size={184} pixelated={art.pixelated} priority />
              {art.caption && (
                <div className="-mt-2 max-w-[232px] text-center text-[10.5px] leading-snug text-text-tertiary">{art.caption}</div>
              )}
              {picker && <div className="w-full lg:hidden">{picker}</div>}
            </div>
          )}

          <div className="min-w-0">
            {/* The tag sits beside the heading, never inside it: the h1 stays the item's name. */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <Title className="text-2xl font-bold leading-[1.1] tracking-[-0.02em] text-text-primary sm:text-[28px]">
                {title}
              </Title>
              {isNew && <NewTag size="md" />}
            </div>
            {/* The item's facts as rows under the name: label left, value
                right, every other row on a faint band — at every width (owner,
                2026-10-14: "in rows, alternate block colour, matching the
                card"). Plain values read as labels ("Unobtainable"). */}
            {stats && stats.length > 0 && (
              <dl className="mt-4 lg:mt-5">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="flex min-w-0 items-baseline justify-between gap-4 rounded-[6px] px-3 py-2.5 odd:bg-white/[0.035]"
                  >
                    <dt className="truncate text-body-sm text-text-secondary">{s.label}</dt>
                    <dd className="truncate text-right text-body-sm font-semibold tabular-nums text-text-primary">
                      {typeof s.value === 'string' ? titleCaseValue(s.value) : s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {/* Desktop: the picker as a row under the facts, beside the picture.
                No art (some generic items): there on every screen. */}
            {picker && <div className={art ? 'mt-5 hidden lg:block' : 'mt-5'}>{picker}</div>}
          </div>

          {panel ? (
            <div>
              {panel}
              {footer && <div className="mt-4 flex flex-wrap items-center gap-2 lg:justify-end">{footer}</div>}
            </div>
          ) : (price || actions) && (
            // Top right, as before: price, its badges, then Buy / Sell.
            <div className="lg:text-right lg:[&>div]:justify-end">
              {/* Phones: the price sits in its own row under the stats. */}
              {price?.label && (
                // Plain grey label, never the variant colour (owner, 2026-10-12:
                // a tinted label reads as an AI template).
                <p className={`${VALUE_LABEL} text-[12px]`}>{price.label}</p>
              )}
              {price?.value != null && (
                <p className="mt-1 text-[34px] font-bold leading-none tracking-[-0.02em] text-text-primary tabular-nums sm:text-[38px]">
                  {price.value}
                </p>
              )}
              {price?.children}
              {actions && <div className="mt-4">{actions}</div>}
              {/* Freshness, bottom right under the buttons (owner, 2026-10-12). */}
              {footer && <div className="mt-4 flex flex-wrap items-center gap-2">{footer}</div>}
            </div>
          )}
        </div>

      </div>

      {below}
    </div>
  )
}

/** Small status pill under a hero price (confidence, source, estimate). */
export function HeroBadge({
  color = 'var(--color-text-secondary)',
  children,
}: {
  color?: string
  children: ReactNode
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  )
}

/** Confidence key → short label (stat cells) + badge text + colour. One map. */
const CONFIDENCE: Record<string, { label: string; badge: string; color: string }> = {
  highly_accurate: { label: 'Highly Accurate', badge: 'Highly Accurate', color: 'var(--color-success)' },
  high: { label: 'High', badge: 'High Confidence', color: 'var(--color-success)' },
  medium: { label: 'Medium', badge: 'Medium Confidence', color: 'var(--color-warning)' },
  low: { label: 'Low', badge: 'Low Confidence', color: 'var(--color-text-secondary)' },
}

export function confidenceMeta(key: string | null | undefined) {
  return CONFIDENCE[key ?? ''] ?? CONFIDENCE.low
}

export function ConfidenceBadge({ confidence }: { confidence: string | null | undefined }) {
  const c = confidenceMeta(confidence)
  return <HeroBadge color={c.color}>{c.badge}</HeroBadge>
}

/**
 * Footprint of PriceTrendChart while its module (recharts) loads. Lives here,
 * not in the chart module, so importing it doesn't pull recharts in.
 */
export function TrendChartPlaceholder({ height = 200 }: { height?: number }) {
  return <div aria-hidden className={`${VALUE_SURFACE} animate-pulse`} style={{ height: height + 96 }} />
}
