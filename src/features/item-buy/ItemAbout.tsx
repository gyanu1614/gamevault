import Link from '@/components/navigation/AppLink'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { JsonLd, faqPage } from '@/lib/seo/jsonld'
import { cn } from '@/lib/utils'
import { ITEM_COLUMN, ITEM_H2 } from './layout'
import type { ItemAbout } from './model/about'
import { TraitMarks } from './TraitMarks'

/** Adopt Me's badges, in the order of the trait picker (tier, then potions). */
const BADGES = [
  { code: 'N', name: 'Neon', line: 'Four fully grown pets of the same kind, combined into one that glows.' },
  { code: 'M', name: 'Mega Neon', line: 'Four fully grown Neons combined. It cycles through colours.' },
  { code: 'F', name: 'Fly', line: 'A Fly Potion lets the pet fly.' },
  { code: 'R', name: 'Ride', line: 'A Ride Potion lets you ride the pet.' },
]

/**
 * The server-rendered end of the pet page. About and the buyer questions share
 * one layout (owner, 2026-11-03: compact but readable, not loose text): the title
 * centred on top, the content in a centred column below. The badge guide is
 * four small tiles with the game's real badges. Everything is in the
 * first HTML for search. The pet's name in the first sentence links its value
 * page as plain text — an internal link for search, never a button or a "see
 * the value" pitch (owner, 2026-11-02: buyers are not sent from the market to
 * values).
 */
export function ItemDetails({ about, itemName, valueHref }: { about: ItemAbout; itemName: string; valueHref: string | null }) {
  if (about.intro == null && !about.traitGuide) return null
  return (
    <section aria-labelledby="item-about">
      <h2 id="item-about" className={cn(ITEM_H2, 'text-center')}>
        {about.heading}
      </h2>
      <div className={cn(ITEM_COLUMN, 'space-y-5')}>
        {about.intro ? (
          <p className="text-center text-[15px] leading-relaxed text-text-secondary">
            {valueHref && about.intro.startsWith(itemName) ? <IntroWithLink intro={about.intro} itemName={itemName} href={valueHref} /> : about.intro}
          </p>
        ) : null}
        {about.traitGuide ? (
          <div>
            <h3 className="mb-2.5 text-center text-[15px] font-semibold text-text-primary">What The Badges Mean</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {BADGES.map((b) => (
                <li key={b.code} className="flex items-start gap-3 rounded-lg bg-[#1D1E23] p-3.5">
                  <TraitMarks code={b.code} size={24} className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-text-primary">{b.name}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-text-secondary">{b.line}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function IntroWithLink({ intro, itemName, href }: { intro: string; itemName: string; href: string }) {
  return (
    <>
      <Link href={href} className="text-inherit underline-offset-4 hover:underline">
        {itemName}
      </Link>
      {intro.slice(itemName.length)}
    </>
  )
}

/** Buyer questions: the same layout as About, with the house FAQ rows. */
export function ItemFaq({ title, about }: { title: string; about: ItemAbout }) {
  if (about.faq.length === 0) return null
  return (
    <section aria-labelledby="item-faq-title">
      <JsonLd data={faqPage(about.faq)} />
      <h2 id="item-faq-title" className={cn(ITEM_H2, 'text-center')}>
        {title}
      </h2>
      <FaqCards items={about.faq} className={ITEM_COLUMN} />
    </section>
  )
}
