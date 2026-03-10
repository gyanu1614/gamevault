/**
 * Programmatic SEO Landing Pages
 *
 * Defines the data for /buy/[seoSlug] routes.
 * Each entry maps a URL slug to metadata, game/category filter params,
 * hero copy, FAQ items, and Schema.org hints.
 *
 * Add new pages by appending to LANDING_PAGES and they'll automatically
 * appear in the sitemap and be rendered by the dynamic route.
 */

export interface LandingPageFAQ {
  q: string
  a: string
}

export interface LandingPage {
  /** URL segment: /buy/<slug> */
  slug: string
  /** <title> tag */
  title: string
  /** <meta description> */
  description: string
  /** Hero headline (supports {{count}} placeholder filled at runtime) */
  headline: string
  /** Hero sub-copy */
  subCopy: string
  /** Game slug used to filter listings from DB (matches games.slug) */
  gameSlug: string | null
  /** Category slug (matches categories.slug) — null = all categories for game */
  categorySlug: string | null
  /** Emoji shown next to headline */
  emoji: string
  /** FAQPage Schema questions */
  faqs: LandingPageFAQ[]
  /** Schema.org Product category name */
  schemaCategory: string
}

/* ------------------------------------------------------------------ */
/* Pages                                                                */
/* ------------------------------------------------------------------ */

