/**
 * Every string on /[game]/free-items, built from the researched guide
 * (lib/values/free-guide) and the Shop box odds (lib/values/shop-boxes).
 * Written for search first — the H1, the section heads and the FAQ carry
 * the phrases players type ("how to get free godlies in mm2", "free mm2
 * items", "mm2 codes") — and true to the research: every number is computed
 * from the seed's own figures (unit-tested against its text), derived ones
 * say "on average", and the FAQ + FAQPage schema reuse the visible sentences.
 */

import {
  MM2_ECONOMY,
  approx,
  expectedSpins,
  fmtCount,
  roundsFor,
  seerSpins,
  spinsForChance,
  type FreeGuide,
  type TierOdds,
} from '@/lib/values/free-guide'

export interface CopyCtx {
  /** "Murder Mystery 2" */
  gameName: string
  /** "MM2" */
  shortName: string
}

export type WayIconKey =
  | 'coins'
  | 'craft'
  | 'pass'
  | 'quests'
  | 'live'
  | 'gift'
  | 'trade'
  | 'trophy'
  | 'level'
  | 'calendar'

export interface WayRow {
  slug: string
  icon: WayIconKey
  title: string
  /** What you get — one line. */
  get: string
  /** How — one line. */
  how: string
  /** The number for the row, right-aligned on desktop. */
  metric: { value: string; label: string }
  /** Catalogue slugs whose art + value page the row shows (first = the art). */
  featured: string[]
}

/** Live prices the copy may quote (cheapest USD by item slug). */
export type PriceOf = (slug: string) => number | null

export const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** The figures every block quotes, computed once from the box odds. */
export function freeNumbers(odds: TierOdds) {
  const godlySpins = expectedSpins(odds.godly)
  const seer = Math.round(seerSpins(odds))
  return {
    godlyPct: odds.godly,
    chromaPct: odds.chroma,
    godlySpins,
    godlyCoins: godlySpins * MM2_ECONOMY.spinCoins,
    godlyRounds: roundsFor(godlySpins * MM2_ECONOMY.spinCoins),
    godlyHalf: spinsForChance(odds.godly, 0.5),
    godlyNinety: approx(spinsForChance(odds.godly, 0.9), 10),
    chromaSpins: Math.round(expectedSpins(odds.chroma)),
    seerSpins: seer,
    seerRounds: approx(roundsFor(seer * MM2_ECONOMY.spinCoins), 100),
    seerLegendaries: MM2_ECONOMY.seerLegendaryShards / MM2_ECONOMY.shardsPerSalvage,
  }
}
export type FreeNumbers = ReturnType<typeof freeNumbers>

/**
 * The honest "nothing here" rows, in the order the section head names them
 * (Levels, Logins, Leaderboards); every other way is a real, numbered one.
 */
export const NOTHING_ORDER = ['leveling-and-prestige', 'daily-login-rewards', 'event-leaderboards'] as const
export const NOTHING_HERE = new Set<string>(NOTHING_ORDER)

export const pageTitle = (c: CopyCtx) => `How to Get Free Godlies and Items in ${c.shortName} (Every Real Way, 2026)`

export const metaTitle = (c: CopyCtx) => `How to Get Free Godlies in ${c.shortName}: Every Real Way (2026)`

export function metaDescription(c: CopyCtx, n: FreeNumbers, realWays: number): string {
  return `${realWays} real ways to get free items in ${c.gameName}, with the odds: Seer is a guaranteed free Godly (~${n.seerSpins} spins on average), a box Godly is ${n.godlyPct}% (~${fmtCount(n.godlySpins)} spins). No ${c.shortName} code works.`
}

/** The answer-first lead under the H1: the ways, the honest odds, the codes verdict. */
export function lead(c: CopyCtx, n: FreeNumbers, realWays: number): { strong: string; rest: string } {
  return {
    strong: `There are ${realWays} real ways to get free items in ${c.gameName}, and no code works.`,
    rest: `The surest free Godly is Seer: craft it from ${MM2_ECONOMY.seerLegendaryShards} Legendary Shards, about ${n.seerSpins} box spins on average. A Godly straight from a box is a ${n.godlyPct}% roll, about ${fmtCount(n.godlySpins)} spins on average.`,
  }
}

