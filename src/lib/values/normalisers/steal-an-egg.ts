/**
 * Steal An Egg listing-title normaliser.
 *
 * Built against 400 live Eldorado listings (gameId=452) sampled 2026-09-18.
 * What that sample established, and why this file looks the way it does:
 *
 *  - 0% of listings carry structured attributes. Unlike SAB — whose Eldorado
 *    offers expose tradeEnvironmentValues we can trust — EVERY signal here has
 *    to come out of the free-text title.
 *  - The market sells SEALED, RANDOM eggs priced BY AREA: 76% of egg listings
 *    name an area, only 4% name a specific egg, and 43.5% say "random"
 *    outright. So `area` is the pricing key and named eggs are the exception.
 *  - 31% of listings are ACCOUNTS priced by income per second, a second real
 *    market. 68% of those state an income we can parse.
 *  - 37% of titles carry a quantity multiplier ("5x", "x5", "10X"), so a
 *    bundle must be divided down to a unit price or it looks 5x cheap.
 *  - The unmatched remainder is mostly NOT eggs: "x2 Money" gamepasses,
 *    "EGG RUN"/"SECRET EGGS SERVICE" services. Those are classified and
 *    rejected explicitly rather than left to pollute the review file.
 *
 * Nothing here invents a value. A title that does not resolve returns
 * itemSlug: null with a note, and the caller persists it for review.
 */
import type { Normaliser, ParsedListing, TaxonomyEntry } from '@/lib/values/types'

/** Lowercase, strip emoji/punctuation, collapse whitespace. */
function comparable(title: string): string {
  return (
    title
      .toLowerCase()
      // "50xLuminous Egg" / "3xTitan" — sellers glue the quantity to the item
      // name. Without this the matcher sees "50xluminous" and matches nothing,
      // which silently dropped every listing in that (common) format.
      .replace(/\b(\d{1,4})x(?=[a-z])/g, '$1x ')
      // A slash between two names is a separator, not part of either:
      // "angels/demons", "Angel/Devil", "demon/angel".
      .replace(/([a-z])\/([a-z])/g, '$1 / $2')
      .replace(/[^a-z0-9&+/. ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Sellers misspell "random" constantly — randum, rondom, ramdom, randum.
 * A random-draw listing is still priceable (it is exactly what the market
 * sells); it just cannot resolve to a NAMED egg.
 */
const RANDOM_RE = /\b(r[ao]nd[ou]m|ramdom|randum|rendom|any area|you choose|mystery)\b/

/**
 * Sellers also sell by RARITY TIER rather than by area — "secret egg",
 * "1 divine eggs from random place", "DIVINE, ETERNAL or SECRET EGG". At
 * production scale this is ~70 listings that previously matched nothing.
 *
 * These are priced as a tier, so they resolve to a tier pseudo-area when the
 * taxonomy carries one; the caller seeds those the same way it seeds areas.
 */
const RARITY_TIER_RE =
  /\b(secret|divine|eternal|mythic|legendary|cosmic|monster)\b/

/** Services: someone plays for you. Never an item value. */
const SERVICE_RE = /\b(egg run|carry|service|boost(ing)?|tips? jar|1 hr|hour run)\b/

/** Gamepasses / currency multipliers: "x2 Money", "x2 Growth", "399R". */
const CURRENCY_RE = /\b(x\s?2|x\s?3)\s*(money|growth|luck|speed)\b|\bgamepass\b|\b\d+r\b/

/** Account listings: "FRESH ACCOUNT", "30B++/S", "Income 108B/s". */
const ACCOUNT_RE = /\b(account|fresh|acc)\b|\bincome\b|\d\s*[kmbt]\s*\+*\s*\/?\s*s\b/

const UNIT_MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
  t: 1e12,
}

/**
 * Income per second from an account title. Handles the forms seen live:
 * "30B/s", "30B++/S", "Income 108B/s", "18 B/s", "10B++" (no /s),
 * "74-95B" and "20-25B Money/s" (ranges → take the LOW end, never oversell).
 */
export function parseIncomePerSec(title: string): number | null {
  // NOTE: the range check runs on a lightly-cleaned title that KEEPS hyphens.
  // `comparable()` strips them ("10b-15b" -> "10b 15b"), which would hide the
  // range and let the general scan below pick the HIGH end — overselling the
  // account. Only lowercasing + whitespace collapsing here.
  const raw = title.toLowerCase().replace(/\s+/g, ' ')
  const t = comparable(title)
  let best: number | null = null

  // Range first ("10b-15b", "74-95b"): the low end is the honest figure.
  // Both "10b-15b++" (unit on both) and "74-95b" (unit only on the high end)
  // occur live; in the second form the low number inherits the high's unit.
  const range = raw.match(/(\d+(?:\.\d+)?)\s*([kmbt])?\s*[-–]\s*(\d+(?:\.\d+)?)\s*([kmbt])/)
  if (range) {
    const unit = (range[2] || range[4]).toLowerCase()
    const low = parseFloat(range[1]) * (UNIT_MULTIPLIERS[unit] ?? 1)
    // Return immediately: falling through to the general scan below would pick
    // the HIGH end of the range and oversell the account.
    if (Number.isFinite(low)) return low
  }

  if (best == null) {
    // "30b/s", "30b++/s", "18 b/s", and bare "10b++" on an account listing.
    const re = /(\d+(?:\.\d+)?)\s*([kmbt])\s*\+*\s*(?:\/?\s*s\b|\b)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(t))) {
      const value = parseFloat(m[1]) * (UNIT_MULTIPLIERS[m[2].toLowerCase()] ?? 1)
      // Take the LARGEST figure: titles often pair income with a smaller
      // "speed" stat, and income is the headline the price tracks.
      if (Number.isFinite(value) && (best == null || value > best)) best = value
    }
  }
  return best
}

/**
 * Quantity multiplier: "5x", "x5", "10X Titan Temple Eggs", "5 Egg Cosmic".
 * Defaults to 1. Capped at 1000 so a stray in-game number ("399R", an income
 * figure) cannot divide a price into nonsense.
 */
export function parseQuantity(title: string): number {
  const t = comparable(title)
  const patterns = [
    /\b(\d{1,4})\s*x\b/, // "5x", "10 x"
    /\bx\s*(\d{1,4})\b/, // "x5"
    /^(\d{1,4})\s+eggs?\b/, // "5 Egg Cosmic"
    /\b(\d{1,4})\s+eggs\b/, // "5 eggs from ..."
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m) {
      const n = parseInt(m[1], 10)
      if (Number.isFinite(n) && n >= 1 && n <= 1000) return n
    }
  }
  return 1
}

