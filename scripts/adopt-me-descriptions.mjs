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
  'shadow-dragon': `The Shadow Dragon is the most iconic legendary in Adopt Me trading — the pet most players use as their mental benchmark for "top tier." It was sold for 1,000 Robux during the 2019 Halloween Event and has never returned, so every Shadow Dragon in circulation is from that original window. That fixed, shrinking supply is why it holds value while newer pets swing. Its demand comes as much from status as from scarcity: owning one signals a long-time or high-value trader. The Neon form deepens its already-dark palette into a glowing purple, and Neon Fly Ride Shadow Dragons are among the hardest single pets to assemble, since four fully-grown originals are needed just to make one Neon.`,

  'frost-dragon': `The Frost Dragon came from the 2019 Christmas Event, bought with 1,000 gingerbread or via a limited Robux bundle, and like the other 2019 dragons it is fully unobtainable today. For years it traded at or above the Shadow Dragon; it has since settled just below, but the two are still quoted together as the classic "dragon tier." Its icy blue-white look makes the Neon and Mega forms especially popular for display, which props up demand for the potioned variants beyond what the base pet alone would justify. Because it was event-limited rather than a permanent shop pet, supply only ever decreases as pets are lost to inactive accounts.`,

  'bat-dragon': `The Bat Dragon is a 2019 Halloween Event pet that cost 180 Halloween Candy — a currency that took real grinding to accumulate — which made it scarcer at launch than pets bought outright with Robux. That grind-gated origin is why it often trades a notch above the Shadow Dragon despite similar age. It remains one of the highest-demand legendaries in the game, and its dark red-and-black Neon is a sought-after display pet. As with all 2019 event dragons, it cannot be obtained through normal play, so the only way to get one now is a trade or a cash purchase.`,

  'giraffe': `The Giraffe is one of the rarest legacy pets in Adopt Me, originally from the 2019 Safari Egg, which was retired the same year. Very few were hatched relative to how long players have wanted one, so it sits in the same value conversation as the 2019 dragons despite being an egg pet rather than an event pet. Its towering model makes it instantly recognisable, and the Neon and Mega forms are display favourites. Because the Safari Egg is gone for good, the Giraffe's supply is effectively frozen, and its value tends to hold steady rather than spike or crash.`,

  'evil-unicorn': `The Evil Unicorn was a 2019 Halloween Event pet, the darker counterpart to the common Unicorn, and has been unobtainable since that event closed. It trades in the upper-legendary band, valued for both its rarity and its distinctive menacing design. Its Neon form glows an eerie red, which keeps demand for the potioned variants strong. Like the other 2019 Halloween pets, every one in circulation dates to that single event, so supply only shrinks over time as accounts go inactive.`,

  'parrot': `The Parrot came from the 2019 Jungle Egg, one of the earliest retired eggs in Adopt Me. Its bright plumage and early-era rarity keep it in steady demand among collectors who value legacy pets. Because the Jungle Egg was retired years ago, the Parrot cannot be hatched today and only circulates through trades. It generally trades below the 2019 dragons but well above ordinary legendaries, and its Fly Ride form is common enough in trades to serve as a useful mid-tier benchmark.`,

  'crow': `The Crow was a Farm Egg pet from 2020, an egg that has since been retired, placing the Crow firmly among the desirable legacy legendaries. It is prized for its clean black silhouette, which makes the Neon's subtle glow stand out. Demand is driven mostly by collectors completing legacy sets rather than by flashy display value, so its price tends to be stable. With the Farm Egg gone, no new Crows enter the game, and existing ones slowly leave circulation.`,

  'owl': `The Owl is a Farm Egg legendary from 2020, retired alongside the rest of that egg's lineup. It's one of the more understated legacy pets — valued for rarity and completeness rather than spectacle — and trades in a stable mid-legendary band. Its Neon form gives the feathers a soft glow that display collectors appreciate. As a retired-egg pet, its supply is fixed and slowly declining, which underpins a value that rarely moves sharply in either direction.`,
}
