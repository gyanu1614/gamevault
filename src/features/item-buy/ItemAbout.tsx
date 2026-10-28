import Link from '@/components/navigation/AppLink'
import { FaqSection } from '@/components/marketplace/FaqCards'
import { JsonLd, faqPage } from '@/lib/seo/jsonld'
import { formatUsd } from '@/lib/value-listings/format'
import type { StockedItem } from '@/lib/value-listings/item-page'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'
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
 * The server-rendered half of the pet page (owner, 2026-10-27): details,
 * the badge guide, buyer questions. Plain cards on the page ground, nothing
 * nested; everything is in the first HTML for search.
 */
export function ItemDetails({ about }: { about: ItemAbout }) {
  const hasFacts = about.intro != null || about.facts.length > 0
  if (!hasFacts && !about.traitGuide) return null
  return (
    <section aria-labelledby="item-details" className="mt-12 sm:mt-14">
      <h2 id="item-details" className={H2}>
        {about.heading}
      </h2>
      <div className={cn('grid', hasFacts && about.traitGuide && 'lg:grid-cols-2')} style={{ gap: 'var(--gap-grid)' }}>
        {hasFacts ? (
          <div className={cn('rounded-lg p-5 sm:p-6', MARKET_CARD)}>
            {about.intro ? (
              <p className="text-text-secondary" style={{ fontSize: 'var(--fs-body)' }}>
                {about.intro}
              </p>
            ) : null}
            {about.facts.length > 0 ? (
              <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3', about.intro && 'mt-5')}>
                {about.facts.map((f) => (
                  <div key={f.label} className="min-w-0">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
                      {f.label}
                    </dt>
                    <dd className="mt-1 font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}
        {about.traitGuide ? (
          <div className={cn('rounded-lg p-5 sm:p-6', MARKET_CARD)}>
            <h3 className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)' }}>
              What The Badges Mean
            </h3>
            <ul className="mt-4 space-y-3.5">
              {BADGES.map((b) => (
                <li key={b.code} className="flex items-start gap-3">
                  <TraitMarks code={b.code} size={22} className="mt-px shrink-0" />
                  <p className="text-text-secondary" style={{ fontSize: 'var(--fs-body)' }}>
                    <span className="font-semibold text-text-primary">{b.name}.</span> {b.line}
                  </p>
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
