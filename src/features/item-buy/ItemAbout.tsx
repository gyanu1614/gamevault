import { FaqSection } from '@/components/marketplace/FaqCards'
import { JsonLd, faqPage } from '@/lib/seo/jsonld'
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
