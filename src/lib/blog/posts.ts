/**
 * V42 — File-based blog "CMS".
 *
 * Posts live in this typed module so the blog works with zero DB
 * migrations: the listing detail page's blog rail, the /blog index and
 * the /blog/[slug] article pages all read from here. Each post can be
 * tagged with the game slugs it's most relevant to — `getPostsForGame`
 * surfaces tagged posts first and pads with general ones, so every
 * game's listing pages get a relevant rail automatically.
 *
 * ▸ TO ADD A POST: append to BLOG_POSTS. Covers are /public paths
 *   (null → the card renders a styled gradient fallback).
 * ▸ LATER: when marketing needs a real CMS, swap this module for a
 *   `blog_posts` table read — every consumer goes through the helpers
 *   below, so the swap is contained to this file.
 */

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  author: string
  readMinutes: number
  /** ISO date — newest first everywhere. */
  publishedAt: string
  /** Game slugs this post targets; empty = general/every game. */
  games: string[]
  /** /public path for the card + article hero. Null → gradient tile. */
  cover: string | null
  /** Article body — one entry per paragraph. */
  body: string[]
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'steal-a-brainrot-trading-guide',
    title: 'Steal a Brainrot trading guide: rarities, mutations, and real values',
    excerpt:
      'Secret isn’t always expensive and Diamond isn’t always worth 4× — here’s how income, rarity, and mutations actually set a brainrot’s price.',
    author: 'DropMarket Team',
    readMinutes: 8,
    publishedAt: '2026-06-24',
    games: ['steal-a-brainrot'],
    cover: '/section-bg/popular-games.jpg',
    body: [
      'Steal a Brainrot’s economy runs on income per second. A base Dragon Cannelloni generates 250M/s, but the same brainrot with a Diamond or Rainbow mutation can multiply that many times over — which is why two listings with the same name can be priced worlds apart.',
      'When you compare offers, always check three things: the base income, the rarity tier, and any mutations. On DropMarket every listing carries these as attributes, so the Other Sellers section on a listing page shows you exactly why one seller charges more than another.',
      'Rarity tiers (Common through Secret) set the floor, but mutations set the ceiling. A mutated mid-tier brainrot frequently out-earns an unmutated Secret — don’t pay Secret prices for base income you can beat cheaper.',
      'Finally, mind the delivery window. Instant-delivery listings usually carry a small premium over manual ones; whether that premium is worth it depends on how fast you want to be back in the game.',
    ],
  },
  {
    slug: 'spot-overpriced-brainrots',
    title: 'How to spot an overpriced brainrot — a buyer’s checklist',
    excerpt:
      'Five quick checks before you hit Buy: income math, variant comparison, seller history, delivery terms, and the escrow safety net.',
    author: 'DropMarket Team',
    readMinutes: 5,
    publishedAt: '2026-06-18',
    games: ['steal-a-brainrot'],
    cover: null,
    body: [
      'The fastest way to overpay is to buy the first listing you see. The Other Sellers rail on every DropMarket listing exists precisely so you don’t: it lines up every offer for the same item, cheapest first.',
      'Check income per dollar. Divide the brainrot’s income rate by the asking price — that one number makes wildly different listings directly comparable.',
      'Compare variants deliberately. A Diamond variant at 3× the base price can be a bargain or a ripoff depending on its actual income multiplier. The variant chips on each offer row tell you what you’re looking at.',
      'Look at the seller, not just the price. A 99% rating across hundreds of orders is worth a small premium over an unproven account — though SafeDrop escrow protects you either way.',
      'And that’s the final check: never trade outside escrow. If a deal moves off-platform, the safety net is gone.',
    ],
  },
  {
    slug: 'adopt-me-pet-values-explained',
    title: 'Adopt Me pet values explained: F, R, FR and NFR',
    excerpt:
      'Fly, Ride, Neon, Mega — the potion and evolution system is half the price tag. Here’s how to read an Adopt Me listing like a trader.',
    author: 'DropMarket Team',
    readMinutes: 6,
    publishedAt: '2026-06-12',
    games: ['adopt-me'],
    cover: null,
    body: [
      'In Adopt Me, the pet is only half the story. The other half is its abilities: F (Fly), R (Ride), FR (Fly+Ride) and the Neon/Mega evolutions each step the value up significantly.',
      'An NFR (Neon Fly Ride) version of a pet routinely trades at several times the base version. When you browse listings, the trait attribute tells you exactly which version you’re buying — treat FR and NFR as different items, because the market does.',
      'Egg generation matters too. Pets from retired eggs can’t be hatched anymore, which makes their supply fixed while demand keeps growing — the classic recipe for appreciation.',
      'As always: compare across sellers before buying, and keep every trade inside SafeDrop escrow so a mis-delivery becomes a refund, not a loss.',
    ],
  },
  {
    slug: 'how-safedrop-escrow-works',
    title: 'How SafeDrop escrow protects every trade',
    excerpt:
      'Your money sits in escrow until you confirm delivery — here’s the full lifecycle of a protected order, step by step.',
    author: 'DropMarket Team',
    readMinutes: 4,
    publishedAt: '2026-06-06',
    games: [],
    cover: '/section-bg/how-it-works.jpg',
    body: [
      'Every order on DropMarket runs through SafeDrop, our escrow system. When you pay, the money doesn’t go to the seller — it goes into a held balance that neither side can touch.',
      'The seller then delivers in-game within their stated window. You confirm receipt from your order page, and only that confirmation releases the funds to the seller.',
      'If something goes wrong — no delivery, wrong item, mis-described listing — you open a dispute and the held payment comes back to you in full. The seller is never paid for an order you didn’t confirm.',
      'This is why the same item often costs less on DropMarket than in official stores while being just as safe: sellers compete on price, and escrow removes the trust problem that usually comes with player-to-player trading.',
    ],
  },
  {
    slug: 'new-buyer-mistakes-rmt',
    title: '5 mistakes new buyers make on gaming marketplaces',
    excerpt:
      'From sharing passwords to trading off-platform — the classic traps, and how to sidestep every one of them.',
    author: 'DropMarket Team',
    readMinutes: 5,
    publishedAt: '2026-05-28',
    games: [],
    cover: '/section-bg/cta-band.jpg',
    body: [
      'First: never share your password. Legitimate item delivery happens in-game through trading or gifting — no seller ever needs your account credentials.',
      'Second: don’t move deals off-platform. A discount for “direct trade” is the oldest scam in the book; the moment a trade leaves escrow, you have no protection.',
      'Third: read the delivery window. Manual sellers state how long delivery takes — buying a 24-hour listing and expecting 10-minute delivery ends in frustration, not fraud.',
      'Fourth: check variant attributes before comparing prices. Two listings with the same title can be different variants with legitimately different values.',
      'Fifth: confirm delivery only after you actually have the item. Confirmation is what releases payment — it’s your lever, don’t pull it early.',
    ],
  },
  {
    slug: 'instant-vs-manual-delivery',
    title: 'Instant vs manual delivery: what to actually expect',
    excerpt:
      'Instant isn’t always instant and manual isn’t always slow — what the delivery labels really mean and when each is the right pick.',
    author: 'DropMarket Team',
    readMinutes: 4,
    publishedAt: '2026-05-20',
    games: [],
    cover: null,
    body: [
      'Instant-delivery listings are fulfilled automatically the moment payment clears — ideal when you want to be back in the game in minutes. They usually carry a small convenience premium.',
      'Manual listings are fulfilled by the seller personally within their stated window — 20 minutes, an hour, sometimes a day. The best manual sellers are often faster than their stated window; the window is a promise, not an average.',
      'Whichever you pick, the timer is enforced by escrow: a seller who misses their window is a dispute away from an automatic refund.',
      'Rule of thumb: pay the instant premium when time matters, take the manual discount when it doesn’t.',
    ],
  },
]

const byDateDesc = (a: BlogPost, b: BlogPost) =>
  b.publishedAt.localeCompare(a.publishedAt)

/** All posts, newest first. */
export function getAllPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort(byDateDesc)
}

export function getPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null
}

/**
 * Game-relevant rail: posts tagged for the game first (newest first),
 * padded with general/other posts until `limit`.
 */
export function getPostsForGame(gameSlug: string, limit = 4): BlogPost[] {
  const tagged = BLOG_POSTS.filter((p) => p.games.includes(gameSlug)).sort(byDateDesc)
  const rest = BLOG_POSTS.filter((p) => !p.games.includes(gameSlug)).sort(byDateDesc)
  return [...tagged, ...rest].slice(0, limit)
}
