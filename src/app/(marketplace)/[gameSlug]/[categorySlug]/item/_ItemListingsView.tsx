import Link from 'next/link'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { cn } from '@/lib/utils'
import { ValueOfferGrid } from '@/components/value-listings/ValueOfferGrid'
import { TrackOnMount } from '@/components/value-listings/TrackOnMount'
import { formatUsd } from '@/lib/value-listings/format'
import type { loadItemListingsPage } from '../_valueItemOffers'

type Data = NonNullable<Awaited<ReturnType<typeof loadItemListingsPage>>>

/**
 * Item listings page body (Bundle 2): filtered on the server, so the first
 * HTML already shows only this item (and variant). With nothing to show it
 * never renders an empty page: one line, then other variants, then similar
 * items, then the sell / browse actions.
 */
export function ItemListingsView({ gameSlug, data }: { gameSlug: string; data: Data }) {
  const { pair, catalog, model, offers, otherOffers } = data
  const { item, fullName, fallback } = model
  const browseHref = `/${gameSlug}/${pair.categorySlug}`
  const sellHref = `/${gameSlug}/sell?src=item-buy-page`
  const valueHref = item.hasPage === false ? null : `/${gameSlug}/values/${item.slug}`
  const showVariantChips = model.variantsInStock.length > 0 && catalog.catalog.variants.length > 0

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={`/${gameSlug}`} className="hover:text-text-primary">{pair.gameName}</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={browseHref} className="hover:text-text-primary">Buy Items</Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-text-secondary" aria-current="page">{fullName}</li>
        </ol>
      </nav>

      <header className="mb-6 flex items-center gap-3.5 sm:gap-5">
        {item.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- catalogue art from storage, same as the value pages */
          <img
            src={item.imageUrl}
            alt={item.name}
            width={72}
            height={72}
            loading="eager"
            className="h-16 w-16 shrink-0 rounded-lg bg-bg-raised object-contain sm:h-[72px] sm:w-[72px]"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1
            className="text-balance break-words text-text-primary"
            style={{ fontSize: 'var(--fs-page-title)', lineHeight: 1.05, fontWeight: 'var(--fw-heading)', letterSpacing: '-0.02em' }}
          >
            Buy {fullName}
          </h1>
          <p className="mt-2 text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
            {model.results.length > 0 ? (
              <>
                {model.results.length} {model.results.length === 1 ? 'listing' : 'listings'} from{' '}
                <span className="font-semibold text-text-primary tabular-nums">{formatUsd(model.minPriceUsd!)}</span>. Every order covered by SafeDrop Protection.
              </>
            ) : (
              <>No {fullName} listed right now.</>
            )}
          </p>
          {valueHref ? (
            <Link href={valueHref} className="mt-1.5 inline-flex items-center gap-1 font-semibold text-lime-text hover:underline" style={{ fontSize: 'var(--fs-meta)' }}>
              See {item.name} Value
              <ArrowForwardIcon sx={{ fontSize: 15 }} />
            </Link>
          ) : null}
        </div>
      </header>

      {showVariantChips ? (
        <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="navigation" aria-label="Variants">
          <ul className="flex gap-2">
            <li>
              <Chip href={model.canonicalPath} active={!model.variant} label="All" />
            </li>
            {model.variantsInStock.map((v) => (
              <li key={v.variant}>
                <Chip href={v.href} active={model.variant === v.variant} label={v.label} price={formatUsd(v.minPriceUsd)} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {model.results.length > 0 ? (
        <ValueOfferGrid
          offers={offers}
          gameSlug={gameSlug}
          gameName={pair.gameName}
          surface="item_buy"
          itemSlug={item.slug}
          variant={model.variant}
        />
      ) : fallback ? (
        <div className="space-y-10">
          <TrackOnMount event={{ event: 'fallback_shown', surface: 'item_buy', game: gameSlug, item: item.slug, variant: model.variant }} />

          {fallback.otherVariants.length > 0 ? (
            <section aria-labelledby="other-variants">
              <h2 id="other-variants" className="mb-4 font-bold text-text-primary" style={{ fontSize: 'var(--fs-section)' }}>
                Other Variants
              </h2>
              <ValueOfferGrid
                offers={otherOffers}
                gameSlug={gameSlug}
                gameName={pair.gameName}
                surface="item_buy"
                itemSlug={item.slug}
                variant={null}
              />
              {model.stock && model.stock.total > otherOffers.length ? (
                <Link href={model.canonicalPath} className="mt-4 inline-flex items-center gap-1 font-semibold text-text-primary hover:underline" style={{ fontSize: 'var(--fs-meta)' }}>
                  View All {model.stock.total}
                  <ArrowForwardIcon sx={{ fontSize: 15 }} />
                </Link>
              ) : null}
            </section>
          ) : null}

          {fallback.similar.length > 0 ? (
            <section aria-labelledby="similar-items">
              <h2 id="similar-items" className="mb-4 font-bold text-text-primary" style={{ fontSize: 'var(--fs-section)' }}>
                Similar Items
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--gap-grid)' }}>
                {fallback.similar.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={s.href}
                      className="flex h-full items-center gap-3 rounded-lg bg-bg-raised p-3 transition-colors hover:bg-bg-raised-hover active:scale-[0.99]"
                    >
                      {s.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- catalogue art */
                        <img src={s.imageUrl} alt={s.name} aria-hidden width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-md object-contain" />
                      ) : null}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-meta)' }}>{s.name}</span>
                        <span className="block text-text-secondary tabular-nums" style={{ fontSize: 'var(--fs-meta)' }}>
                          {s.count} listed, from {formatUsd(s.minPriceUsd)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={sellHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-lime px-5 font-bold text-text-inverse transition-colors hover:bg-lime-hover active:bg-lime-pressed"
              style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
            >
              Sell Yours For Cash
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Link>
            <Link
              href={browseHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white/[0.07] px-5 font-semibold text-text-primary transition-colors hover:bg-white/[0.11]"
              style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
            >
              Browse All {pair.gameName} Items
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function Chip({ href, active, label, price }: { href: string; active: boolean; label: string; price?: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors',
        active ? 'bg-lime text-text-inverse' : 'bg-bg-raised-hover text-text-secondary hover:bg-white/[0.12] hover:text-text-primary',
      )}
    >
      {label}
      {price ? <span className={cn('tabular-nums', active ? 'opacity-80' : 'text-text-tertiary')}>{price}</span> : null}
    </Link>
  )
}