/** The numbered rows: one per researched way, in the seed's order. */
export function wayRows(c: CopyCtx, g: FreeGuide, n: FreeNumbers, priceOf: PriceOf): WayRow[] {
  const raygun = priceOf('raygun')
  const rows: Record<string, Omit<WayRow, 'slug'>> = {
    'coins-and-boxes': {
      icon: 'coins',
      title: 'Unbox Godlies With Free Coins',
      get: `A random weapon from 11 Shop boxes, each with a Godly and its Chroma, or a Godly Fire pet from the Common Egg.`,
      how: `Pick up Coins in any round (${MM2_ECONOMY.coinsPerRound} a round, ${MM2_ECONOMY.eliteCoinsPerRound} with Elite); a spin costs ${fmtCount(MM2_ECONOMY.spinCoins)}. A ${n.godlyPct}% Godly takes ${fmtCount(n.godlyCoins)} Coins, about ${fmtCount(n.godlyRounds)} full-bag rounds, on average.`,
      metric: { value: `~${fmtCount(n.godlySpins)} Spins`, label: 'Per Godly, on Average' },
      featured: ['lightbringer'],
    },
    'salvage-and-craft': {
      icon: 'craft',
      title: 'Craft a Seer, the Guaranteed Free Godly',
      get: `Seer, a Godly knife, with no luck involved.`,
      how: `Salvage weapons for ${MM2_ECONOMY.shardsPerSalvage} shards each and craft ${MM2_ECONOMY.shardsPerCraft} shards into the next rarity. ${MM2_ECONOMY.seerLegendaryShards} Legendary Shards (${n.seerLegendaries} Legendaries salvaged) make a Seer.`,
      metric: { value: `~${n.seerSpins} Spins`, label: 'Per Seer, on Average' },
      featured: ['seer'],
    },
    'event-pass': {
      icon: 'pass',
      title: 'Finish an Event Battle Pass',
      get: `Event weapons, pets and effects on every tier, ending in an event Godly${raygun != null ? ` (Halloween 2025's Raygun now sells for ${usd(raygun)})` : ''}.`,
      how: `During Halloween and Christmas, rounds drop Candies or Snow Tokens instead of Coins. Spend them to unlock tiers.`,
      metric: { value: '109,200 Candies', label: 'Halloween 2025 Full Pass' },
      featured: ['raygun', 'snowcannon'],
    },
    'event-quests': {
      icon: 'quests',
      title: 'Complete Event Daily and Weekly Quests',
      get: `Event currency, plus weapons, effects or emotes for finishing enough dailies.`,
      how: `3 to 6 daily quests (reset 08:00 UTC) and weekly quests (reset Thursday), only while an event runs.`,
      metric: { value: 'Free', label: 'A Few Rounds a Day' },
      featured: [],
    },
    'live-events-and-hunts': {
      icon: 'live',
      title: 'Join Live Events and Item Hunts',
      get: `One-off free items, like the Lil' Alien pet (Halloween 2025) and the Reindeer knife (Christmas 2025).`,
      how: `Be in the game when the live event plays, or finish the hunt before it closes. These items never come back.`,
      metric: { value: 'Guaranteed', label: 'If You Join in Time' },
      featured: [],
    },
    'christmas-gifts': {
      icon: 'gift',
      title: 'Receive Christmas Gifts From Other Players',
      get: `A random Shop-box weapon per Gift, at normal box odds.`,
      how: `Other players buy Gifts (600 Snow Tokens each in 2025) and can only open them on someone else.`,
      metric: { value: 'Free', label: 'Christmas Events Only' },
      featured: [],
    },
    'trading-up': {
      icon: 'trade',
      title: 'Trade Up (the Honest Way)',
      get: `Better items over time, through small fair-or-better trades.`,
      how: `Reach Level 10, check values before every trade, take small overpays and never send first.`,
      metric: { value: 'Level 10', label: 'To Unlock Trading' },
      featured: [],
    },
    'event-leaderboards': {
      icon: 'trophy',
      title: 'Event Leaderboards: Top 100 Only',
      get: `Untradeable trophy weapons for the top 100 event currency collectors.`,
      how: `Free in theory, but it takes extreme play time against hundreds of thousands of players.`,
      metric: { value: 'Top 100', label: 'Not Realistic for Most' },
      featured: [],
    },
    'leveling-and-prestige': {
      icon: 'level',
      title: 'Leveling Up and Prestige: No Items',
      get: `No weapons, pets or Coins. Level 10 unlocks trading; levels 10 to 100 give Roblox badges.`,
      how: `Prestige (from Level 100, up to Prestige X) only resets your level.`,
      metric: { value: '0 Items', label: 'At Any Level' },
      featured: [],
    },
    'daily-login-rewards': {
      icon: 'calendar',
      title: 'Daily Login Rewards: None',
      get: `Outside events, ${c.shortName} has no daily login reward, spin wheel or group reward.`,
      how: `The closest thing is event daily quests, which only run during events.`,
      metric: { value: 'None', label: 'Outside Events' },
      featured: [],
    },
  }
  return g.ways.map((w) => {
    const r = rows[w.slug]
    if (!r) throw new Error(`free-items copy: no row for way "${w.slug}"`)
    return { slug: w.slug, ...r }
  })
}

export const realWaysHeading = (c: CopyCtx, count: number) => `${count} Real Ways to Get Free Items in ${c.shortName}`
export const nothingHeading = (c: CopyCtx) => `What Gives Nothing in ${c.shortName}: Levels, Logins, Leaderboards`

export function seerCallout(n: FreeNumbers): { title: string; body: string } {
  return {
    title: 'Fastest Free Godly: Seer',
    body: `craftable, no luck needed: ~${n.seerSpins} spins on average vs ~${fmtCount(n.godlySpins)} for a box Godly`,
  }
}

export const godlyGridHeading = (c: CopyCtx, count: number) => `Every Free Godly in ${c.shortName} (${count} You Can Get Today)`

export function godlyGridLead(c: CopyCtx, n: FreeNumbers): string {
  return `Each Shop box and the Common Egg rolls a Godly ${n.godlyPct}% of the time, and Seer is crafted. Prices are what each one sells for on DropMarket today.`
}

export const chromaRailTitle = (n: FreeNumbers) =>
  `Free Chromas: ${n.chromaPct}% a Spin (~${fmtCount(n.chromaSpins)} Spins on Average)`

export interface BuyStep {
  icon: 'seer' | 'box' | 'chroma'
  title: string
  value: string
}

/** "Skip the grind": the cheapest real prices for the items this page is about. */
export function buyRow(
  c: CopyCtx,
  n: FreeNumbers,
  cheapest: { seer: number | null; box: { name: string; usd: number } | null; chroma: { name: string; usd: number } | null },
): { heading: string; cta: string; steps: BuyStep[]; callout: { title: string; body: string } | null } {
  const steps: BuyStep[] = []
  if (cheapest.seer != null) steps.push({ icon: 'seer', title: `Seer From ${usd(cheapest.seer)}`, value: `Skip ~${n.seerSpins} spins of salvaging` })
  if (cheapest.box) steps.push({ icon: 'box', title: `Box Godlies From ${usd(cheapest.box.usd)}`, value: `${cheapest.box.name}, skip ~${fmtCount(n.godlySpins)} spins` })
  if (cheapest.chroma) steps.push({ icon: 'chroma', title: `Chromas From ${usd(cheapest.chroma.usd)}`, value: `${cheapest.chroma.name}, skip ~${fmtCount(n.chromaSpins)} spins` })
  return {
    heading: `Skip the Grind: Buy ${c.shortName} Godlies for Cheap`,
    cta: `Buy ${c.shortName} Godlies`,
    steps,
    callout: cheapest.box
      ? {
          title: `~${fmtCount(n.godlyRounds)} Rounds or ${usd(cheapest.box.usd)}`,
          body: 'a box Godly on average, or bought from ID-verified sellers and delivered in minutes',
        }
      : null,
  }
}

/** The FAQ — the visible answers ARE the FAQPage schema answers. */
export function faq(c: CopyCtx, n: FreeNumbers, realWays: number, lastCode: { code: string; year: string } | null) {
  const l = lead(c, n, realWays)
  return [
    {
      q: `How do you get free Godlies in ${c.shortName}?`,
      a: `${l.strong} ${l.rest}`,
    },
    {
      q: `What is the easiest free Godly in ${c.gameName}?`,
      a: `Seer. It is the only Godly you can always earn for free with no luck: salvage weapons into shards and trade ${MM2_ECONOMY.seerLegendaryShards} Legendary Shards (${n.seerLegendaries} Legendary weapons salvaged) for it at the Crafting Station. If you salvage every box drop, that is about ${n.seerSpins} spins on average.`,
    },
    {
      q: `How many spins does it take to get a Godly in ${c.shortName}?`,
      a: `Every Shop box gives a Godly ${n.godlyPct}% of the time, so it takes ${fmtCount(n.godlySpins)} spins (${fmtCount(n.godlyCoins)} Coins, about ${fmtCount(n.godlyRounds)} full-bag rounds) on average. After ${n.godlyHalf} spins you have a 50% chance; for a 90% chance you need about ${fmtCount(n.godlyNinety)}. A Chroma takes ${fmtCount(n.chromaSpins)} spins on average.`,
    },
    {
      q: `Are there any ${c.shortName} codes for free items?`,
      a: `No ${c.shortName} code works right now.${lastCode ? ` The last free code was ${lastCode.code}, in ${lastCode.year}.` : ''} Sites that list "new working codes" or a Godly generator are scams.`,
    },
    {
      q: `Do you get free items for leveling up in ${c.shortName}?`,
      a: `No. Levels and Prestige give no weapons, pets or Coins. Level 10 unlocks trading, which is the real value of leveling.`,
    },
    {
      q: `Does ${c.shortName} have a daily reward?`,
      a: `Not outside events. ${c.gameName} has no daily login reward, spin wheel or group reward; the closest thing is the daily quests that run during events like Halloween and Christmas.`,
    },
  ]
}
