import { describe, expect, it } from 'vitest'
import { HELP_FAQ } from '@/lib/support/help-content'
import { NO_FACTS } from '@/lib/values/item-facts'
import { itemAbout } from './about'

const parrot = {
  gameSlug: 'adopt-me',
  gameName: 'Adopt Me',
  itemName: 'Parrot',
  rarity: 'Legendary',
  facts: { released: '2019', origin: 'Jungle Egg', howToGet: null },
}

describe('itemAbout', () => {
  it('Adopt Me pet: one paragraph from data, the badge guide and four questions', () => {
    const a = itemAbout(parrot)
    expect(a.heading).toBe('About Adopt Me Parrot')
    expect(a.intro).toBe('Parrot is a Legendary pet in Adopt Me, released in 2019. It came from the Jungle Egg.')
    expect(a.traitGuide).toBe(true)
    expect(a.faq.map((f) => f.q)).toEqual([
      'Is it safe to buy Parrot on DropMarket?',
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

  it('a full release date reads "released on"; "an" before a vowel', () => {
    const a = itemAbout({ ...parrot, itemName: 'Owl', rarity: 'Ultra-Rare', facts: { ...parrot.facts, released: '27 October 2022', origin: null } })
    expect(a.intro).toBe('Owl is an Ultra-Rare pet in Adopt Me, released on 27 October 2022.')
    expect(a.faq[3].q).toBe('What do F, R, N and M mean on an Owl?')
  })

  it('missing facts are left out, never guessed', () => {
    const a = itemAbout({ ...parrot, rarity: null, facts: NO_FACTS })
    expect(a.intro).toBeNull()
    expect(a.relatedHeading).toBe('Popular Adopt Me Pets')
  })

  it('no rarity but an origin: says what is known', () => {
    const a = itemAbout({ ...parrot, rarity: null, facts: { ...NO_FACTS, origin: 'Admin Abuse events' } })
    expect(a.intro).toBe('Parrot is a pet in Adopt Me. It came from Admin Abuse events.')
  })

  it('other games: no badge guide, their own noun', () => {
    const a = itemAbout({ gameSlug: 'steal-a-brainrot', gameName: 'Steal a Brainrot', itemName: 'Garama', rarity: 'Secret', facts: NO_FACTS })
    expect(a.traitGuide).toBe(false)
    expect(a.faq).toHaveLength(3)
    expect(a.intro).toBe('Garama is a Secret brainrot in Steal a Brainrot.')
    expect(a.relatedHeading).toBe('Popular Steal a Brainrot Brainrots')
  })
})
