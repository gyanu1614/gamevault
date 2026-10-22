import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { LightbulbIcon } from '@phosphor-icons/react/dist/ssr/Lightbulb'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass'
import { NewTag } from '@/components/values/NewTag'
import { ValueCallout } from '@/components/values/ValueCallout'
import { formatUsd } from '@/lib/value-listings/format'
import type { SellItem } from '@/lib/sell/sell-items'
import type { SellCategory } from './_sellData'

/**
 * The data sections of /[game]/sell (values platform Step E). Each renders
 * only when its data exists, so a page shows what is true for its game: the
 * items players sell and what they sell for, live offers, player numbers.
 * Server components, no client JS; the page's forest palette.
 */

const H2 = 'text-center text-heading font-bold tracking-tight text-[#F2F6F0]'
const SUB = 'mt-2 text-center text-[13.5px] text-[#98A398] text-balance'
const SURFACE = 'border border-[#1A211A] bg-[#0B0F0C]/60 backdrop-blur-md'
const count = (n: number) => n.toLocaleString('en-US')

/** Players online at the last check and this week's peak (Roblox, trend radar). */
export function SellPlayers({ players }: { players: { playingNow: number | null; peak7d: number | null } }) {
  const stats = [
    players.playingNow ? { label: 'Players Online', value: count(players.playingNow) } : null,
    players.peak7d ? { label: 'Peak This Week', value: count(players.peak7d) } : null,
  ].filter((s): s is { label: string; value: string } => s != null)
  return (
    <dl className={`mx-auto mt-10 grid max-w-md divide-x divide-white/[0.07] ${SURFACE}`} style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
      {stats.map((s) => (
        <div key={s.label} className="px-4 py-3.5 text-center">
          <dd className="text-[22px] font-bold tabular-nums leading-none text-[#F1F3F1]">{s.value}</dd>
          <dt className="mt-1.5 text-[12.5px] text-[#98A398]">{s.label}</dt>
        </div>
      ))}
    </dl>
  )
}

function SellItemTile({ item, defaultForm }: { item: SellItem; defaultForm: string | null }) {
  return (
    <Link
      href={item.href}
      className="group relative flex flex-col items-center border border-[#1A211A] bg-[#0E1310] px-3 pb-3.5 pt-5 text-center transition-colors hover:border-[#2A352B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      {item.isNew && (
        <span className="absolute left-2 top-2">
          <NewTag />
        </span>
      )}
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- catalogue art, already 512px WebP
        <img src={item.imageUrl} alt={item.name} width={88} height={88} loading="lazy" decoding="async" className="h-[72px] w-[72px] object-contain sm:h-[88px] sm:w-[88px]" />
      ) : (
        <span aria-hidden className="h-[72px] w-[72px] bg-[#151B15] sm:h-[88px] sm:w-[88px]" />
      )}
      <p className="mt-3 line-clamp-1 w-full text-[13.5px] font-semibold text-[#E4EAE2]">{item.name}</p>
      {item.form && item.form !== defaultForm && <p className="text-[11.5px] text-[#7E8A80]">{item.form}</p>}
      <p className="mt-1 text-[13px] text-[#98A398]">
        {item.priceUsd != null ? (
          <>
            Sells For <span className="font-semibold tabular-nums text-[#8FBF9C]">{formatUsd(item.priceUsd)}</span>
          </>
        ) : (
          'No Trades Yet'
        )}
      </p>
    </Link>
  )
}

/** A titled grid of sell tiles: 2 per row on phones, 4 on desktop. */
export function SellItemGrid({ title, sub, items, defaultForm }: { title: string; sub?: string; items: SellItem[]; defaultForm: string | null }) {
  if (items.length === 0) return null
  return (
    <section className="mx-auto mt-16 max-w-5xl">
      <h2 className={H2}>{title}</h2>
      {sub && <p className={SUB}>{sub}</p>}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((i) => (
          <SellItemTile key={i.slug} item={i} defaultForm={defaultForm} />
        ))}
      </div>
    </section>
  )
}

/** A plain GET form to the values list, which reads ?q= after hydration. No JS here. */
export function CheckYourPrice({ gameSlug, name, noun, pricedCount, accent }: { gameSlug: string; name: string; noun: string; pricedCount: number; accent: string }) {
  return (
    <section className="mx-auto mt-16 max-w-2xl">
      <h2 className={H2}>
        What Are Your {name} {noun} Worth?
      </h2>
      <p className={SUB}>
        Search {count(pricedCount)} priced {noun.toLowerCase()} and see today&apos;s price before you list.
      </p>
      <form action={`/${gameSlug}/values`} method="get" role="search" className="mt-6 flex gap-2">
        <label htmlFor="sell-check-price" className="sr-only">
          Search {name} {noun.toLowerCase()}
        </label>
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlassIcon aria-hidden size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B776D]" />
          {/* 16px text: no zoom on focus on iPhone. */}
          <input
            id="sell-check-price"
            name="q"
            type="search"
            required
            autoComplete="off"
            placeholder={`Search ${noun.toLowerCase()}`}
            className="h-12 w-full border border-[#1E2723] bg-[#0B0F0C] pl-10 pr-3 text-base text-[#F1F3F1] placeholder:text-[#6B776D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </div>
        <button
          type="submit"
          className="h-12 shrink-0 px-5 text-[14px] font-semibold text-[#08110B] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:scale-[0.99]"
          style={{ background: accent }}
        >
          Check Price
        </button>
      </form>
    </section>
  )
}

/**
 * The game's categories as rows: live offers and the lowest price where there
 * are some ("Selling Now"), else what can be listed, with one tip line.
 */
export function SellCategories({ gameSlug, name, categories }: { gameSlug: string; name: string; categories: SellCategory[] }) {
  if (categories.length === 0) return null
  const live = categories.some((c) => c.count > 0)
  const rows = [...categories].sort((a, b) => b.count - a.count)
  return (
    <section className="mx-auto mt-16 max-w-3xl">
      <h2 className={H2}>{live ? `${name} Selling Now On DropMarket` : `What You Can Sell In ${name}`}</h2>
      <div className={`mt-6 ${SURFACE}`}>
        {rows.map((c) => (
          <Link
            key={c.id}
            href={`/${gameSlug}/${c.slug}`}
            className="group flex items-center justify-between gap-4 border-t border-white/[0.07] px-5 py-3.5 transition-colors first:border-t-0 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
          >
            <span className="min-w-0 truncate text-[14.5px] font-semibold text-[#F1F3F1]">{c.name}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-[13.5px] tabular-nums text-[#98A398]">
              {c.count > 0 ? (
                <>
                  {count(c.count)} {c.count === 1 ? 'Offer' : 'Offers'}
                  {c.fromUsd != null && (
                    <>
                      {' · From '}
                      <span className="font-semibold text-[#8FBF9C]">{formatUsd(c.fromUsd)}</span>
                    </>
                  )}
                </>
              ) : (
                'No Offers Yet'
              )}
              <ArrowRightIcon aria-hidden size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
      {!live && (
        <ValueCallout tone="yellow" icon={LightbulbIcon} title="No Sellers Yet" className="mt-3">
          List first and yours is the offer every {name} buyer sees.
        </ValueCallout>
      )}
    </section>
  )
}
