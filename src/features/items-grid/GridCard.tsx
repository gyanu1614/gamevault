import Link from '@/components/navigation/AppLink'
import { IconChevronRight, IconSparkles } from '@tabler/icons-react'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { GridItem } from './model/grid'
import { NotifyMeButton } from './NotifyMeButton'

/** Form chips shown before "+N" (the item page lists them all). */
const MAX_FORMS = 3

/**
 * One catalogue item on the Items page (owner, 2026-10-24: design C, no Buy
 * button). The listing card's shape and surfaces (ItemCard): text left
 * (rarity, name, chips), the picture right, a footer strip one step lighter
 * with "From $X". The item NAME is the link and stretches over the whole card,
 * so the anchor text crawlers read is the item name; hover lightens in place,
 * nothing moves. Nobody sells it yet: Notify Me (in-stock email) sits above
 * the stretched link.
 */
export function GridCard({ item, gameSlug }: { item: GridItem; gameSlug: string }) {
  const inStock = item.offers > 0 && item.minPrice != null
  const shown = item.forms.slice(0, MAX_FORMS)
  const more = item.forms.length - shown.length

  return (
    <article className={cn('group relative flex h-full flex-col overflow-hidden rounded-lg', MARKET_CARD, MARKET_CARD_HOVER)}>
      <div className="flex flex-1 items-stretch gap-4" style={{ padding: 'var(--gap-card)' }}>
        <div className="flex min-w-0 flex-1 flex-col">
          {item.rarityLabel && (
            <span className="font-medium" style={{ fontSize: 'var(--fs-meta)', color: item.rarityColor ?? undefined }}>
              {item.rarityLabel}
            </span>
          )}
          <h3 className="mt-1 line-clamp-2 text-text-primary" style={{ fontSize: 'var(--fs-card-title)', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 'var(--lh-card-title)' }}>
            <Link
              href={item.href}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-focus-soft"
            >
              {item.name}
            </Link>
          </h3>
          {(item.isNew || shown.length > 0) && (
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
              {item.isNew && (
                <span className="inline-flex h-6 items-center gap-1 rounded bg-lime-tint-bg px-2 text-[11.5px] font-semibold text-lime-text">
                  <IconSparkles aria-hidden size={12} stroke={2} />
                  New
                </span>
              )}
              {shown.map((f) => (
                <span key={f} className="inline-flex h-6 items-center rounded bg-white/[0.06] px-2 text-[11.5px] font-semibold text-text-secondary">
                  {f}
                </span>
              ))}
              {more > 0 && <span className="text-[11.5px] font-semibold text-text-tertiary">+{more}</span>}
            </div>
          )}
        </div>
        <div className="grid aspect-square w-[88px] shrink-0 place-items-center self-start overflow-hidden rounded-md bg-white/[0.03] sm:w-24">
          {item.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={item.imageUrl} alt={item.name} width={88} height={88} loading="lazy" decoding="async" className="h-[78%] w-[78%] object-contain" />
          ) : (
            <span className="font-medium uppercase tracking-wider text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
              No image
            </span>
          )}
        </div>
      </div>

      {/* Footer strip, as on the listing card: one step lighter, lightens again on hover. */}
      <div
        className="flex items-center justify-between gap-3 bg-[#24252B] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors group-hover:bg-[#2A2B31]"
        style={{ minHeight: '52px', padding: 'calc(var(--gap-card) * 0.55) var(--gap-card)' }}
      >
        {inStock ? (
          <>
            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
                From
              </span>
              <span className="tabular-nums text-text-primary" style={{ fontSize: 'var(--fs-price)', fontWeight: 'var(--fw-heading)' }}>
                ${formatStatPrice(item.minPrice!)}
              </span>
            </span>
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap tabular-nums text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
              {item.offers} {item.offers === 1 ? 'Offer' : 'Offers'}
              <IconChevronRight aria-hidden size={15} stroke={2} />
            </span>
          </>
        ) : (
          <>
            <span className="text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
              No Offers Yet
            </span>
            <NotifyMeButton gameSlug={gameSlug} itemSlug={item.slug} itemName={item.name} />
          </>
        )}
      </div>
    </article>
  )
}
