/**
 * Seed the Adopt Me blog into the blog_posts DB table.
 *
 * Five house-style articles (two authored drafts + three new), stored as the
 * markdown-subset body the article renderer expects (one string per block:
 * "## Heading", "- bullet", "> quote", or a paragraph with [text](href) links).
 *
 * - Idempotent: upserts on (primary_game_slug, slug). Re-runnable safely.
 * - primary_game_slug = 'adopt-me' (owns the nested /adopt-me/blog/[slug] URL).
 * - game_slugs = ['adopt-me'] (cross-surfacing rails).
 * - status = published.
 *
 * House style (see ~/Downloads/HOUSE-STYLE.md): exactly five Title-Case H2s,
 * no H3s, no FAQ/tables in body, UK English, absolute dropmarket.gg links, an
 * unheaded 80–120w intro before the first H2, CTA in the final section.
 *
 * Run: node scripts/seed-adopt-me-blog.mjs        (dry run — prints plan)
 *      node scripts/seed-adopt-me-blog.mjs --write (upserts to DB)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const WRITE = process.argv.includes('--write')

const POSTS = [
  // ── 01 · Value guide (authored draft) ──────────────────────────────────
  {
    slug: 'adopt-me-pets-real-money-value',
    title: 'How Much Are Adopt Me Pets Actually Worth In Real Money?',
    excerpt:
      'Every value list gives you a number like 662. Here’s what that number is, why it isn’t money, and what Adopt Me pets actually sell for.',
    post_type: 'value',
    read_minutes: 7,
    published_at: '2026-08-04',
    seo_title: 'How Much Are Adopt Me Pets Worth In Real Money? (2026)',
    seo_description:
      'Trade value vs cash value in Adopt Me: what the community numbers mean, what pets actually sell for in USD, and why the two disagree.',
    cover: null,
    body: [
      'Look up a Shadow Dragon on any Adopt Me value list and you’ll get a number. Maybe 662, maybe something close to it depending on which site you checked. That number isn’t dollars, and it isn’t Robux. It’s a community rating — a score traders agreed on so they could compare one pet against another without arguing every time. It does that job well. What it can’t tell you is what a Shadow Dragon is worth in actual money, because the sites publishing those numbers don’t sell anything and have no completed transactions to look at. This guide covers both sides: what the community numbers mean, what the cash prices look like, and why the two disagree more often than most traders expect.',
      '## Trade Value vs Cash Value',
      'Trade value is the community score. Traders use it to check whether an offer balances before they accept — a pet rated 400 should roughly match two pets rated 200. It’s relative by design, and it updates when enough people agree something has shifted.',
      'Cash value is what a pet actually sold for, in real money, in a completed sale. It isn’t a vote or an estimate. It’s a record of what changed hands.',
      'Both are useful, and they answer different questions. If someone offers you a Frost Dragon for your Shadow Dragon and you want to know whether to take it, trade value is the right tool. If you’re deciding whether a pet is worth grinding for or simply buying, cash value is the one that matters. The [Adopt Me value list](https://dropmarket.gg/adopt-me/values) shows both against every pet, and the [WFL calculator](https://dropmarket.gg/adopt-me/calculator) runs an offer through both at once.',
      '## Why The Two Numbers Drift',
      'This is the part most guides skip, and it’s where the useful information sits.',
      'Trade values move slowly. They update when a community reaches consensus, which takes time — a pet can become much harder or easier to get weeks before the list catches up. Cash values move immediately. If nobody’s buying, the price softens that week; if an event makes a pet suddenly desirable, it climbs before anyone’s touched a wiki.',
      'Beyond timing, the two measure genuinely different pressures. Some pets trade well but sell badly: everyone wants them, they slot neatly into offers, and yet the cash market stays thin because the people chasing them want to trade for them rather than pay. Others go the opposite way — newer players buying their way into the game will pay well above trade value for the pets they’ve actually heard of, which is why recognisable legendaries often carry a cash premium that no value list reflects.',
      'A large gap in either direction is a signal worth reading. A pet with a high trade value and a soft cash price is one the community likes more than the market does, and that’s worth knowing before you build an inventory around it.',
      '## What Sets The Price',
      'Four things move an Adopt Me cash price, roughly in order of impact.',
      '- Obtainability. A pet still dropping from an egg has a supply line; a pet retired three years ago doesn’t, and every copy in existence is every copy there will ever be. This is why unobtainable legendaries hold value so stubbornly, and why obtainability sits next to the price on our value list rather than buried in a filter.',
      '- Variant. The same pet exists in eight tradable forms and the spread between them is enormous — more on this below.',
      '- Live demand. Demand isn’t rarity. Genuinely rare pets sit unsold when nobody’s chasing them, and common pets move constantly because they’re on every new player’s wishlist. Events shift this hard, pulling attention onto pets nobody had mentioned in a year.',
      '- Data depth. A price built from forty completed sales is a different claim from one built on two. We label the confidence on every pet, because a confident-looking number with nothing behind it is worse than no number at all.',
      '## The Variant Ladder',
      'This is where Adopt Me differs from most trading games, and where quoted values most often mislead.',
      'A single pet exists in eight tradable forms: Normal, Fly, Ride, Fly Ride, Neon, Neon Fly Ride, Mega Neon, and Mega Neon Fly Ride. Fly Ride is the benchmark most traders quote against. Neon is four full-grown copies merged in the Neon Cave. Mega Neon is four Neons — sixteen base pets — and Mega Neon Fly Ride adds potions on top of that.',
      'A Mega Neon Fly Ride is not a slightly better version of a Normal. It represents sixteen of that pet plus the potions, and it prices accordingly. When someone quotes you a value with no variant attached, the number is close to meaningless — which is why our value list lets you reprice the entire table by variant rather than showing a single blended figure.',
      '## How To Read A Value',
      'Four questions before you trust any Adopt Me price, ours included. Which variant is it for? When was it last updated — a value from three months ago has survived several updates and at least one event. What’s it based on, a community vote or observed sales? And how much of it is there, because one sale isn’t a market.',
      'Our own numbers are medians of completed DropMarket sales and active listings, with bundles, account sales and disputed orders stripped out. Where there isn’t enough data for a variant, we label it as an estimate rather than filling the gap with a guess. The full method is on the [pricing methodology page](https://dropmarket.gg/adopt-me/values/methodology).',
      'So what’s a Shadow Dragon worth? In trade, it’s been one of the strongest pets in the game for years — unobtainable, instantly recognisable, and a benchmark other offers get measured against. In cash, the answer moves with how many are listed that week, whether an event has pulled attention elsewhere, and which of the eight variants you mean. The live figure is on the [value list](https://dropmarket.gg/adopt-me/values), and if you’re checking a specific offer, the [WFL calculator](https://dropmarket.gg/adopt-me/calculator) will show you where the two numbers disagree.',
    ],
  },

  // ── 02 · Seller guide (authored draft) ─────────────────────────────────
  {
    slug: 'how-to-sell-adopt-me-pets-for-real-money',
    title: 'How To Sell Adopt Me Pets For Real Money',
    excerpt:
      'From first listing to first payout: what actually sells in the Adopt Me economy, what commission costs, and how the Seller Balance pays you.',
    post_type: 'seller',
    read_minutes: 8,
    published_at: '2026-08-04',
    seo_title: 'How To Sell Adopt Me Pets For Real Money (Seller Guide)',
    seo_description:
      'The full Adopt Me selling playbook: what sells fastest, how listing works, commission costs, getting paid via Seller Balance, and the safety rules.',
    cover: null,
    body: [
      'Adopt Me has been running long enough that most established players are sitting on inventory they’ve forgotten about — retired legendaries from events that ended years ago, Neons built during a grind phase and never used, pets that simply cannot be obtained any more. Behind the in-game trading loop sits a real market where those pets change hands for real money every day. If your inventory has outgrown what you actually play with, it’s sellable. Here’s the whole playbook for turning it into cash on DropMarket, from first listing to first payout.',
      '## What Actually Sells',
      'Not every pet is worth listing. The Adopt Me market prices three things: whether a pet can still be obtained, which of the eight variants it is, and how much live demand there is for it right now. Obtainability is the fundamental — a pet still dropping from an egg has an endless supply line, while a retired one has a fixed population that only shrinks. Variant sets the multiplier, and demand decides how fast it moves. In practice, four kinds of listings sell fastest.',
      '- Unobtainable legendaries. Shadow Dragon, Frost Dragon, Bat Dragon, Evil Unicorn and the rest of that tier. Fixed supply, permanent demand, and a clean listing at a fair price rarely sits long.',
      '- Neons and Mega Neons of desirable pets. You aren’t selling one pet, you’re selling four or sixteen of them plus the hours it took to merge them, and buyers price it that way.',
      '- Fly Ride versions of anything popular. FR is the benchmark buyers search and filter on, so an FR listing competes in the busiest part of the market.',
      '- Current event pets. Demand spikes hard while an event is live and for a short window afterwards, before supply catches up. If you pulled one early, that window is when it’s worth most.',
      'What doesn’t move: common pets that are still obtainable, Normal-form pets outside the top legendaries, and most vehicles, strollers and toys — though a few retired ones surprise people. Rarity alone doesn’t create demand, and plenty of genuinely scarce pets have almost no buyers. Before you price anything, check the [live Adopt Me listings](https://dropmarket.gg/adopt-me/buy-items) and the [value list](https://dropmarket.gg/adopt-me/values) filtered to your variant. Five minutes there tells you which sellers you’re actually competing with and at what price.',
      '## How Listing Works',
      'Listing takes minutes. Head to the [sell page](https://dropmarket.gg/sell), pick Adopt Me and the items category, and describe exactly what you’re selling: pet name, variant, and age. These attributes aren’t decoration — buyers filter and compare on them, so an accurately-attributed listing ranks against the right competition instead of getting lost among things it isn’t. A Fly Ride listed as a Normal will simply be passed over by the people looking for it.',
      'Set your price against comparable live offers rather than against what a value list said last month, and remember that trade value and cash value are different numbers. Trade value tells you whether a pet-for-pet swap balances; it is not a price. The [cash calculator](https://dropmarket.gg/adopt-me/calculator) will total an inventory in one go so you know what you’re working with before you list.',
      'Then choose your delivery window. Adopt Me trades happen in-game, so a realistic window matters more here than in most categories. If you’re online most evenings, a short manual window converts well — buyers pay a premium for speed and discount uncertainty, so a tight window you always hit beats a generous one you occasionally miss.',
      '## What It Costs',
      'DropMarket charges no listing fee. You pay commission only when something actually sells, and commission is set by category. For most categories it lands between 5% and 10%: in-game items are 7%, in-game currency is 5% for most games and 10% for Roblox in-game economies, and top-ups are 5%. Adopt Me pets sell as items, so a $40 legendary costs you $2.80 in commission and the rest is yours. Game accounts are the exception, carrying higher risk-banded rates. The full schedule, including payout fees, is on the [fees page](https://dropmarket.gg/fees).',
      '## Getting Paid',
      'Every order is covered by SafeDrop Buyer Protection — the buyer gets what they ordered, or their money back — and getting paid follows delivery. When your pet sells, you deliver it in-game within your stated window, and the buyer confirms receipt from their order page. Your sale proceeds are credited to your Seller Balance once the buyer confirms delivery or the protection window closes, and from there you can request a payout to your verified payout method whenever it suits you. Payouts require identity verification and a minimum age — that’s a payments requirement rather than a policy we can waive, so it’s worth completing before your first sale rather than after.',
      'This structure is exactly what makes strangers comfortable paying you real money. A buyer knows a seller is never paid for an order that wasn’t delivered as described, so your first sale doesn’t require an established reputation — just an accurate listing and reliable delivery. Reputation compounds quickly from there: exactly-as-described orders turn into reviews, and reviews turn into buyers choosing your offer over a marginally cheaper one. The full lifecycle of a covered order is on the [SafeDrop page](https://dropmarket.gg/safedrop).',
      '## The Safety Rules That Protect You',
      'A few rules keep both your sales and your account standing safe.',
      '- Keep every conversation in the order chat. It’s the record that resolves disputes in your favour when you’ve done everything right.',
      '- Never take a deal off-platform. “Same trade, no fees” is the oldest scam pitch in gaming — off DropMarket there’s no protection for either side, and soliciting off-platform deals gets accounts banned.',
      '- Never ask for or share account credentials. Adopt Me delivery happens in-game, trade to trade, and no password ever needs to change hands.',
      '- Re-read the trade window before every confirmation. The last-second item switch is the most common in-game scam in Adopt Me, and it works precisely because routine trades get confirmed on autopilot.',
      '- Describe the variant and age exactly. An inflated listing doesn’t earn more; it earns a dispute, a refund, and a rating hit that costs you future sales.',
      '- Understand where you stand with Roblox. Selling in-game items for real money sits outside Roblox’s own terms of service, and that risk attaches to your Roblox account rather than to any marketplace. It’s worth knowing before you start rather than after.',
      'That’s the whole system: list accurately, price against the live market, deliver fast, keep everything on-platform. If your inventory is full of pets you’ve long outgrown, [create your first listing](https://dropmarket.gg/sell) — it costs nothing until it sells.',
    ],
  },

  // ── 03 · Value guide (new) ─────────────────────────────────────────────
  {
    slug: 'adopt-me-value-list-2026',
    title: 'The Adopt Me Value List, Explained For 2026',
    excerpt:
      'How our value list is built, what the numbers mean, and how to use it without getting misled — a plain guide to reading Adopt Me values in 2026.',
    post_type: 'value',
    read_minutes: 6,
    published_at: '2026-08-03',
    seo_title: 'Adopt Me Value List 2026 — How To Read It',
    seo_description:
      'A plain guide to the 2026 Adopt Me value list: what each number means, how variants and obtainability move it, and how to check a value before you trade.',
    cover: null,
    body: [
      'A value list is only as good as your ability to read it. Most Adopt Me players glance at a single number, take it as gospel, and get burned when the trade doesn’t balance or the sale doesn’t clear. The list is a starting point, not a verdict — it tells you where a pet sits relative to the rest of the game, but the number in front of you depends entirely on which variant it’s attached to, how obtainable the pet still is, and how fresh the figure is. This guide walks through how our 2026 list is put together and how to read it so the number actually helps you.',
      '## What The List Shows',
      'Our list shows two numbers against every pet: a community trade value and a real cash value in USD. The trade value lets you check whether a pet-for-pet swap balances. The cash value tells you what the pet has actually sold for in money. Most lists show only the first; showing both is the point of ours, because a pet the community rates highly can still sell softly, and knowing that before you trade is the whole advantage.',
      'Each pet also carries its rarity, its obtainability status, and a confidence label on the price. None of that is decoration — it’s the context that decides how much weight to put on the number.',
      '## Why Variant Changes Everything',
      'The single biggest mistake with any Adopt Me value is reading it without a variant attached. A pet exists in eight tradable forms, and the gap between the cheapest and the dearest is enormous. A Normal and a Mega Neon Fly Ride of the same pet are not the same asset with a small markup — the Mega Neon Fly Ride is sixteen of that pet merged together, plus potions.',
      'That’s why our list lets you reprice the entire table by variant with one tap, rather than showing a blended average that’s wrong for every specific case. Always set the variant first, then read the number. A quoted value with no variant is close to meaningless.',
      '## How Obtainability Moves Prices',
      'Obtainability is the quiet force behind most of the big prices. A pet still dropping from an egg has a supply line — however slow, more of them enter the game every day. A pet retired years ago has a fixed population that only ever shrinks as accounts go inactive.',
      'This is why unobtainable legendaries hold their value so stubbornly, and why a newly-retired pet often climbs in the months after its egg leaves the game. When you read a value, check the obtainability tag next to it. A high number on an obtainable pet is more fragile than the same number on one that can never be obtained again.',
      '## Reading The Confidence Label',
      'A price built from forty completed sales is a stronger claim than one built from two, and we won’t pretend otherwise. Every cash value carries a confidence label so you can see how much data sits behind it.',
      '- High confidence means enough recent sales and listings to trust the figure as a working price.',
      '- Lower confidence, or an “estimated” tag, means the market is thin for that pet or variant and the number is a best guess rather than an observed price.',
      'Where we don’t have enough data for a variant, we label it as an estimate rather than inventing a number to fill the gap. A confident-looking figure with nothing behind it is worse than an honest blank. The full method is on the [pricing methodology page](https://dropmarket.gg/adopt-me/values/methodology).',
      '## Using The List To Trade',
      'Put the pieces together and the list becomes a tool rather than a scoreboard. Set the variant, read both numbers, check the obtainability tag and the confidence label, and note the update date — a value that’s survived several updates and an event is a steadier claim than one from last week.',
      'For a specific offer, don’t eyeball it. Drop both sides into the [WFL calculator](https://dropmarket.gg/adopt-me/calculator) and let it run the trade and cash numbers at once, so you can see exactly where the two disagree. The live list is always at the [Adopt Me value list](https://dropmarket.gg/adopt-me/values) — check it against the variant you actually hold before you accept anything.',
    ],
  },

  // ── 04 · Guide (new) ───────────────────────────────────────────────────
  {
    slug: 'best-adopt-me-pets-to-trade',
    title: 'The Best Adopt Me Pets To Trade Right Now',
    excerpt:
      'Which Adopt Me pets hold value, which move fastest, and which quietly lose it — a practical guide to building an inventory that actually trades.',
    post_type: 'guide',
    read_minutes: 6,
    published_at: '2026-08-02',
    seo_title: 'Best Adopt Me Pets To Trade — What Holds Value',
    seo_description:
      'A practical guide to the best Adopt Me pets to trade: which hold value, which move fastest, and how to build an inventory that keeps its worth.',
    cover: null,
    body: [
      'Ask which pet is “best” in Adopt Me and you’ll get a different answer depending on what you actually want — the pet that holds value, the pet that sells fastest, and the pet everyone talks about are rarely the same one. A good trading inventory is built on the first two, not the third. This guide is about which pets are genuinely worth holding and trading in the current game, why they earn that spot, and which popular-looking pets quietly cost you value over time. None of it is a price list — for live numbers, the value list always wins.',
      '## Pets That Hold Value',
      'The steadiest pets to hold are the unobtainable legendaries. Shadow Dragon, Frost Dragon, Bat Dragon, Evil Unicorn and their tier share one thing: no new copies enter the game, ever. Fixed supply plus permanent recognition makes them the closest thing Adopt Me has to a blue-chip asset.',
      'These pets are the benchmark other offers get measured against, which means they’re also the easiest to trade — almost everyone knows roughly what they’re worth, so you spend less time arguing and more time closing. If you’re holding value for the long term, this tier is where it’s safest.',
      '## Pets That Move Fastest',
      'Holding value and selling quickly aren’t the same thing. The pets that move fastest are the recognisable ones newer players actually search for, in the variant they filter on.',
      '- Fly Ride legendaries. FR is the benchmark buyers filter by, so an FR listing sits in the busiest part of the market and clears quickly at a fair price.',
      '- Neons and Mega Neons of popular pets. They carry the value of the four or sixteen pets merged into them, and buyers who want the finished article will pay to skip the grind.',
      '- Current event pets, while the event is live. Demand spikes hard and briefly; if you pulled one early, that window is when it moves fastest and for the most.',
      '## Pets That Quietly Lose Value',
      'Some pets feel valuable and aren’t. Obtainable commons are the obvious trap — however cute, more enter the game every day, so the price only drifts down. Normal-form pets outside the top legendaries are another: without a variant premium, they compete on nothing but recognition.',
      'The subtler trap is rarity without demand. A genuinely scarce pet that nobody’s chasing sits unsold for weeks, while a common pet on every wishlist moves the same afternoon. Rarity sets a floor; it doesn’t create buyers. Don’t build an inventory around scarcity alone.',
      '## How To Read Demand',
      'Demand is the variable most traders ignore, and it’s the one that moves prices in the short term. Events are the clearest driver — a pet nobody mentioned in a year can spike overnight when an update pulls attention back onto it, then settle just as fast.',
      'You don’t need to guess. Watch what’s actually listed and selling: the [live Adopt Me listings](https://dropmarket.gg/adopt-me/buy-items) show you what’s moving and at what price this week, which is a truer read on demand than any static list. Cross-check against the [value list](https://dropmarket.gg/adopt-me/values) to see where live prices sit against the longer-term number.',
      '## Building A Trade Inventory',
      'Put it together and the strategy is simple: hold unobtainable legendaries for value, keep a few fast-moving FR and Neon pets for liquidity, and avoid tying up your inventory in obtainable commons or scarce-but-unwanted pets. Check every pet’s variant before you value it, and read demand from live listings rather than reputation.',
      'Before you commit to any trade, run both sides through the [WFL calculator](https://dropmarket.gg/adopt-me/calculator) — it prices the offer on trade and cash at once, so you can see whether you’re actually gaining value or just moving it around. Build the inventory the numbers support, not the one the hype does.',
    ],
  },

  // ── 05 · Guide (new) ───────────────────────────────────────────────────
  {
    slug: 'adopt-me-neon-and-mega-neon-guide',
    title: 'Adopt Me Neon And Mega Neon Values, Explained',
    excerpt:
      'What a Neon and a Mega Neon actually cost to make, why they’re worth so much more, and when it’s cheaper to buy one than to build it.',
    post_type: 'guide',
    read_minutes: 6,
    published_at: '2026-08-01',
    seo_title: 'Adopt Me Neon & Mega Neon Values — Build Or Buy?',
    seo_description:
      'A clear guide to Adopt Me Neon and Mega Neon values: how many pets each takes, why they cost more, and when buying beats building one yourself.',
    cover: null,
    body: [
      'A Neon pet isn’t a fancier version of a normal one — it’s four of them. A Mega Neon is four Neons, which is sixteen base pets, plus the ages you had to grow each one through. That’s the whole reason Neons and Mega Neons sit so far above their base pets on any value list, and it’s also why quoting a pet’s value without saying which form you mean is close to useless. This guide explains what each form actually costs to make, why the prices land where they do, and how to decide whether it’s cheaper to build one or simply buy the finished pet.',
      '## What A Neon Costs To Make',
      'A Neon is made by merging four full-grown copies of the same pet in the Neon Cave. Full-grown means each of the four has been raised from Newborn through every age stage to Full Grown — four separate grinds before you can even start the merge.',
      'So a Neon’s floor is “four of that pet, fully aged.” Its real cost is higher, because your time raising four pets has a value too. This is why a Neon of a cheap pet can still be worth listing, and why a Neon of an expensive legendary is one of the harder things in the game to assemble.',
      '## What A Mega Neon Costs',
      'A Mega Neon is four Neons merged together. Four Neons is sixteen base pets, each raised to full grown before it became part of a Neon in the first place. On top of the sixteen pets, a Mega Neon has been aged again through its own Neon life stages.',
      'That’s the scale to keep in mind: a Mega Neon Fly Ride of a legendary can represent sixteen of an already-expensive pet plus a pile of potions and hours. It isn’t a small step up from a Neon — it’s another factor of four. Prices reflect that, and anyone quoting a Mega value as if it were slightly above a Neon is misreading the ladder.',
      '## Why They Hold Value',
      'Neons and Mega Neons hold value well for a reason that has nothing to do with luck: they can’t be shortcut. There’s no egg that drops a Mega Neon. Every one in the game was assembled from base pets by someone who did the grind, which puts a hard floor under the supply.',
      '- A Neon bundles four pets and their ages into one asset, so its value tracks the base pet times a real, unavoidable multiplier.',
      '- A Mega Neon bundles sixteen, plus a second round of ageing, so it moves even further above base and is far scarcer.',
      'When the base pet is unobtainable to begin with, the effect compounds — a Neon of a retired legendary is scarce pets multiplied by scarce assembly, which is why those sit near the top of the list.',
      '## Build Or Buy',
      'The practical question is whether to build a Neon yourself or buy one outright. Building costs you four (or sixteen) base pets and the hours to raise them; buying costs money but skips all of it. Which wins depends on what your time is worth and whether you already hold the base pets.',
      'If you’ve got the base pets sitting idle and enjoy the grind, building captures the merge premium yourself. If you’d be buying the base pets specially, or you simply want the finished pet now, buying the assembled Neon is often cheaper once you count the pets and time you’d spend building it. The [Neon calculator](https://dropmarket.gg/adopt-me/neon-calculator) does this maths for you — it compares the cost of building against the cost of buying so you can see which way round is actually cheaper.',
      '## How To Value One',
      'To value a Neon or Mega Neon, start from the base pet and the multiplier, then check the live market rather than trusting the multiplier alone. Four times a base pet is the floor; demand for the finished form can push it above or, occasionally, below that if nobody’s buying that week.',
      'Set the variant on the [value list](https://dropmarket.gg/adopt-me/values) to see the Neon and Mega Neon figures directly instead of doing the multiplication in your head, and run any specific offer through the [WFL calculator](https://dropmarket.gg/adopt-me/calculator) before you accept it. The ladder is steep enough that eyeballing it is exactly how people lose value on Neon trades.',
    ],
  },
]

function plan() {
  console.log(`Adopt Me blog seed — ${POSTS.length} posts:\n`)
  for (const p of POSTS) {
    const h2s = p.body.filter(
      (b) => b.startsWith('## ') && !b.startsWith('### '),
    ).length
    const words = p.body.join(' ').split(/\s+/).length
    console.log(
      `  • ${p.slug}\n      ${p.post_type} · ${h2s} H2s · ~${words} words · /adopt-me/blog/${p.slug}`,
    )
  }
  console.log('')
}

async function run() {
  plan()

  if (!WRITE) {
    console.log('Dry run. Re-run with --write to upsert to the DB.')
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
    )
    process.exit(1)
  }
  const sb = createClient(url, key)

  let ok = 0
  let fail = 0
  for (const p of POSTS) {
    const row = {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      author: 'DropMarket Team',
      read_minutes: p.read_minutes,
      post_type: p.post_type,
      status: 'published',
      primary_game_slug: 'adopt-me',
      game_slugs: ['adopt-me'],
      cover_url: p.cover ?? null,
      body: p.body,
      seo_title: p.seo_title ?? null,
      seo_description: p.seo_description ?? null,
      published_at: new Date(p.published_at).toISOString(),
    }
    const { error } = await sb
      .from('blog_posts')
      .upsert(row, { onConflict: 'primary_game_slug,slug' })
    if (error) {
      console.log(`  ✗ ${p.slug}: ${error.message}`)
      fail++
    } else {
      console.log(`  ✓ ${p.slug}  → /adopt-me/blog/${p.slug}`)
      ok++
    }
  }

  console.log(`\nDone. ${ok} upserted, ${fail} failed.`)
  process.exit(fail > 0 ? 1 : 0)
}

run()