/** Longest-name-first so "cosmic dragon egg" wins over "cosmic". */
function matchTaxonomy(
  text: string,
  taxonomy: TaxonomyEntry[],
  kinds: Array<TaxonomyEntry['kind']>,
): { entry: TaxonomyEntry; matched: string } | null {
  const candidates = taxonomy
    .filter((e) => kinds.includes(e.kind))
    .flatMap((entry) =>
      [entry.name, ...(entry.aliases ?? [])].map((label) => ({
        entry,
        label: comparable(label),
      })),
    )
    .filter((c) => c.label.length > 2)
    .sort((a, b) => b.label.length - a.label.length)

  for (const c of candidates) {
    // Word-boundary match so "bear egg" does not match inside "polar bear egg".
    const re = new RegExp(`(^|\\s)${c.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`)
    if (re.test(text)) return { entry: c.entry, matched: c.label }
    // Eggs are named "<Thing> Egg" but listed as "<Thing>" just as often.
    const bare = c.label.replace(/\s+eggs?$/, '')
    if (bare !== c.label && bare.length > 3) {
      const bareRe = new RegExp(`(^|\\s)${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`)
      if (bareRe.test(text)) return { entry: c.entry, matched: bare }
    }
  }
  return null
}

function result(partial: Partial<ParsedListing> & { intent: ListingIntentLike }): ParsedListing {
  return {
    intent: partial.intent,
    itemSlug: partial.itemSlug ?? null,
    confidence: partial.confidence ?? 0,
    quantity: partial.quantity ?? 1,
    incomePerSec: partial.incomePerSec ?? null,
    note: partial.note,
  }
}
type ListingIntentLike = ParsedListing['intent']

/**
 * Aliases the LIVE sample proves are needed, shipped as the seed's starting
 * point for values_item_aliases. Each one is a spelling that appeared in the
 * 400-listing sample and failed to match the wiki's own vocabulary:
 *
 *   - "King Monkey" is an area sellers name constantly but is absent from the
 *     wiki's 17 biomes entirely;
 *   - "Angel/Demon", "Evil or Angel" are the singular/idiomatic forms of the
 *     "Angels & Demons" biome;
 *   - "the last zone" is how sellers refer to the newest area.
 *
 * These are data, not logic: the crawler loads the table, so the owner can add
 * more without a deploy.
 */
