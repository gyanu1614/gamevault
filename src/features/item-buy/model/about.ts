/**
 * The words under the pet page (owner, 2026-10-27; plain About text like
 * Eldorado's, 2026-10-29): a few real buyer questions, the heading of the
 * pet-to-pet links, and either what the trait letters mean (Adopt Me: that title
 * alone, owner 2026-11-03) or one sentence on the item (rarity, release, where it
 * came from). Built from data only: a fact the database doesn't have is left out,
 * never guessed. Policy answers come from
 * the help centre (HELP_FAQ) so the refund rules live in one place.
 */
import { HELP_FAQ } from '@/lib/support/help-content'
import { withArticle } from '@/lib/text/article'
import { fromOrigin, type ItemFacts } from '@/lib/values/item-facts'
import { itemNoun } from './item-kind'

export interface AboutInput {
  gameSlug: string
  gameName: string
  itemName: string
  /** Display label ("Legendary"); null when the catalogue has none. */
  rarity: string | null
  facts: ItemFacts
}

export interface ItemAbout {
  heading: string
  /** "Garama is a Secret brainrot in Steal a Brainrot, released in 2025." Not on Adopt Me, which has the traits guide. */
  intro: string | null
  /** Adopt Me: explain the F / R / N / M badges. */
  traitGuide: boolean
  /** "Adopt Me Parrot FAQ". */
  faqHeading: string
  faq: { q: string; a: string }[]
  relatedHeading: string
}

function helpAnswer(id: string): string {
  const faq = HELP_FAQ.find((f) => f.id === id)
  if (!faq) throw new Error(`HELP_FAQ has no "${id}"`)
  return faq.a
}

/** "released in 2019" or "released on 27 October 2022". */
function releasedPhrase(released: string): string {
  return `released ${/^\d{4}$/.test(released) ? 'in' : 'on'} ${released}`
}

/** Whether the page shows the sentence built from the item's facts; Adopt Me doesn't, so it skips that read. */
export function usesItemFacts(gameSlug: string): boolean {
  return gameSlug !== 'adopt-me'
}

export function itemAbout(input: AboutInput): ItemAbout {
  const { gameSlug, gameName, itemName, rarity, facts } = input
  const noun = itemNoun(gameSlug)
  const isAdoptMe = gameSlug === 'adopt-me'

  const known = usesItemFacts(gameSlug) && (rarity != null || facts.released != null || facts.origin != null)
  const intro = known
    ? [
        `${itemName} is ${withArticle(rarity ? `${rarity} ${noun.one}` : noun.one)} in ${gameName}${facts.released ? `, ${releasedPhrase(facts.released)}` : ''}.`,
        ...(facts.origin ? [`It came ${fromOrigin(facts.origin)}.`] : []),
      ].join(' ')
    : null

  const faq = [
    {
      q: `Is it safe to buy ${withArticle(itemName)} on DropMarket?`,
      a: `Yes. Every order is covered by SafeDrop Protection at no extra cost. If your ${itemName} does not arrive, or it is not what the listing described, you get your money back in full.`,
    },
    {
      q: `How do I get my ${itemName} after paying?`,
      a: `The seller contacts you in the order chat and hands the ${itemName} over to you in ${gameName}. Check the ${noun.one} before you confirm the order.`,
    },
    { q: 'What if the seller doesn’t deliver?', a: helpAnswer('late-order') },
    ...(isAdoptMe
      ? [
          {
            q: `What do F, R, N and M mean on ${withArticle(itemName)}?`,
            a: `F is Fly and R is Ride: potions that let the pet fly or be ridden. N is Neon, made by combining four fully grown pets of the same kind, and M is Mega Neon, made from four fully grown Neons. An NFR ${itemName} is a Neon ${itemName} with both potions.`,
          },
        ]
      : []),
  ]

  return {
    heading: isAdoptMe ? `${gameName} Traits Explained` : `About ${gameName} ${itemName}`,
    intro,
    traitGuide: isAdoptMe,
    faqHeading: `${gameName} ${itemName} FAQ`,
    faq,
    relatedHeading: `Popular ${gameName} ${noun.many}`,
  }
}
