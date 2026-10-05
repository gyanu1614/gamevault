import type { ReactNode, Ref } from 'react'
import { ValueArt } from './ValueArt'
import { StatRow } from './HubSection'
import { VALUE_LABEL, VALUE_SURFACE } from './styles'

/**
 * The ONE item-page hero for every values hub (Steal a Brainrot, Adopt Me and
 * the generic values_* pipeline). Game differences come in through props and
 * slots: SAB passes its mutation grid as `picker`, Adopt Me its tier/potion
 * picker, the generic page neither. Layout: art · identity + stat rows ·
 * price column with the Buy/Sell pair, an optional footer band, then the
 * picker panel and anything `below` (the price chart).
 *
 * No hooks, so the server-rendered generic page can use it directly.
 */
export function ValueItemHero({
  anchorRef,
  accent,
  art,
  eyebrow,
  title,
  titleAs: Title = 'h1',
  meta,
  stats,
  price,
  actions,
  footer,
  picker,
  below,
}: {
  /** Scroll target (heroes scroll back into view after a phone pick). */
  anchorRef?: Ref<HTMLDivElement>
  /** Per-item accent (mutation / variant colour): glow + eyebrow. */
  accent?: string
  /** `caption`: a small line under the art (e.g. a CC-BY-SA image credit). */
  art?: { src: string | null; alt: string; pixelated?: boolean; caption?: ReactNode } | null
  eyebrow?: ReactNode
  title: ReactNode
  titleAs?: 'h1' | 'h2'
  /** Small line under the title (rarity · availability). */
  meta?: ReactNode
  stats?: ReadonlyArray<{ label: string; value: ReactNode }>
  price?: {
    label?: ReactNode
    labelColor?: string
    value?: ReactNode
    /** Lines under the headline: freshness, secondary price, badges. */
    children?: ReactNode
  }
  /** Usually ValueBuyActions. */
  actions?: ReactNode
  /** Full-width band at the bottom of the card. */
  footer?: ReactNode
  /** Variant / mutation picker, rendered in its own panel under the card. */
  picker?: ReactNode
  below?: ReactNode
}) {
  return (
    <div className="space-y-4">
      <div ref={anchorRef} className={`relative scroll-mt-20 overflow-hidden ${VALUE_SURFACE}`}>
        {accent && (
          <div
            aria-hidden
            className="pointer-events-none absolute -left-1/4 -top-1/2 h-[150%] w-[80%] rounded-full opacity-80 blur-3xl"
            style={{ background: `radial-gradient(closest-side, ${accent}1F, transparent)` }}
          />
        )}

        <div
          className={`relative grid gap-5 p-5 sm:p-6 lg:items-center ${
            art ? 'lg:grid-cols-[176px_minmax(0,1fr)_260px]' : 'lg:grid-cols-[minmax(0,1fr)_280px]'
          }`}
        >
          {art && (
            <div
              className="mx-auto flex flex-col items-center justify-center lg:mx-0"
              style={accent ? { background: `radial-gradient(closest-side, ${accent}1F, transparent 72%)` } : undefined}
            >
              <ValueArt src={art.src} alt={art.alt} size={168} pixelated={art.pixelated} priority />
              {art.caption && (
                <div className="mt-2 max-w-[176px] text-center text-[10.5px] leading-snug text-text-tertiary">{art.caption}</div>
              )}
            </div>
          )}

          <div className="min-w-0">
            {eyebrow && (
              <p
                className={`flex items-center gap-1.5 text-[12px] font-semibold ${accent ? '' : 'text-text-tertiary'}`}
                style={accent ? { color: accent } : undefined}
              >
                {eyebrow}
              </p>
            )}
            <Title className="mt-1.5 text-2xl font-semibold leading-[1.1] tracking-[-0.015em] text-text-primary sm:text-[28px]">
              {title}
            </Title>
            {meta && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-semibold">{meta}</p>
            )}
            {stats && stats.length > 0 && (
              <dl className="mt-4">
                {stats.map((s) => (
                  <StatRow key={s.label} label={s.label} value={s.value} />
                ))}
              </dl>
            )}
          </div>

          {(price || actions) && (
            <div className="lg:text-right">
              {price?.label && (
                <p
                  className={`${VALUE_LABEL} text-[12px]`}
                  style={price.labelColor ? { color: price.labelColor } : undefined}
                >
                  {price.label}
                </p>
              )}
              {price?.value != null && (
                <p className="mt-1 text-[34px] font-bold leading-none tracking-[-0.02em] text-text-primary tabular-nums sm:text-[38px]">
                  {price.value}
                </p>
              )}
              {price?.children}
              {actions && <div className="mt-4">{actions}</div>}
            </div>
          )}
        </div>

        {footer && (
          <div className="relative flex items-center justify-center border-t border-white/[0.07] px-5 py-3 text-center">
            {footer}
          </div>
        )}
      </div>

      {picker && <div className={`${VALUE_SURFACE} p-4 sm:p-5`}>{picker}</div>}
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