export const LANDING_PAGES: LandingPage[] = [
  /* ---- Roblox ---- */
  {
    slug: 'buy-roblox-accounts',
    title: 'Buy Roblox Accounts – Safe & Instant Delivery | GameVault',
    description:
      'Browse thousands of verified Roblox accounts for sale. All listings protected by VaultShield escrow. Instant delivery, buyer guarantee.',
    headline: 'Buy Roblox Accounts',
    subCopy:
      'Find high-value, verified Roblox accounts from trusted sellers. Every purchase protected by VaultShield.',
    gameSlug: 'roblox',
    categorySlug: 'accounts',
    emoji: '🟥',
    schemaCategory: 'Roblox Accounts',
    faqs: [
      {
        q: 'Is it safe to buy a Roblox account on GameVault?',
        a: 'Yes. All payments are held in VaultShield escrow until you confirm receipt. Funds only release to the seller after you verify the account credentials.',
      },
      {
        q: 'What Roblox accounts are available?',
        a: 'We carry accounts ranging from starter accounts with Robux to rare limited-edition accounts. Use our filters to browse by price, level, or rare items.',
      },
      {
        q: 'How fast will I receive my Roblox account?',
        a: 'Most sellers deliver credentials within minutes. The listing page shows the seller\'s stated delivery time.',
      },
      {
        q: 'What if the account details don\'t work?',
        a: 'Open a dispute within 48 hours. GameVault will hold the payment in escrow until the issue is resolved or issue a full refund.',
      },
    ],
  },
  {
    slug: 'buy-roblox-items',
    title: 'Buy Roblox Items & Limiteds | GameVault',
    description:
      'Shop rare Roblox limiteds, UGC items, and accessories. Secure escrow, instant delivery, trusted sellers.',
    headline: 'Buy Roblox Items & Limiteds',
    subCopy:
      'Score rare Roblox limited items and UGC accessories from verified sellers — all protected by VaultShield.',
    gameSlug: 'roblox',
    categorySlug: 'items',
    emoji: '🟥',
    schemaCategory: 'Roblox Items',
    faqs: [
      {
        q: 'Can I buy Roblox limiteds here?',
        a: 'Yes! GameVault sellers list rare limiteds, classic hats, and UGC items. Browse by item name or price.',
      },
      {
        q: 'How are Roblox items delivered?',
        a: 'Sellers typically trade items in-game or transfer via a pre-arranged Roblox trade. The delivery method is listed on each item page.',
      },
      {
        q: 'Are there fake limited item listings?',
        a: 'Sellers must pass identity verification. Fraudulent listings result in permanent bans and full buyer refunds.',
      },
    ],
  },

  /* ---- Valorant ---- */
  {
    slug: 'buy-valorant-accounts',
    title: 'Buy Valorant Accounts – Radiant, Immortal & More | GameVault',
    description:
      'Find Valorant accounts with rare skins, high ranks, and low prices. VaultShield buyer protection on every order.',
    headline: 'Buy Valorant Accounts',
    subCopy:
      'Skip the grind. Purchase ranked Valorant accounts with top-tier skins from verified sellers.',
    gameSlug: 'valorant',
    categorySlug: 'accounts',
    emoji: '🔴',
    schemaCategory: 'Valorant Accounts',
    faqs: [
      {
        q: 'Can I buy a ranked Valorant account?',
        a: 'Yes. Sellers list accounts across all ranks from Iron to Radiant. Filter by rank range to find your ideal account.',
      },
      {
        q: 'Will my Valorant account get banned after purchase?',
        a: 'Account trading carries inherent risk per Riot\'s ToS. GameVault sellers are rated by track record; choose sellers with high ratings and clear skin inventories for lowest risk.',
      },
      {
        q: 'How does VaultShield protect me?',
        a: 'Payment is held in escrow until you confirm the account works and you\'ve changed the credentials. If there\'s an issue, we mediate and refund if necessary.',
      },
    ],
  },
  {
    slug: 'buy-valorant-points',
    title: 'Buy Valorant Points (VP) – Cheapest Rates | GameVault',
    description:
      'Get Valorant Points for less. Verified sellers, instant delivery, buyer protection on every VP purchase.',
    headline: 'Buy Valorant Points',
    subCopy:
      'Top up your VP wallet at below-market rates from trusted GameVault sellers.',
    gameSlug: 'valorant',
    categorySlug: 'currency',
    emoji: '🔴',
    schemaCategory: 'Valorant Currency',
    faqs: [
      {
        q: 'How are Valorant Points delivered?',
        a: 'Sellers typically gift VP via the Valorant in-game gift system or through Riot gift cards. The exact method is on the listing page.',
      },
      {
        q: 'Is buying VP against Riot\'s ToS?',
        a: 'Receiving gifted VP through the official Riot store is the safest method. GameVault sellers use legitimate gifting methods where possible.',
      },
    ],
  },

  /* ---- Fortnite ---- */
  {
    slug: 'buy-fortnite-accounts',
    title: 'Buy Fortnite Accounts – Rare Skins & OG Accounts | GameVault',
    description:
      'Buy OG Fortnite accounts with rare skins like Black Knight, Skull Trooper, and more. Safe escrow, fast delivery.',
    headline: 'Buy Fortnite Accounts',
    subCopy:
      'Find OG Fortnite accounts with season-1 skins and rare cosmetics. All sellers verified, all payments protected.',
    gameSlug: 'fortnite',
    categorySlug: 'accounts',
    emoji: '🎮',
    schemaCategory: 'Fortnite Accounts',
    faqs: [
      {
        q: 'What makes a Fortnite account valuable?',
        a: 'Accounts with OG skins (Season 1-3), rare back blings, or high-level Battle Passes command a premium. Each listing details exactly what\'s included.',
      },
      {
        q: 'How do I receive a Fortnite account?',
        a: 'Sellers transfer email credentials, including the linked Epic account. After purchase, change all passwords and add 2FA immediately.',
      },
      {
        q: 'What if the Epic account is locked after purchase?',
        a: 'Open a dispute within 48 hours. GameVault holds the escrow payment until the issue is resolved.',
      },
    ],
  },
  {
    slug: 'buy-fortnite-skins',
    title: 'Buy Fortnite Skins & Cosmetics | GameVault',
    description:
      'Purchase rare Fortnite skins, emotes, pickaxes, and wraps from verified sellers. Instant delivery.',
    headline: 'Buy Fortnite Skins & Cosmetics',
    subCopy:
      'Get the rarest Fortnite cosmetics without grinding. Verified sellers, VaultShield protected.',
    gameSlug: 'fortnite',
    categorySlug: 'items',
    emoji: '🎮',
    schemaCategory: 'Fortnite Cosmetics',
    faqs: [
      {
        q: 'Can I buy individual Fortnite skins?',
        a: 'Sellers typically transfer skins via gifting during a live sale window, or as part of an account bundle. Check individual listing details.',
      },
    ],
  },

  /* ---- League of Legends ---- */
  {
    slug: 'buy-league-of-legends-accounts',
    title: 'Buy League of Legends Accounts – Smurf & Ranked | GameVault',
    description:
      'Shop LoL smurf accounts, ranked accounts, and accounts with rare champion/skin collections. Secure, fast, trusted.',
    headline: 'Buy League of Legends Accounts',
    subCopy:
      'Find LoL smurf accounts, high-elo mains, and accounts with full champion pools at the best prices.',
    gameSlug: 'league-of-legends',
    categorySlug: 'accounts',
    emoji: '⚔️',
    schemaCategory: 'League of Legends Accounts',
    faqs: [
      {
        q: 'What is a LoL smurf account?',
        a: 'A smurf is a fresh or unranked account for experienced players who want to play at lower MMR. GameVault listings are clearly labeled as smurf or ranked.',
      },
      {
        q: 'Are LoL accounts region-locked?',
        a: 'Yes. Accounts are tied to a server region (NA, EUW, KR, etc.). Check the listing region before buying.',
      },
      {
        q: 'Can I get banned for buying a LoL account?',
        a: 'Riot\'s ToS prohibits account buying. Purchase at your own risk; select high-rated sellers with clean histories for best results.',
      },
    ],
  },

  /* ---- General / Cross-game ---- */
  {
    slug: 'sell-game-accounts',
    title: 'Sell Your Game Accounts Safely | GameVault',
    description:
      'List your gaming account or items on GameVault and earn. 0% listing fee, automatic payouts via Stripe, VaultShield protection for sellers.',
    headline: 'Sell Your Game Accounts',
    subCopy:
      'Turn your gaming assets into real money. List for free, get paid via Stripe, keep 100% after buyer protection fee.',
    gameSlug: null,
    categorySlug: null,
    emoji: '💰',
    schemaCategory: 'Game Account Marketplace',
    faqs: [
      {
        q: 'How much does it cost to sell on GameVault?',
        a: 'Listing is free. GameVault takes a small buyer protection fee from the buyer side; sellers keep the full listed price.',
      },
      {
        q: 'How do I get paid?',
        a: 'Connect your bank account via Stripe. Once the buyer confirms delivery, funds are released automatically. New sellers have a 14-day hold on the first 3 orders.',
      },
      {
        q: 'Can I sell accounts from any game?',
        a: 'Yes, if the game is in our catalog. Suggest new games via our Discord or seller dashboard.',
      },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** Look up a landing page definition by slug. Returns null if not found. */
export function getLandingPage(slug: string): LandingPage | null {
  return LANDING_PAGES.find((p) => p.slug === slug) ?? null
}

/** All slugs — used for generateStaticParams and sitemap. */
export function getAllLandingPageSlugs(): string[] {
  return LANDING_PAGES.map((p) => p.slug)
}
