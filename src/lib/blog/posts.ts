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
      'Five quick checks before you hit Buy: income math, variant comparison, seller history, delivery terms, and the SafeDrop safety net.',
    author: 'DropMarket Team',
    readMinutes: 5,
    publishedAt: '2026-06-18',
    games: ['steal-a-brainrot'],
    cover: null,
    body: [
      'The fastest way to overpay is to buy the first listing you see. The Other Sellers rail on every DropMarket listing exists precisely so you don’t: it lines up every offer for the same item, cheapest first.',
      'Check income per dollar. Divide the brainrot’s income rate by the asking price — that one number makes wildly different listings directly comparable.',
      'Compare variants deliberately. A Diamond variant at 3× the base price can be a bargain or a ripoff depending on its actual income multiplier. The variant chips on each offer row tell you what you’re looking at.',
      'Look at the seller, not just the price. A 99% rating across hundreds of orders is worth a small premium over an unproven account — though SafeDrop Buyer Protection covers you either way.',
      'And that’s the final check: never take a deal off-platform. The moment a trade leaves DropMarket, the safety net is gone.',
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
      'As always: compare across sellers before buying, and keep every trade on DropMarket, where SafeDrop Buyer Protection turns a mis-delivery into a refund, not a loss.',
    ],
  },
  {
    slug: 'how-safedrop-buyer-protection-works',
    title: 'How SafeDrop Buyer Protection covers every order',
    excerpt:
      'Get what you ordered, or your money back — here’s the full lifecycle of a covered order, step by step.',
    author: 'DropMarket Team',
    readMinutes: 4,
    publishedAt: '2026-06-06',
    games: [],
    cover: '/section-bg/how-it-works.jpg',
    body: [
      'Every order on DropMarket is covered by SafeDrop, our buyer protection programme. The promise is simple: get what you ordered, or your money back — and the seller isn’t paid out until the order is actually delivered.',
      'The seller delivers in-game within their stated window. You confirm receipt from your order page — the seller is paid out once you confirm, or once your protection window closes without an issue.',
      'If something goes wrong — no delivery, wrong item, mis-described listing — you open a dispute and get a full refund. The seller’s payout is paused while a dispute is open, and a seller is never paid for an order that wasn’t delivered as described.',
      'This is why the same item often costs less on DropMarket than in official stores while being just as safe: sellers compete on price, and SafeDrop removes the trust problem that usually comes with player-to-player trading.',
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
      'Second: don’t move deals off-platform. A discount for “direct trade” is the oldest scam in the book; the moment a trade leaves DropMarket, you have no protection.',
      'Third: read the delivery window. Manual sellers state how long delivery takes — buying a 24-hour listing and expecting 10-minute delivery ends in frustration, not fraud.',
      'Fourth: check variant attributes before comparing prices. Two listings with the same title can be different variants with legitimately different values.',
      'Fifth: confirm delivery only after you actually have the item. Confirmation is what pays the seller out — it’s your lever, don’t pull it early.',
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
      'Whichever you pick, the timer is enforced by SafeDrop: a seller who misses their window is a dispute away from a full refund.',
      'Rule of thumb: pay the instant premium when time matters, take the manual discount when it doesn’t.',
    ],
  },
  {
    slug: 'how-to-sell-roblox-brainrots-for-real-money',
    title: 'How to sell Roblox brainrots for real money',
    excerpt:
      'From first listing to first payout: what actually sells in the Steal a Brainrot economy, what commission costs, and how the Seller Balance pays you.',
    author: 'DropMarket Team',
    readMinutes: 8,
    publishedAt: '2026-07-14',
    games: ['steal-a-brainrot'],
    cover: '/hero/roblox.jpg',
    body: [
      'Steal a Brainrot has quietly become one of the biggest trading economies on Roblox. Every server runs the same loop — steal, secure, upgrade, flex — and behind that loop sits a real market where Secrets and high-mutation brainrots change hands for real money every day. If you’re pulling good brainrots faster than you can use them, you’re sitting on sellable inventory. Here’s the whole playbook for turning it into cash on DropMarket, from first listing to first payout.',
      '## What Actually Sells',
      'Not every brainrot is worth listing. The market prices three things: income per second, rarity tier, and mutations. Income is the fundamental — a buyer is ultimately paying for how fast a brainrot earns. Rarity (Common through Secret) sets the floor, and mutations like Gold, Diamond, and Rainbow multiply the ceiling. In practice, three kinds of listings move fastest:',
      '- Secrets, even unmutated. The tier alone carries demand, and supply is genuinely scarce — a clean Secret listing at a fair price rarely sits long.\n- Mutated mid-tier brainrots with strong income multipliers. Buyers who’ve done the maths know these often out-earn a base Secret at a fraction of the price.\n- Fresh update brainrots. Demand spikes hard in the first days after a new drop, before supply catches up — if you pull one early, that window is when it’s worth most.',
      'Before you price anything, look at the live board. The [Steal a Brainrot items page](/steal-a-brainrot/items) shows every active listing sorted cheapest-first, and five minutes of scrolling tells you exactly where your brainrot sits in the current market — which sellers you’re actually competing with, and at what price.',
      '## How Listing Works',
      'Listing takes minutes. Head to the [sell page](/sell), pick Steal a Brainrot and the items category, and describe exactly what you’re selling: name, rarity tier, mutation, and income per second. These attributes aren’t decoration — buyers filter and compare on them, so an accurately-attributed listing ranks against the right competition instead of getting lost among things it isn’t.',
      'Set your price against comparable live offers, not against what a value list said last month. Then choose your delivery window. If you’re online most evenings, a short manual window — say, one hour — is realistic and converts well. Buyers pay a premium for speed and discount uncertainty, so a tight window you always hit beats a generous one you occasionally miss.',
      '## What It Costs',
      'DropMarket charges no listing fee — you pay commission only when something actually sells, and commission is set by category. For most categories it lands between 5% and 10%: in-game items are 7%, in-game currency is 5% for most games and 10% for Roblox in-game economies, and top-ups are 5%. Brainrots sell as items, so a $40 Secret costs you $2.80 in commission and the rest is yours. Game accounts are the exception, carrying higher risk-banded rates. The full schedule, including payout fees, is on the [fees page](/fees).',
      '## Getting Paid',
      'Every order is covered by SafeDrop Buyer Protection — the buyer gets what they ordered, or their money back — and getting paid follows delivery. When your brainrot sells, you deliver it in-game within your stated window, and the buyer confirms receipt from their order page. Your sale proceeds are credited to your Seller Balance once the buyer confirms delivery or the protection window closes, and from there you can request a payout to your verified payout method whenever it suits you.',
      'This structure is exactly what makes strangers comfortable paying you real money. A buyer knows a seller is never paid for an order that wasn’t delivered as described, so your first sale doesn’t require an established reputation — just an accurate listing and reliable delivery. That said, reputation compounds fast: exactly-as-described orders turn into reviews, and reviews turn into buyers picking your offer over a marginally cheaper one. The full lifecycle of a covered order is on the [SafeDrop page](/safedrop).',
      '## The Safety Rules That Protect You',
      'A few rules keep both your sales and your account standing safe:',
      '- Keep every conversation in the order chat. It’s the record that resolves disputes in your favour when you’ve done everything right.\n- Never take a deal off-platform. “Same trade, no fees” is the oldest scam pitch in gaming — off DropMarket there’s no protection for either side, and soliciting off-platform deals gets accounts banned.\n- Never ask for or share account credentials. Brainrot delivery happens in-game, trade to trade — no password ever needs to change hands.\n- Describe mutations and income exactly. An inflated listing doesn’t earn more; it earns a dispute, a refund, and a rating hit that costs you future sales.',
      'That’s the whole system: list accurately, price against the live market, deliver fast, keep everything on-platform. If your base is full of brainrots you’ve outgrown, [create your first listing](/sell) — it costs nothing until it sells.',
    ],
  },
  {
    slug: 'is-it-safe-to-buy-game-accounts',
    title: 'Is it safe to buy game accounts?',
    excerpt:
      'Recovery, bans, and misdescribed listings are the real risks — here’s how SafeDrop Buyer Protection answers each one, and what to check before you buy.',
    author: 'DropMarket Team',
    readMinutes: 7,
    publishedAt: '2026-07-14',
    games: ['valorant', 'fortnite'],
    cover: '/hero/valorant.jpg',
    body: [
      'Buying a game account is the highest-stakes purchase on any gaming marketplace, and the honest answer to “is it safe?” is: it depends entirely on where and how you buy. Account trading has real, specific risks that don’t exist for items or currency. This guide names each one, explains how SafeDrop Buyer Protection answers it, and gives you a checklist so you know exactly what you’re looking at before you pay.',
      '## The Real Risks, Named',
      'Three failure modes account for nearly every account-purchase horror story:',
      '- Recovery. The original owner uses the original email address, phone number, or purchase receipts to reclaim the account after selling it. This is the classic account scam: get paid, wait a week, take it back.\n- Bans. The account arrives with baggage — botted progression, purchased boosting, a chargeback on the original payment — and the publisher’s enforcement catches up with it after the sale.\n- Misdescription. The rank is from three seasons ago, the skins list is padded, or the “full access” in the title doesn’t include the email address.',
      'One more thing an honest guide has to say: most publishers’ terms of service prohibit account selling, and a publisher can act against a traded account regardless of where it was bought. No marketplace can change that. What a marketplace can change is whether you lose your money when something goes wrong.',
      '## How SafeDrop Answers Each Risk',
      'Every account order on DropMarket is covered by [SafeDrop Buyer Protection](/safedrop), and the promise is deliberately blunt: get what you ordered, or your money back. For accounts specifically, the protection is tuned to the risk:',
      '- Risk-banded protection windows. Account listings carry a protection window of 5, 7, or 14 days depending on the account’s risk band — the riskier the account type, the longer you stay covered after delivery.\n- Recovery is covered. If the original owner reclaims the account within your protection window, you open a dispute — a recovered account is not a delivered order, and it resolves to a full refund.\n- Not delivered or not as described means a full refund. If the account never arrives, the credentials don’t work, or what you got doesn’t match the listing, the dispute process returns your money in full.\n- Sellers aren’t paid for failed orders. A seller is never paid out for an order that wasn’t delivered as described, which removes the entire economics of the sell-then-recover scam.',
      '## What to Check in a Listing',
      'Protection is the safety net; reading the listing properly keeps you off it. Before you buy — whether you’re browsing [Valorant accounts](/valorant/accounts) or [Fortnite accounts](/fortnite/accounts) — check five things:',
      '- Full email access included. An account without control of its email address is an account you don’t control. This is the single most important line in any account listing.\n- The seller’s history. Rating and completed-order count are hard signals, and an account is the one purchase where an established seller is worth a real premium.\n- Specifics, not vibes. Exact rank and season, region, level, named skins — a listing that describes precisely can be disputed precisely if it turns out to be wrong.\n- The protection window on the listing, so you know your coverage period before you commit rather than after.\n- That the deal stays on-platform. Any seller steering you to Discord or a “direct” payment is removing your protection on purpose. Decline and report.',
      '## Your Statutory Rights Still Apply',
      'Platform protection isn’t the only layer. Where you’re a consumer buying from a trader seller, your statutory rights under consumer law sit alongside SafeDrop — if an item is faulty or misdescribed, statutory remedies including a full refund remain available regardless of the protection window. The [refund policy](/refunds) sets out how the two layers work together.',
      'So — is it safe to buy game accounts? On an unprotected forum or through a Discord DM: genuinely, no; you’re trusting a stranger with the exact incentive structure of the recovery scam. On a marketplace with risk-banded protection windows, a dispute process that refunds in full, and sellers who aren’t paid for failed orders, the worst case stops being “lose everything” and becomes “wait a few days for a refund.” Read the listing carefully, keep everything on-platform, and let the protection do its job.',
    ],
  },
  {
    slug: 'steal-a-brainrot-trading-values-explained',
    title: 'Steal a Brainrot trading values, explained',
    excerpt:
      'Rarity sets the floor, mutations set the ceiling, demand moves daily — how brainrot values actually form, and how to read WFL calls like a trader.',
    author: 'DropMarket Team',
    readMinutes: 7,
    publishedAt: '2026-07-14',
    games: ['steal-a-brainrot'],
    cover: null,
    body: [
      'Ask five Steal a Brainrot traders what a Dragon Cannelloni is “worth” and you’ll get five answers. There’s no official price list — values are a moving consensus built from rarity, income, mutations, and whatever the community is hyped about this week. Understanding how that consensus forms is the difference between trading well and quietly donating value to people who understand it better than you do.',
      '## Where Values Come From',
      'Every brainrot’s value is built from four inputs:',
      '- Income per second — the fundamental. A brainrot is an earning asset, and its base income is the closest thing this economy has to intrinsic value.\n- Rarity tier — the floor. Common through Secret, each tier carries a baseline of demand, and genuine Secret supply is scarce enough to hold value on its own.\n- Mutations — the multiplier. Gold, Diamond, Rainbow and event mutations multiply income, and price scales with the multiplier — usually more than proportionally, because mutated versions are rarer still.\n- Demand — the wildcard. Memes, YouTube coverage, and fresh updates move prices faster than any stat. A mid brainrot that becomes a meme can outprice its own income for weeks.',
      'The first three inputs are measurable. The fourth is why value lists disagree with each other and why prices drift week to week even when nothing about the brainrot changed.',
      '## Why Two “Identical” Brainrots Aren’t',
      'The most common trading mistake is treating name and tier as the whole picture. A base Secret and a Rainbow-mutated Secret share a name and a tier and can differ in value by an order of magnitude — while a Diamond mid-tier quietly out-earns the base Secret at half the price. Always value the full combination — name, tier, mutation, income — never the name alone.',
      'Our [buyer’s checklist for spotting overpriced brainrots](/blog/spot-overpriced-brainrots) turns this into a five-step routine, and its core is a single division: income per unit of price. That one number makes wildly different offers directly comparable, and it’s the fastest way to notice you’re about to pay Secret prices for income a mutated mid-tier beats.',
      '## How to Avoid Overpaying',
      'Overpaying almost always happens the same way: you fall for a specific brainrot, then reason backwards to justify the price. Flip the order. Decide what the income and mutation are worth to you first, then look for offers that clear that bar — and always compare at least three before committing to any. If every listing for a brainrot sits above what its income justifies, that’s not a sign you need to stretch; it’s a sign demand is inflated right now, and inflated demand deflates. The sellers counting on FOMO need you to buy today. You don’t need to.',
      '## WFL Basics',
      'In trading channels you’ll see every proposed trade tagged W, F, or L — win, fair, or loss, always judged from the perspective of the person asking. The mechanics are simple: total up the value each side gives, compare, and make the call. Three caveats decide whether you’re using WFL or being used by it:',
      '- Value lists lag the market. Community lists update on someone’s schedule; demand moves daily. A “win” measured against a stale list can be a real-world loss.\n- Hype is priced in at the top. Trading for the current meme brainrot at its peak means paying peak — that “fair” call assumes the hype holds, and hype rarely does.\n- WFL replies are opinions, not appraisals. Five votes in a Discord channel are a vibe check — useful as a sanity read, worthless as evidence.',
      '## Live Listings Are the Real Price Signal',
      'Here’s the trader’s shortcut: a live marketplace reprices continuously, because every listing is someone putting real money where a value list puts a number. The [Steal a Brainrot items board](/steal-a-brainrot/items) shows current asking prices across every rarity and mutation, cheapest first — and because every purchase there is covered by SafeDrop Buyer Protection, those prices reflect what buyers actually pay with real consequences attached, not what a spreadsheet hopes.',
      'So before any big trade, check what the same brainrot currently sells for in cash. If the trade values it far above its live listing price, you’re not trading — you’re overpaying with extra steps.',
      'Values in Steal a Brainrot aren’t mysterious: income, rarity, mutations, demand — in that order of reliability. Anchor on the measurable inputs, treat hype as a cost rather than a value, sanity-check every big trade against live prices, and WFL threads become a tool instead of a trap. For more trading guides like this one, head to the [DropMarket blog](/blog).',
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
