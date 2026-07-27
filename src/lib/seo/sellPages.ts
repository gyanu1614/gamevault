/**
 * Programmatic SEO Landing Pages — SELLER intent.
 *
 * Sibling to `landingPages.ts` (which targets "buy X" queries). This file
 * defines the data for /sell/[seoSlug] routes, targeting seller-intent search
 * queries like "sell roblox account", "where to sell fortnite account",
 * "sell game currency for money".
 *
 * Add new pages by appending to SELL_PAGES and they'll automatically appear in
 * the sitemap and be rendered by the dynamic route.
 *
 * Copy rule (inherited from templates.ts): PSP-safe wording only —
 * "SafeDrop Buyer Protection", "you're paid after the buyer confirms" — never
 * "escrow / we hold funds". Fee specifics live on /fees; pages link there
 * rather than hardcoding a full schedule that could drift.
 */

export interface SellPageFAQ {
  q: string
  a: string
}

export interface SellAboutSection {
  /** Sub-heading (H3) — keyword-targeted. */
  heading: string
  /** Body copy; blank lines split into paragraphs. */
  body: string
}

export interface SellPage {
  /** URL segment: /sell/<slug> */
  slug: string
  /** <title> tag */
  title: string
  /** <meta description> */
  description: string
  /** Hero headline */
  headline: string
  /** Hero sub-copy — the seller pitch */
  subCopy: string
  /**
   * Game slug (matches games.slug) — used to show live market activity for
   * that game and to link "browse the market". null = cross-game page.
   */
  gameSlug: string | null
  /** Category slug (matches categories.slug) — null = all categories. */
  categorySlug: string | null
  /** Emoji shown next to headline */
  emoji: string
  /** Human label for the thing being sold, e.g. "Roblox account". */
  assetLabel: string
  /** Long-form, keyword-rich "About" prose (unique per page — SEO depth). */
  about: SellAboutSection[]
  /** FAQPage Schema questions */
  faqs: SellPageFAQ[]
  /** Schema.org category name */
  schemaCategory: string
}

/* Shared seller FAQs — same answers on every page so the fee/payout story is
   consistent. Page-specific FAQs are prepended per entry. */
const COMMON_SELLER_FAQS: SellPageFAQ[] = [
  {
    q: 'How much does it cost to sell on DropMarket?',
    a: 'Listing is free — you only pay commission when your item actually sells, starting from 5%. Exact rates by category and risk band are on our Fees & Charges page. There are no monthly fees and no charge for listings that don\'t sell.',
  },
  {
    q: 'How and when do I get paid?',
    a: 'Your sale proceeds are credited to your Seller Balance once the buyer confirms delivery (or the protection window closes). Because payment is held by SafeDrop and released on confirmation, you\'re protected from the chargebacks that hit sellers on PayPal or direct trades.',
  },
  {
    q: 'Is it safe to sell here?',
    a: 'Yes. Buyers pay up front into SafeDrop before you deliver, so you never hand over goods hoping to be paid. Funds are released to you on confirmation and can\'t be clawed back weeks later. Every buyer and seller is account-verified.',
  },
  {
    q: 'How do I start selling?',
    a: 'Join the founding-seller programme — it takes a minute, and founding sellers get lower fees and early access. You add payout details later, once you\'re ready to list your first item.',
  },
]

/* ------------------------------------------------------------------ */
/* Pages                                                                */
/* ------------------------------------------------------------------ */

