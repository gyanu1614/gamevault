import Link from '@/components/navigation/AppLink'
import { FaqSection } from '@/components/marketplace/FaqCards'
import { JsonLd, faqPage } from '@/lib/seo/jsonld'
import { formatUsd } from '@/lib/value-listings/format'
import type { StockedItem } from '@/lib/value-listings/item-page'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { ItemAbout } from './model/about'

const H2 = 'mb-5 text-[20px] font-bold tracking-[-0.01em] text-text-primary sm:text-[24px]'

/** Adopt Me's badges, in the order of the trait picker (tier, then potions). */
const BADGES = [
  { code: 'N', name: 'Neon', line: 'Four fully grown pets of the same kind, combined into one that glows.' },
  { code: 'M', name: 'Mega Neon', line: 'Four fully grown Neons combined. It cycles through colours.' },
  { code: 'F', name: 'Fly', line: 'A Fly Potion lets the pet fly.' },
  { code: 'R', name: 'Ride', line: 'A Ride Potion lets you ride the pet.' },
]

/**
 * The server-rendered half of the pet page: About, buyer questions, more
 * pets. About is plain text on the page ground like Eldorado's (owner,
 * 2026-10-29: "simple title and text below it, small text"), no cards;
 * everything is in the first HTML for search.
 */
export function ItemDetails({ about }: { about: ItemAbout }) {
  if (about.intro == null && !about.traitGuide) return null
  return (
    <section aria-labelledby="item-about" className="mt-12 sm:mt-14">
      <h2 id="item-about" className={cn(H2, 'mb-3')}>
        {about.heading}
      </h2>
      <div className="space-y-5 leading-relaxed text-text-secondary" style={{ fontSize: 'var(--fs-body)' }}>
        {about.intro ? <p>{about.intro}</p> : null}
        {about.traitGuide ? (
          <div>
            <h3 className="font-semibold text-text-primary">What The Badges Mean</h3>
            <ul className="mt-1.5 space-y-1">
              {BADGES.map((b) => (
                <li key={b.code}>
                  <span className="font-semibold text-text-primary">
                    {b.name} ({b.code}).
                  </span>{' '}
                  {b.line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function ItemFaq({ title, about }: { title: string; about: ItemAbout }) {
  return (
    <>
      <JsonLd data={faqPage(about.faq)} />
      <FaqSection id="item-faq" title={title} items={about.faq} />
    </>
  )
}

/** Pet-to-pet links (similar pets when this one has none, related ones when it has some). */
export function StockedItemLinks({ id, heading, items }: { id: string; heading: string; items: StockedItem[] }) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby={id} className="mt-12 sm:mt-14">
      <h2 id={id} className={H2}>
        {heading}
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--gap-grid)' }}>
        {items.map((s) => (
          <li key={s.slug}>
            <Link href={s.href} className={cn('flex h-full items-center gap-3 rounded-lg p-3', MARKET_CARD, MARKET_CARD_HOVER)}>
              {s.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element -- catalogue art */
                <img src={s.imageUrl} alt="" aria-hidden width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-md object-contain" />
              ) : null}
              <span className="min-w-0">
                <span className="block truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
                  {s.name}
                </span>
                <span className="block tabular-nums text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
                  {s.count} {s.count === 1 ? 'Offer' : 'Offers'} from {formatUsd(s.minPriceUsd)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
