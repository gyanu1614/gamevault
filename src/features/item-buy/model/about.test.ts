import { describe, expect, it } from 'vitest'
import { HELP_FAQ } from '@/lib/support/help-content'
import { NO_FACTS } from '@/lib/values/item-facts'
import { itemAbout, usesItemFacts } from './about'

const parrot = {
  gameSlug: 'adopt-me',
  gameName: 'Adopt Me',
  itemName: 'Parrot',
  rarity: 'Legendary',
  facts: { released: '2019', origin: 'Jungle Egg', howToGet: null },
}

describe('itemAbout', () => {
  it('Adopt Me pet: one title over the traits guide, no sentence, a real FAQ title and four questions', () => {
    const a = itemAbout(parrot)
    expect(a.heading).toBe('Adopt Me Traits Explained')
    expect(a.intro).toBeNull()
    expect(a.traitGuide).toBe(true)
    expect(a.faqHeading).toBe('Adopt Me Parrot FAQ')
    expect(a.faq.map((f) => f.q)).toEqual([
      'Is it safe to buy a Parrot on DropMarket?',
      'How do I get my Parrot after paying?',
      'What if the seller doesn’t deliver?',
      'What do F, R, N and M mean on a Parrot?',
    ])
    expect(a.relatedHeading).toBe('Popular Adopt Me Pets')
  })

  it('the late-delivery answer is the help centre’s, word for word', () => {
    const late = HELP_FAQ.find((f) => f.id === 'late-order')!
    expect(itemAbout(parrot).faq[2].a).toBe(late.a)
  })

  it('"an" before a vowel in the questions', () => {
    const a = itemAbout({ ...parrot, itemName: 'Owl' })
    expect(a.faq[0].q).toBe('Is it safe to buy an Owl on DropMarket?')
    expect(a.faq[3].q).toBe('What do F, R, N and M mean on an Owl?')
  })

  // Adopt Me shows no sentence, so it needs no facts read: one query saved per page.
  it('only games that show the sentence read the item facts', () => {
    expect(usesItemFacts('adopt-me')).toBe(false)
    expect(usesItemFacts('murder-mystery-2')).toBe(true)
  })

  const sab = { gameSlug: 'steal-a-brainrot', gameName: 'Steal a Brainrot', itemName: 'Garama', rarity: 'Secret', facts: NO_FACTS }

  it('other games: no traits guide, their own noun, About with one sentence', () => {
    const a = itemAbout(sab)
    expect(a.traitGuide).toBe(false)
    expect(a.faq).toHaveLength(3)
    expect(a.heading).toBe('About Steal a Brainrot Garama')
    expect(a.intro).toBe('Garama is a Secret brainrot in Steal a Brainrot.')
    expect(a.faqHeading).toBe('Steal a Brainrot Garama FAQ')
    expect(a.relatedHeading).toBe('Popular Steal a Brainrot Brainrots')
  })

  it('a full release date reads "released on"; "an" before a vowel', () => {
    const a = itemAbout({ ...sab, rarity: 'Ultra-Rare', facts: { ...NO_FACTS, released: '27 October 2022' } })
    expect(a.intro).toBe('Garama is an Ultra-Rare brainrot in Steal a Brainrot, released on 27 October 2022.')
  })

  it('missing facts are left out, never guessed', () => {
    expect(itemAbout({ ...sab, rarity: null }).intro).toBeNull()
  })

  it('no rarity but an origin: says what is known', () => {
    expect(itemAbout({ ...sab, rarity: null, facts: { ...NO_FACTS, origin: 'Admin Abuse events' } }).intro).toBe('Garama is a brainrot in Steal a Brainrot. It came from Admin Abuse events.')
  })
})

describe('itemAbout — eggs and potions', () => {
  const egg = { ...parrot, itemName: 'Crystal Egg', rarity: null, kind: 'egg' as const }

  it('an egg: its own line, no traits guide, no question about traits', () => {
    const a = itemAbout(egg)
    expect(a.heading).toBe('About Adopt Me Crystal Egg')
    expect(a.intro).toBe('Crystal Egg is an egg in Adopt Me. Look after it and it hatches into a random pet.')
    expect(a.traitGuide).toBe(false)
    expect(a.faq.map((f) => f.q).join(' ')).not.toMatch(/F, R, N/)
    expect(a.faq.map((f) => f.a).join(' ')).toMatch(/Check the egg before/)
    expect(a.relatedHeading).toBe('Popular Adopt Me Pets')
  })

  it('a potion: its own line', () => {
    const a = itemAbout({ ...egg, itemName: 'Fly Potion', kind: 'potion' })
    expect(a.intro).toBe('Fly Potion is a potion in Adopt Me that you use on one of your pets.')
    expect(a.faq.map((f) => f.a).join(' ')).toMatch(/Check the potion before/)
  })
})
