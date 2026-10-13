/**
 * Hand-written per-pet descriptions (TASK-3, wave 1).
 * ============================================================================
 * Each is genuine, non-templated context — where the pet came from, why it
 * moves, how its Neon compares — NOT string-substituted boilerplate. A pet
 * only gets a /adopt-me/values/{slug} page once it has one of these (the
 * has_page generated column requires ≥200 chars), so this file is the gate
 * against thin programmatic pages.
 *
 * Applied by scripts/apply-adopt-me-descriptions.mjs.
 *
 * Facts are as-of mid-2026 and reflect community understanding of the trading
 * economy; they are editorial context, not scraped data.
 */

export const DESCRIPTIONS = {
  'shadow-dragon': `The Shadow Dragon was sold for 1,000 Robux during the 2019 Halloween Event and has never come back, so it is unobtainable today. Most traders use it as the benchmark for a top-tier pet, and its fixed supply keeps its value steady while newer pets swing. A Neon takes four full-grown Shadow Dragons and glows purple, which makes a Neon Fly Ride one of the hardest pets to put together.`,

  'frost-dragon': `The Frost Dragon came from the 2019 Christmas Event, bought with 1,000 Gingerbread or a limited Robux bundle, and it is unobtainable now. It once traded at or above the Shadow Dragon and now sits just below it, but traders still quote the two together. Its icy blue look makes the Neon and Mega Neon forms popular display pets.`,

  'bat-dragon': `The Bat Dragon came from the 2019 Halloween Event and cost 180 Halloween Candy, which took a lot of play to earn. That made it rarer at launch than pets sold for Robux, and it often trades a little above the Shadow Dragon. It is unobtainable now, so the only way to get one is a trade or buying one.`,

  'giraffe': `The Giraffe hatched from the 2019 Safari Egg, which was retired the same year, and it is one of the rarest legacy pets in Adopt Me. Few were hatched, so it trades alongside the 2019 dragons and its value tends to hold steady. The Neon and Mega Neon forms are display favourites.`,

  'evil-unicorn': `The Evil Unicorn came from the 2019 Halloween Event as the darker version of the regular Unicorn, and it has been unobtainable since that event ended. It trades in the upper legendary range for its rarity and menacing look. Its Neon glows red, and supply only shrinks as old accounts go inactive.`,

  'parrot': `The Parrot hatched from the 2019 Jungle Egg, one of the first eggs Adopt Me retired, so you can only get one by trade now. It trades below the 2019 dragons but well above most legendaries, and its bright feathers keep collectors interested. The Fly Ride Parrot shows up in trades often enough to work as a mid-tier benchmark.`,

  'crow': `The Crow hatched from the 2020 Farm Egg, which has since been retired, so no new Crows enter the game. Its clean black look makes the Neon glow stand out. Most demand comes from collectors finishing legacy sets rather than display traders, so its price tends to stay stable.`,

  'owl': `The Owl is a legendary from the 2020 Farm Egg, retired along with the rest of that egg's pets. It is valued for rarity more than looks and trades in a stable mid-legendary range. Its Neon gives the feathers a soft glow, and with a fixed supply its value rarely moves sharply.`,
}
