import Link from '@/components/navigation/AppLink'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { TITLE_GAP } from '@/components/marketplace/page-scale'
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
 * The server-rendered end of the pet page, the title centred on top and the
 * content in a centred column below (owner, 2026-11-03: compact but readable).
 * Adopt Me: one title over four tiles with the game's real badges. Other games:
 * About with one sentence, whose item name links its value page as plain text —
 * an internal link for search, never a button or a "see the value" pitch (owner,
 * 2026-11-02: buyers are not sent from the market to values). Everything is in
 * the first HTML for search.
 */
export function ItemDetails({ about, itemName, valueHref }: { about: ItemAbout; itemName: string; valueHref: string | null }) {
  if (about.intro == null && !about.traitGuide) return null
  return (
    <section aria-labelledby="item-about">
      <h2 id="item-about" className={cn(ITEM_H2, 'text-center')}>
        {about.heading}
      </h2>
      {about.intro ? (
        <p className={cn('mx-auto max-w-3xl text-center text-[14px] leading-relaxed text-text-secondary', TITLE_GAP)}>
          {valueHref && about.intro.startsWith(itemName) ? <IntroWithLink intro={about.intro} itemName={itemName} href={valueHref} /> : about.intro}
        </p>
      ) : null}
      {about.traitGuide ? (
        <ul className={cn(ITEM_COLUMN, 'grid gap-4 sm:grid-cols-2')}>
          {BADGES.map((b) => (
            <li key={b.code} className="flex items-start gap-3 rounded-lg bg-[#1D1E23] p-4 lg:bg-[#24252B]">
              <TraitMarks code={b.code} size={24} className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-text-primary">{b.name}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-text-secondary">{b.line}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
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
export function ItemFaq({ about }: { about: ItemAbout }) {
  if (about.faq.length === 0) return null
  return (
    <section aria-labelledby="item-faq-title">
      <JsonLd data={faqPage(about.faq)} />
      <h2 id="item-faq-title" className={cn(ITEM_H2, 'text-center')}>
        {about.faqHeading}
      </h2>
      <FaqCards raised items={about.faq} className={cn(ITEM_COLUMN, 'space-y-3')} />
    </section>
  )
}
