import Link from '@/components/navigation/AppLink'
import { IconSparkles } from '@tabler/icons-react'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { TraitMarks } from '@/features/item-buy/TraitMarks'
import type { GridItem } from './model/grid'
import { ItemPicture } from './ItemPicture'
import { NotifyMeButton } from './NotifyMeButton'

/** Forms shown before "+N" (the item page lists them all). */
const MAX_FORMS = 3

/**
 * One catalogue item on the Items page. Picture on top, then rarity, name,
 * the forms in stock and the price (owner, 2026-11-02, Eldorado's item grid
 * as the reference: two to a row on phones, four on wide screens). Adopt Me
 * forms are the game's own N / M / F / R badges, as on the pet page; other
 * games keep a short text chip. The item NAME is the link and stretches over
 * the whole card, so the anchor text crawlers read is the item name; hover
 * lightens in place, nothing moves. Nobody sells it yet: Notify Me (in-stock
 * email) sits above the stretched link.
 */
export function GridCard({ item, gameSlug }: { item: GridItem; gameSlug: string }) {
  const inStock = item.offers > 0 && item.minPrice != null
  const shown = item.forms.slice(0, MAX_FORMS)
  const more = item.forms.length - shown.length
  const badges = gameSlug === 'adopt-me'

  return (
    <article className={cn('group relative flex h-full flex-col overflow-hidden rounded-lg', MARKET_CARD, MARKET_CARD_HOVER)}>
      <div className="p-2 pb-0 sm:p-2.5 sm:pb-0">
        <div className="relative grid h-[112px] place-items-center overflow-hidden rounded-md bg-white/[0.04] transition-colors group-hover:bg-white/[0.06] sm:h-[136px]">
          <ItemPicture src={item.imageUrl} name={item.name} />
          {item.isNew && (
            <span className="absolute left-2 top-2 inline-flex h-6 items-center gap-1 rounded bg-lime-tint-bg px-2 text-[11.5px] font-semibold text-lime-text">
              <IconSparkles aria-hidden size={12} stroke={2} />
              New
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
        {item.rarityLabel && (
          <span className="font-medium" style={{ fontSize: 'var(--fs-meta)', color: item.rarityColor ?? undefined }}>
            {item.rarityLabel}
          </span>
        )}
        <h3 className="mt-0.5 line-clamp-2 font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)', letterSpacing: '-0.01em', lineHeight: 'var(--lh-card-title)' }}>
          <Link
            href={item.href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-focus-soft"
          >
            {item.name}
          </Link>
        </h3>
        {shown.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {shown.map((f) =>
              badges ? (
                <TraitMarks key={f} code={f} size={18} />
              ) : (
                <span key={f} className="inline-flex h-6 items-center rounded bg-white/[0.06] px-2 text-[11.5px] font-semibold text-text-secondary">
                  {f}
                </span>
              ),
            )}
            {more > 0 && <span className="text-[11.5px] font-semibold text-text-tertiary">+{more}</span>}
          </div>
        )}

        <div className="mt-auto pt-3">
          {inStock ? (
            <div className="flex items-end justify-between gap-2">
              <span className="flex min-w-0 flex-col">
                <span className="text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
                  From
                </span>
                <span className="tabular-nums leading-tight text-text-primary" style={{ fontSize: 'var(--fs-price)', fontWeight: 'var(--fw-heading)' }}>
                  ${formatStatPrice(item.minPrice!)}
                </span>
              </span>
              <span className="whitespace-nowrap pb-0.5 tabular-nums text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
                {item.offers} {item.offers === 1 ? 'Offer' : 'Offers'}
              </span>
            </div>
          ) : (
            <>
              <span className="block text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
                No Offers Yet
              </span>
              <NotifyMeButton gameSlug={gameSlug} itemSlug={item.slug} itemName={item.name} className="mt-2 w-full justify-center" />
            </>
          )}
        </div>
      </div>
    </article>
  )
}