export const SELL_PAGES: SellPage[] = [
  /* ---- Roblox ---- */
  {
    slug: 'sell-roblox-account',
    title: 'Sell Your Roblox Account — Fast, Safe Payouts',
    description:
      'Sell your Roblox account for real money on DropMarket. List free, keep more with low commission, and get paid safely after the buyer confirms — chargeback-protected by SafeDrop.',
    headline: 'Sell Your Roblox Account',
    subCopy:
      'Turn your Roblox account into real cash. List for free, pay commission only when it sells, and get paid safely once the buyer confirms — no chargebacks, no hassle.',
    gameSlug: 'roblox',
    categorySlug: 'accounts',
    emoji: '🟥',
    assetLabel: 'Roblox account',
    schemaCategory: 'Roblox Accounts',
    about: [
      {
        heading: 'How much is a Roblox account (and 1,000 Robux) worth?',
        body:
          "A Roblox account's value comes from four things: its Robux balance, any rare limited items (limiteds and UGC), Roblox Premium, and account age. Robux is the anchor. At Roblox's official Store rate, Robux costs about $0.0125 each — 400 Robux is $4.99, 800 is $9.99 — so 1,000 Robux is worth roughly $12.50 at retail.\n\nOn DropMarket you're buying from other players, not the official Store, so Robux and Robux-loaded accounts usually change hands for well below retail — often around $4–5 per 1,000 Robux. Rare limiteds can be worth far more than the Robux balance: sought-after hats and UGC trade for thousands of Robux each, so a stacked inventory can push an account into the hundreds of dollars.",
      },
      {
        heading: 'How to sell your Roblox account',
        body:
          'List it free and price it against comparable live listings, with a clear description of the Robux balance, limiteds, Premium status and account age. When a buyer purchases, they pay into SafeDrop up front. You hand over the credentials, and once the buyer confirms, your proceeds are released to your Seller Balance — protected from chargebacks. Commission starts at just 5%, so you keep more than on the big marketplaces. Change the account email and password before delivery, and only trade through the platform.',
      },
    ],
    faqs: [
      {
        q: 'How much can I sell my Roblox account for?',
        a: 'It depends on Robux balance, rare limiteds, account age, and premium status. Check current live listings on DropMarket for comparable accounts to price yours competitively.',
      },
      ...COMMON_SELLER_FAQS,
    ],
  },

  /* ---- Fortnite ---- */
  {
    slug: 'sell-fortnite-account',
    title: 'Sell Your Fortnite Account — OG Skins & Rare Cosmetics',
    description:
      'Sell your Fortnite account safely on DropMarket. OG skins and rare cosmetics command a premium. List free, low commission, chargeback-protected payouts via SafeDrop.',
    headline: 'Sell Your Fortnite Account',
    subCopy:
      'Got OG skins or a stacked locker? Turn your Fortnite account into cash. List for free and get paid safely after the buyer confirms — SafeDrop protects you from chargebacks.',
    gameSlug: 'fortnite',
    categorySlug: 'accounts',
    emoji: '🎮',
    assetLabel: 'Fortnite account',
    schemaCategory: 'Fortnite Accounts',
    about: [
      {
        heading: 'What is a Fortnite account worth?',
        body:
          "A Fortnite account's value is driven by its cosmetics, not by any wallet balance. OG skins from Chapter 1 (Renegade Raider, Black Knight, Skull Trooper, Ghoul Trooper), rare back blings, early Battle Pass tiers and limited emotes are what buyers pay a premium for. A rare OG locker can be worth hundreds of dollars, while a newer account with a few battle-pass skins sits at the lower end.\n\nBecause value lives in the locker, the detail of your listing matters: accounts with a clearly itemised skin list sell faster and for more than vague ones.",
      },
      {
        heading: 'How to sell your Fortnite account',
        body:
          'List free, itemise the locker (OG skins, rare emotes, V-Bucks balance, account level), and price against comparable live listings. The buyer pays into SafeDrop before you deliver the linked Epic credentials; once they confirm, your payout is released and protected from chargebacks. Commission starts at 5%. Secure the linked email and enable a fresh password before handing over the account.',
      },
    ],
    faqs: [
      {
        q: 'What makes my Fortnite account worth more?',
        a: 'OG skins (Season 1–3), rare back blings, high Battle Pass levels, and rare emotes all raise value. List exactly what\'s included — detailed lockers sell faster and for more.',
      },
      ...COMMON_SELLER_FAQS,
    ],
  },

  /* ---- Valorant ---- */
  {
    slug: 'sell-valorant-account',
    title: 'Sell Your Valorant Account — Ranked & Skinned',
    description:
      'Sell your Valorant account for real money. Ranked accounts and rare skin collections sell fast on DropMarket. Free to list, low commission, SafeDrop chargeback protection.',
    headline: 'Sell Your Valorant Account',
    subCopy:
      'Cash out your ranked or skin-stacked Valorant account. List for free, keep more with low fees, and get paid safely once the buyer confirms.',
    gameSlug: 'valorant',
    categorySlug: 'accounts',
    emoji: '🔴',
    assetLabel: 'Valorant account',
    schemaCategory: 'Valorant Accounts',
    about: [
      {
        heading: 'How much is a Valorant account worth?',
        body:
          "Two things set a Valorant account's price: its competitive rank and its skin collection. High-rank accounts (Immortal, Radiant) and accounts loaded with premium bundles — Reaver, Elderflame, Prime, Champions — command the most. Valorant Points spent on the store don't refund, so a big skin inventory represents real sunk value that buyers will pay for.\n\nRegion matters too: accounts are tied to a server (NA, EU, KR), so list yours clearly so the right buyers find it.",
      },
      {
        heading: 'How to sell your Valorant account',
        body:
          'List free with your rank, agent roster, region and full skin inventory, and price against comparable live listings. The buyer pays into SafeDrop up front; you deliver the Riot credentials, and once they confirm, your payout is released — protected from chargebacks. Commission starts at 5%. Update the linked email and password before handing the account over.',
      },
    ],
    faqs: [
      {
        q: 'What Valorant accounts sell best?',
        a: 'Rare skins (Reaver, Elderflame, Champions bundles), high rank, and a full agent roster all drive value. List your rank, skin inventory, and region so buyers can find you.',
      },
      ...COMMON_SELLER_FAQS,
    ],
  },

  /* ---- CS2 ---- */
  {
    slug: 'sell-cs2-account',
    title: 'Sell Your CS2 Account — Prime, Ranks & Inventory',
    description:
      'Sell your Counter-Strike 2 account safely on DropMarket. Prime status, ranks, and skin inventories welcome. Free to list, low commission, chargeback-protected payouts.',
    headline: 'Sell Your CS2 Account',
    subCopy:
      'Sell your Counter-Strike 2 account — Prime, ranks, medals or a loaded inventory. List for free and get paid safely after the buyer confirms.',
    gameSlug: 'cs2',
    categorySlug: 'accounts',
    emoji: '🔫',
    assetLabel: 'CS2 account',
    schemaCategory: 'Counter-Strike 2 Accounts',
    about: [
      {
        heading: 'What is a CS2 account worth?',
        body:
          "A Counter-Strike 2 account's value comes from Prime status, its competitive rank and Premier rating, service medals and hours played, and — often most of all — its inventory. Rare skins, knives, gloves and StatTrak items can be worth far more than the account itself. A Prime account with a loaded inventory and high rating sits at the top end; a fresh non-Prime account at the bottom.\n\nList your inventory highlights and float values clearly — skin-heavy accounts are priced on the inventory, so detail drives the sale.",
      },
      {
        heading: 'How to sell your CS2 account',
        body:
          'List free with Prime status, rank/Premier rating, hours, medals and your standout inventory items, and price against comparable live listings. The buyer pays into SafeDrop before delivery; once they confirm the Steam credentials work, your payout is released and protected from chargebacks. Commission starts at 5%. Secure the Steam email and password before handing over the account.',
      },
    ],
    faqs: [
      {
        q: 'What raises my CS2 account value?',
        a: 'Prime status, service medals, rank, hours played, and inventory (rare skins, knives, gloves) all matter. Spell out what\'s on the account to sell faster.',
      },
      ...COMMON_SELLER_FAQS,
    ],
  },

  /* ---- Genshin Impact ---- */
  {
    slug: 'sell-genshin-account',
    title: 'Sell Your Genshin Impact Account — 5-Star Rosters',
    description:
      'Sell your Genshin Impact account for real money. Strong 5-star rosters and high AR sell fast on DropMarket. Free to list, low commission, SafeDrop chargeback protection.',
    headline: 'Sell Your Genshin Impact Account',
    subCopy:
      'Retiring from Teyvat? Sell your Genshin Impact account — 5-star characters and weapons hold real value. List free and get paid safely once the buyer confirms.',
    gameSlug: 'genshin-impact',
    categorySlug: 'accounts',
    emoji: '⚔️',
    assetLabel: 'Genshin Impact account',
    schemaCategory: 'Genshin Impact Accounts',
    about: [
      {
        heading: 'How much is a Genshin Impact account worth?',
        body:
          "A Genshin Impact account's value is built on its limited 5-star characters and signature weapons, their constellation and refinement levels, Adventure Rank, and the breadth of the roster. Meta and limited-run 5-stars — and high-constellation copies of them — are what push prices up, because they can't be bought directly and often take heavy pulling to obtain. Primogem and Genesis Crystal balances add to the total.\n\nList your key 5-stars with their constellations up front — that roster is what buyers price the account on.",
      },
      {
        heading: 'How to sell your Genshin Impact account',
        body:
          'List free with your 5-star roster, constellations, signature weapons, Adventure Rank and server, and price against comparable live listings. The buyer pays into SafeDrop up front; you deliver the HoYoverse credentials, and once they confirm, your payout is released — protected from chargebacks. Commission starts at 5%. Change the linked email and password before handing over the account.',
      },
    ],
    faqs: [
      {
        q: 'What makes a Genshin account valuable?',
        a: 'Limited 5-star characters and signature weapons, high constellations, Adventure Rank, and a wide roster all raise value. List your key 5-stars and their constellations up front.',
      },
      ...COMMON_SELLER_FAQS,
    ],
  },

  /* ---- Cross-game currency ---- */
  {
    slug: 'sell-game-currency',
    title: 'Sell Game Currency for Real Money — Low Fees',
    description:
      'Sell in-game currency and gold for real money on DropMarket. From 5% commission, free to list, and chargeback-protected payouts via SafeDrop once the buyer confirms.',
    headline: 'Sell Game Currency for Real Money',
    subCopy:
      'Sitting on stockpiled gold, coins, or points? Sell it for real money. Low fees, free listings, and safe payouts once the buyer confirms — you keep more of every sale.',
    gameSlug: null,
    categorySlug: 'currency',
    emoji: '💰',
    assetLabel: 'game currency',
    schemaCategory: 'Game Currency Marketplace',
    about: [
      {
        heading: 'How much is game currency worth?',
        body:
          "In-game currency — Robux, V-Bucks, gold, points — has an official store price, and a player-to-player price that usually sits below it. Robux, for example, retails at about $12.50 per 1,000 through Roblox's Store, but trades for less between players. Gold and coins in MMOs are priced per thousand or per million depending on supply. The gap between the official rate and the player rate is exactly why a resale market exists — and why buyers come to marketplaces like DropMarket to pay less, and sellers come to cash out surplus.",
      },
      {
        heading: 'How to sell game currency',
        body:
          'Pick your game and currency, list free, and price per unit against comparable live listings. The buyer pays into SafeDrop before you deliver; once they confirm the currency landed, your payout is released to your Seller Balance — protected from chargebacks. Commission starts at 5%, so you keep more of every sale, and there are no listing fees for stock that doesn\'t move.',
      },
    ],
    faqs: [
      {
        q: 'Which games\' currency can I sell?',
        a: 'Any game in our catalog that supports a currency category — Robux, V-Bucks, gold, points and more. Suggest new games from your seller dashboard or our Discord.',
      },
      ...COMMON_SELLER_FAQS,
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** Look up a sell page definition by slug. Returns null if not found. */
export function getSellPage(slug: string): SellPage | null {
  return SELL_PAGES.find((p) => p.slug === slug) ?? null
}

/** All slugs — used for generateStaticParams and sitemap. */
export function getAllSellPageSlugs(): string[] {
  return SELL_PAGES.map((p) => p.slug)
}