export const STEAL_AN_EGG_SEED_ALIASES: Record<string, string[]> = {
  'angels-demons': [
    'angels',
    'demons',
    'demon',
    'angel',
    'demon/angel',
    'angel/demon',
    'angels or demons',
    'angel or demon',
    'evil or angel',
    'angels & demons',
    'angels / demons',
    'angel / demon',
    'angel / devil',
    'demon / angel',
    'devil / angel',
    'angel devil',
  ],
  'king-monkey': ['king monkey', 'monkey area', 'king monkey area'],
  // Slash forms seen at production scale: "angels/demons", "Angel/Devil".
  // comparable() spaces the slash out, so these match as written.
  'abyss-ocean': ['ocean', 'abyss', 'abyss ocean'],
  'cherry-blossom': ['cherry blossom', 'cherry', 'blossom'],
  'titan-temple': ['titan', 'temple', 'titan temple area'],
  prehistoric: ['prehistoric area', 'dino', 'dinosaur'],
  cosmic: ['cosmic area', 'space'],
  snow: ['snow area', 'winter', 'ice'],
  rift: ['rift area', 'riftborn'],
}

export const stealAnEggNormaliser: Normaliser = {
  key: 'steal-an-egg',

  parse(title: string, taxonomy: TaxonomyEntry[]): ParsedListing {
    const t = comparable(title)
    const quantity = parseQuantity(title)

    // Order matters. Services and currency are checked BEFORE eggs because
    // "SECRET EGGS SERVICE" and "Buy x2 Money | ... Steal An Egg" both mention
    // eggs while selling something else entirely.
    if (SERVICE_RE.test(t)) {
      return result({ intent: 'service', note: 'service listing (not an item)' })
    }
    if (CURRENCY_RE.test(t) && !/\begg/.test(t.replace(/steal an egg/g, ''))) {
      return result({ intent: 'currency', note: 'currency/gamepass listing' })
    }

    // Accounts: priced by income, matched to a bracket by the caller (which
    // knows the bracket bounds); we return the income we parsed.
    const mentionsEgg = /\begg/.test(t.replace(/steal an egg/g, ''))
    if (ACCOUNT_RE.test(t) && !mentionsEgg) {
      const income = parseIncomePerSec(title)
      return result({
        intent: 'account',
        incomePerSec: income,
        confidence: income == null ? 0.2 : 0.8,
        quantity: 1,
        note: income == null ? 'account listing with no parseable income' : undefined,
      })
    }

    if (mentionsEgg) {
      // A NAMED egg is the strongest match, but it is rare (~4% live).
      const named = matchTaxonomy(t, taxonomy, ['egg'])
      if (named && !RANDOM_RE.test(t)) {
        return result({
          intent: 'egg',
          itemSlug: named.entry.slug,
          confidence: 0.95,
          quantity,
        })
      }
      // The common case: an AREA. This is the unit the market actually prices.
      const area = matchTaxonomy(t, taxonomy, ['area'])
      if (area) {
        return result({
          intent: 'area',
          itemSlug: area.entry.slug,
          // A random draw from a named area is exactly what is being sold, so
          // it is a confident area match; a named egg that ALSO says "random"
          // is weaker, because the egg name may be describing the pool.
          confidence: RANDOM_RE.test(t) ? 0.9 : 0.75,
          quantity,
        })
      }
      // Sold by rarity tier rather than by area ("secret egg", "divine eggs").
      // Only counts when the taxonomy actually carries that tier as an item,
      // so this can never invent a match.
      const tier = t.match(RARITY_TIER_RE)?.[1]
      if (tier) {
        const tierEntry = matchTaxonomy(tier, taxonomy, ['area', 'egg'])
        if (tierEntry) {
          return result({
            intent: 'egg',
            itemSlug: tierEntry.entry.slug,
            // Weaker than a named egg: a tier covers several eggs.
            confidence: 0.6,
            quantity,
          })
        }
      }

      // Mentions an egg, resolves to nothing we know → review, never a guess.
      return result({
        intent: 'egg',
        confidence: 0,
        quantity,
        note: 'egg listing matched no known egg or area',
      })
    }

    return result({ intent: 'unknown', quantity, note: 'no recognised intent' })
  },
}

export default stealAnEggNormaliser
