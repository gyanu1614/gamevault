import type { CategoryGuide } from './types'

/**
 * Adopt Me! guides, keyed by category slug.
 *
 * Internal links verified 200 on 2026-09-25: /adopt-me/values,
 * /adopt-me/calculator, /adopt-me/neon-calculator, /adopt-me/blog, and the
 * values pages for frost-dragon, shadow-dragon, bat-dragon, giraffe, owl.
 * NOT published (404) at that date — do not link until they are:
 * /adopt-me/values/evil-unicorn, /adopt-me/values/cracked-egg,
 * /adopt-me/values/royal-egg.
 */
export const ADOPT_ME_GUIDES: Record<string, CategoryGuide> = {
  'buy-items': {
    // "For Sale" phrasing matches how people search ("adopt me pets for
    // sale") — the same pattern the big marketplaces use for this H2.
    title: 'Adopt Me Pets & Items For Sale',
    intro: [
      'Pets are the heart of Adopt Me!. You raise them, trade them and show them off — and the rarest ones take months of luck or trading to get hold of. Buying from another player lets you skip that: pick the exact pet you want, see its variant and price before you pay, and have it traded to you in-game.',
    ],
    sections: [
      {
        heading: 'Pet Rarities',
        blocks: [
          { type: 'p', text: 'Every pet in Adopt Me! belongs to one of five rarities:' },
          { type: 'list', items: ['Common', 'Uncommon', 'Rare', 'Ultra-Rare', 'Legendary'] },
          {
            type: 'p',
            text: 'Rarity sets the starting point, but it doesn’t decide the price on its own. Two Legendary pets can be worth very different amounts depending on demand and on whether they can still be hatched at all. Check a pet’s estimated value in our [Adopt Me value list](/adopt-me/values) before you buy, or weigh up a swap with the [trade calculator](/adopt-me/calculator).',
          },
        ],
      },
      {
        heading: 'Reading a Listing: F, R, N and M',
        blocks: [
          { type: 'p', text: 'Listings use shorthand for what has been done to a pet:' },
          {
            type: 'list',
            items: [
              '**F — Fly.** The pet has had a Fly Potion and can fly.',
              '**R — Ride.** The pet has had a Ride Potion and can be ridden.',
              '**N — Neon.** Four fully-grown copies of the same pet, combined into one glowing pet.',
              '**M — Mega Neon.** Four fully-grown Neon pets of the same kind, combined into one with a colour-cycling glow.',
            ],
          },
          {
            type: 'p',
            text: 'So an **NFR** pet is Neon, Fly and Ride, and an **MFR** pet is Mega Neon, Fly and Ride. A Mega Neon takes sixteen of the same pet to build, which is why MFR pets sit at the top of the price range. The [Neon calculator](/adopt-me/neon-calculator) shows what building one yourself would cost compared with buying it finished.',
          },
        ],
      },
      {
        heading: 'Where Pets Come From',
        blocks: [
          {
            type: 'p',
            text: 'Most pets hatch from eggs. The Cracked Egg and Pet Egg cost in-game Bucks, while the Royal Egg costs Robux and gives better odds of a rare hatch. Event eggs, such as the Safari Egg, are only sold for a limited time — once an egg leaves the game, trading is the only way to get its pets.',
          },
          {
            type: 'p',
            text: 'That’s why retired pets hold their value: nobody can hatch more of them, so the supply only shrinks. Pets like the [Frost Dragon](/adopt-me/values/frost-dragon), [Shadow Dragon](/adopt-me/values/shadow-dragon), [Bat Dragon](/adopt-me/values/bat-dragon), [Giraffe](/adopt-me/values/giraffe) and [Owl](/adopt-me/values/owl) are some of the most sought-after for exactly that reason.',
          },
        ],
      },
      {
        heading: 'What You Can Buy',
        blocks: [
          {
            type: 'p',
            text: 'Pets are the headline, but this category covers everything you can trade in Adopt Me!: pets, eggs, vehicles, pet wear, toys and strollers. Every listing shows its item type, so you can filter straight to what you’re after.',
          },
        ],
      },
      {
        heading: 'Trading Safely',
        blocks: [
          {
            type: 'list',
            items: [
              '**Never share your password.** Pets arrive through an ordinary in-game trade, so no seller ever needs your Roblox login. If one asks for it, report them.',
              '**Get your Trade License first.** Adopt Me! requires its free Trade License before you can trade. You can get it in-game, and it only takes a few minutes.',
              '**Check the trade window before you accept.** It shows exactly what you’re receiving. Make sure the pet, its variant and its age match the listing.',
              '**Don’t accept a trade that’s wrong.** Decline it and open a dispute from your order instead.',
            ],
          },
        ],
      },
    ],
    howToBuy: { title: 'How to Buy Adopt Me Pets', choose: 'Choose Your Pet' },
    related: [
      { label: 'Adopt Me Value List', href: '/adopt-me/values' },
      { label: 'Trade Calculator', href: '/adopt-me/calculator' },
      { label: 'Neon Calculator', href: '/adopt-me/neon-calculator' },
      { label: 'Adopt Me Guides', href: '/adopt-me/blog' },
    ],
  },
}
