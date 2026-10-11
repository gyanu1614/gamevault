/**
 * Step 4 bulk importer — the listing copy every game shares.
 *
 * Why this is a shared module and not three templates: `listings.description`
 * is not just body text. The listing page uses it as the `<meta name=
 * "description">`, the OpenGraph description AND the Product JSON-LD
 * description, and the page clips `listings.title` at 48 characters before
 * appending " | DropMarket". So the copy has two hard shapes to respect:
 *
 *   · the FIRST ~155 characters of the description are the Google snippet, so
 *     the first line states what is for sale and why to buy it — never a fact
 *     list, which would snippet as "Rarity: Legendary".
 *   · a title over TITLE_SEO_MAX is truncated mid-word in the page title, so a
 *     pattern that does not fit drops its least valuable part instead.
 *
 * Rules it enforces structurally, so a game config cannot break them:
 *   · a fact the catalogue does not hold produces NO sentence. No "Rarity:
 *     Unknown", no invented obtain method.
 *   · the trust line is `HUB_COPY.safedrop` verbatim — the same string the hubs
 *     and footer use. Listing copy cannot drift from site copy, and it cannot
 *     grow the payout-timing or custody language that
 *     `hub-copy-safedrop.guard.test.ts` bans.
 *   · delivery copy states the method, the window and the buyer's own steps,
 *     nothing about when the seller is paid.
 *
 * Pure string building — no I/O, no game knowledge.
 */
import { TITLE_MAX, DESCRIPTION_MAX, type DeliveryMethod } from '@/lib/listings/validate'
import { SELLER_DELIVERY_WINDOWS } from '@/lib/utils/delivery-time'
import { HUB_COPY } from '@/lib/content/theme'
import type { CatalogueItem, CatalogueVariant, ItemFacts } from './types'

/**
 * The listing page's search title (`src/lib/seo/listing-meta.ts`, TITLE_MAX on
 * main) keeps a title verbatim when it already names the game and fits in 47;
 * past that it is clipped with "…". The column itself allows TITLE_MAX; this is
 * the SEO budget.
 */
export const TITLE_SEO_MAX = 47
/** Google truncates a meta description around here. */
export const SNIPPET_MAX = 155

/** The trust line, reused verbatim from the site's copy slots. */
export const TRUST_LINE = HUB_COPY.safedrop

/** Human label for a delivery window code ('1hr' → '1 Hour'). */
export function deliveryWindowLabel(window: string): string {
  return SELLER_DELIVERY_WINDOWS.find((w) => w.value === window)?.label ?? window
}

// ── variant wording ─────────────────────────────────────────────────────────

/**
 * How a game writes its variant.
 *
 * 'code'  Adopt Me: `adopt_me_pet_values.variant` holds FR / NFR / MFR, and
 *         that is what players type into Google ("nfr shadow dragon" far
 *         outweighs "neon fly ride shadow dragon"). Title uses the code, the
 *         snippet spells it out once as "Neon Fly Ride (NFR)".
 * 'label' Steal a Brainrot: the ref is a slug ('gold'), which has no business
 *         in a title. Use the name.
 */
export type VariantStyle = 'code' | 'label'

/** The short form for a title. */
export function variantTitleToken(v: CatalogueVariant | null, style: VariantStyle): string | null {
  if (!v) return null
  return style === 'code' ? v.ref : v.label
}

/** The spelled-out form for the snippet, which a newcomer can read. */
export function variantLeadPhrase(v: CatalogueVariant | null, style: VariantStyle): string | null {
  if (!v) return null
  if (style === 'label') return v.label
  // Say it both ways once, so the code is learnable from the page.
  return v.label && v.label.toLowerCase() !== v.ref.toLowerCase() ? `${v.label} (${v.ref})` : v.ref
}

// ── titles ──────────────────────────────────────────────────────────────────

export interface TitleParts {
  itemName: string
  /** Short variant form ('FR'), from `variantTitleToken`. */
  variantToken: string | null
  /** Long variant form ('Fly Ride'). Used by the pattern that spells it out. */
  variantLabel: string | null
  gameName: string
  /** 'pet' | 'brainrot' | 'egg' — appended by some patterns. */
  itemNoun: string
}

/**
 * A title pattern returns its parts in order of DECREASING value, so a title
 * that does not fit can drop from the end rather than be clipped mid-word:
 * `{ core, tail }` — the core (variant + item) is never dropped.
 */
export interface TitleShape {
  core: string
  tail?: string
  /** Separator between core and tail. */
  sep?: string
}

export type TitlePattern = (p: TitleParts) => TitleShape

function join(parts: Array<string | null | undefined>): string {
  return parts.map((p) => p?.trim()).filter((p): p is string => !!p).join(' ')
}

/**
 * The title shape: `FR Frost Dragon | Adopt Me` — owner decision, 2026-09-30.
 *
 * It reads like a seller wrote it — the title is what shows on the card and as
 * the page's H1, so no "Buy Now", no marketing furniture. The buy-intent wording
 * and the search phrases live in the description instead, where they do the
 * same SEO work without making a card look machine-stamped.
 *
 * Variant first, then the item, then the game: the three parts a real query
 * contains, in the order players type them ("fr frost dragon adopt me").
 *
 * Kept as a list so a game (or a later test of alternatives) can add shapes
 * without touching the rotation code; with one entry, every item gets it.
 */
export const TITLE_PATTERNS: readonly TitlePattern[] = [
  // FR Frost Dragon | Adopt Me
  (p) => ({ core: join([p.variantToken, p.itemName]), tail: p.gameName, sep: ' | ' }),
]

/**
 * FNV-1a over the item ref. Deterministic and stable across processes, which
 * matters more than distribution quality here: the pattern a listing gets must
 * never change, because the title feeds the DB-generated slug and therefore the
 * listing's URL. A re-import has to land on the same shape.
 */
export function stableIndex(key: string, count: number): number {
  if (count <= 0) return 0
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % count
}

/** Clip to a word boundary, never mid-word. */
function clipWords(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max).replace(/\s+\S*$/, '').trim()
}

/**
 * Render a shape, dropping the tail before clipping the core — the game name
 * is worth less than the item name, and the URL and breadcrumb both carry the
 * game anyway.
 */
export function renderTitle(shape: TitleShape, max = TITLE_SEO_MAX): string {
  const sep = shape.sep ?? ' — '
  const full = shape.tail ? `${shape.core}${sep}${shape.tail}` : shape.core
  if (full.length <= max) return full
  if (shape.core.length <= max) return shape.core
  return clipWords(shape.core, Math.min(max, TITLE_MAX))
}

/** Pick this item's pattern and render it. */
export function buildTitle(parts: TitleParts, itemRef: string, patterns = TITLE_PATTERNS): string {
  const pattern = patterns[stableIndex(itemRef, patterns.length)]
  return renderTitle(pattern(parts))
}

// ── facts ───────────────────────────────────────────────────────────────────

const FACT_LABELS: Array<[keyof ItemFacts, string]> = [
  ['rarity', 'Rarity'],
  ['area', 'Area'],
  ['obtainedFrom', 'Obtained from'],
]

/** Title-case a snake_case / lowercase catalogue value ('ultra_rare' → 'Ultra Rare'). */
function prettyValue(v: string): string {
  return v.replace(/[_-]+/g, ' ').trim().replace(/\b\p{Ll}/gu, (c) => c.toUpperCase())
}

/** "Rarity: Legendary" lines — only for facts that exist. */
export function factLines(facts: ItemFacts): string[] {
  const out: string[] = []
  for (const [key, label] of FACT_LABELS) {
    const raw = facts[key]
    if (typeof raw === 'string' && raw.trim()) out.push(`${label}: ${prettyValue(raw)}`)
  }
  if (typeof facts.incomePerSec === 'number' && facts.incomePerSec > 0) {
    out.push(`Income: ${formatIncome(facts.incomePerSec)}/sec`)
  }
  return out
}

/** 1500 → "1.5K", 2_400_000 → "2.4M". Matches how the values pages read. */
export function formatIncome(n: number): string {
  for (const [size, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as Array<[number, string]>) {
    if (n >= size) {
      const v = n / size
      return `${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}${suffix}`
    }
  }
  return String(Math.round(n))
}

// ── delivery ────────────────────────────────────────────────────────────────

export interface DeliverySpec {
  method: DeliveryMethod
  window: string
}

/** A delivery block: a heading phrased as the question buyers ask, the answer
 *  in the first line under it, then the buyer's own steps. */
export interface DeliveryBlock {
  heading: string
  lead: string
  steps: string[]
}

interface DeliveryContext {
  game: string
  noun: string
  itemName: string
  window: string
}

/**
 * Three wordings of the same promise. Every one states the window and the
 * buyer's steps; none says when the seller is paid (payout mechanics are banned
 * from public copy by the hub copy guard). "Confirm Delivery" is the real button
 * on the order page, so the steps match the UI.
 */
const MANUAL_DELIVERY: Array<(c: DeliveryContext) => DeliveryBlock> = [
  (c) => ({
    heading: 'How does delivery work?',
    lead: `You'll get it in ${c.game} within ${c.window}.`,
    steps: [
      'Check out. A chat with the seller opens on your order.',
      `The seller messages you to pick a time in ${c.game}.`,
      'Join them in-game and accept the trade.',
      `Once the ${c.noun} is in your inventory, hit Confirm Delivery.`,
    ],
  }),
  (c) => ({
    heading: `When do I get my ${c.noun}?`,
    lead: `Within ${c.window} of your order. Here's how it goes:`,
    steps: [
      'Place your order. It opens a chat with the seller.',
      `The seller sets up a time to meet you in ${c.game}.`,
      'Accept their trade request in-game.',
      `Check the ${c.noun} arrived, then press Confirm Delivery.`,
    ],
  }),
  (c) => ({
    heading: `How do I get my ${c.itemName}?`,
    lead: `The seller trades it to you in ${c.game}, within ${c.window}.`,
    steps: [
      "Buy it. You'll get a chat with the seller right away.",
      'Agree a time to meet in-game.',
      'Accept the trade when it comes through.',
      "Hit Confirm Delivery once you've got it.",
    ],
  }),
]

const INSTANT_DELIVERY = (c: DeliveryContext): DeliveryBlock => ({
  heading: 'How does delivery work?',
  lead: `It's instant, and always within ${c.window}.`,
  steps: [
    'Check out.',
    `Your ${c.noun} details show up on your order page straight away.`,
    "Hit Confirm Delivery once you've checked it.",
  ],
})

export const DELIVERY_WORDINGS = MANUAL_DELIVERY.length

/** The buyer's steps for the first wording — kept for callers and tests. */
export function deliverySteps(spec: DeliverySpec, gameName: string, itemNoun: string): string[] {
  const c = { game: gameName, noun: itemNoun, itemName: itemNoun, window: deliveryWindowLabel(spec.window).toLowerCase() }
  return spec.method === 'instant' ? INSTANT_DELIVERY(c).steps : MANUAL_DELIVERY[0](c).steps
}

/** Pick this listing's delivery wording. */
export function deliveryBlock(spec: DeliverySpec, c: Omit<DeliveryContext, 'window'>, key: string): DeliveryBlock {
  const ctx = { ...c, window: deliveryWindowLabel(spec.window).toLowerCase() }
  if (spec.method === 'instant') return INSTANT_DELIVERY(ctx)
  return MANUAL_DELIVERY[stableIndex(`${key}|delivery`, MANUAL_DELIVERY.length)](ctx)
}

// ── openings ────────────────────────────────────────────────────────────────

/**
 * "a" or "an" by sound. An all-caps code is read letter by letter, so FR, NFR,
 * MFR take "an" (eff-ar, en-eff-ar); an ordinary word goes by its first vowel,
 * with the "you"-sounding u words (Unicorn, Uni…) taking "a".
 */
export function article(phrase: string): 'a' | 'an' {
  const word = phrase.trim().split(/\s+/)[0] ?? ''
  if (/^[A-Z]{1,5}$/.test(word)) return /^[AEFHILMNORSX]/.test(word) ? 'an' : 'a'
  if (/^u(ni|s[eu]|ti)/i.test(word)) return 'a'
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

interface OpeningContext {
  /** Variant spelled out + item: "Fly Ride (FR) Frost Dragon". */
  full: string
  /** Short form + item: "FR Frost Dragon". Equals `full` with no variant. */
  short: string
  game: string
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Eight first lines. Not one starts with "Buy": the listing page's own meta
 * description already opens "Buy {title} for {game} for $X" (listing-meta.ts),
 * so this line is written for the person reading the page.
 */
const OPENINGS: Array<(c: OpeningContext) => string> = [
  (c) => `${cap(article(c.full))} ${c.full} for ${c.game}, in stock and ready to trade.`,
  (c) => `Looking for ${article(c.short)} ${c.short}? This one's in stock and traded to you in ${c.game}.`,
  (c) => `This listing is for one ${c.full} in ${c.game}.`,
  (c) => `Add ${article(c.full)} ${c.full} to your ${c.game} collection.`,
  (c) => `In stock now: one ${c.full} for ${c.game}.`,
  (c) => `Get ${article(c.full)} ${c.full} in ${c.game} without waiting on a trade offer.`,
  (c) => `One ${c.full}, ready to trade in ${c.game}.`,
  (c) => `Want ${article(c.short)} ${c.short} in ${c.game}? You can buy this one now.`,
]

export const OPENING_COUNT = OPENINGS.length

export function openingLine(c: OpeningContext, key: string): string {
  const line = OPENINGS[stableIndex(`${key}|open`, OPENINGS.length)](c)
  return line.length <= SNIPPET_MAX ? line : clipWords(line, SNIPPET_MAX)
}

// ── search phrases ──────────────────────────────────────────────────────────

export interface SearchPhraseParts {
  itemName: string
  variantToken: string | null
  variantLabel: string | null
  gameName: string
}

/**
 * The phrases people actually type, lower-cased and de-duplicated.
 *
 * In the visible text on purpose: `<meta name="keywords">` has been ignored by
 * Google since 2009, so a keywords tag would be decoration. These read as a
 * normal line and differ for every item, which is what keeps 500 imported
 * listings from looking like one stamped template.
 */
export function searchPhrases(p: SearchPhraseParts, limit = 5): string[] {
  const item = p.itemName.trim()
  const game = p.gameName.trim()
  const candidates = p.variantToken
    ? [
        `${p.variantToken} ${item}`,
        `${item} ${game}`,
        `buy ${p.variantToken} ${item}`,
        p.variantLabel && p.variantLabel.toLowerCase() !== p.variantToken.toLowerCase()
          ? `${p.variantLabel} ${item}`
          : `${p.variantToken} ${item} ${game}`,
        `${item} price`,
      ]
    : [`${item} ${game}`, `buy ${item}`, `${item} for sale`, `cheap ${item}`, `${item} price`]

  const seen = new Set<string>()
  const out: string[] = []
  for (const c of candidates) {
    if (!c) continue
    const phrase = c.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!phrase || seen.has(phrase)) continue
    seen.add(phrase)
    out.push(phrase)
    if (out.length >= limit) break
  }
  return out
}

export const CLOSING_LABELS = ['Also searched as', 'People also search', 'Related searches'] as const

// ── assembly ────────────────────────────────────────────────────────────────

export interface DescriptionParts {
  item: CatalogueItem
  variant: CatalogueVariant | null
  variantStyle: VariantStyle
  gameName: string
  itemNoun: string
  delivery: DeliverySpec
  /** Extra factual lines a game wants ("Sold sealed. The pet inside is random."). */
  notes?: string[]
}

/**
 * Opening → what the variant is + the item's facts → notes → delivery →
 * trust → search phrases. Blank-line separated; the listing page renders it
 * `whitespace-pre-wrap`.
 *
 * Variety without churn: the opening, the delivery wording and the closing
 * label are each picked by a stable hash of (item, variant) with its own salt,
 * so the FR and NFR listings of one pet read differently, two pets rarely read
 * alike (8 × 3 × 3 = 72 combinations before the facts differ at all), and a
 * re-import of the same row always produces the same text.
 */
export function buildDescription(p: DescriptionParts): string {
  const key = `${p.item.ref}|${p.variant?.ref ?? ''}`
  const variantPhrase = variantLeadPhrase(p.variant, p.variantStyle)
  const token = variantTitleToken(p.variant, p.variantStyle)

  const blocks: string[] = [
    openingLine(
      {
        full: [variantPhrase, p.item.name].filter(Boolean).join(' '),
        short: [token, p.item.name].filter(Boolean).join(' '),
        game: p.gameName,
      },
      key,
    ),
  ]

  const factBlock = [p.variant?.note?.trim(), ...factLines(p.item.facts)].filter((l): l is string => !!l)
  if (factBlock.length) blocks.push(factBlock.join('\n'))

  const notes = (p.notes ?? []).map((n) => n.trim()).filter(Boolean)
  if (notes.length) blocks.push(notes.join('\n'))

  const d = deliveryBlock(p.delivery, { game: p.gameName, noun: p.itemNoun, itemName: p.item.name }, key)
  blocks.push([d.heading, d.lead, ...d.steps.map((s, i) => `${i + 1}. ${s}`)].join('\n'))

  blocks.push(TRUST_LINE)

  const phrases = searchPhrases({
    itemName: p.item.name,
    variantToken: token,
    variantLabel: p.variant?.label ?? null,
    gameName: p.gameName,
  })
  if (phrases.length) {
    const label = CLOSING_LABELS[stableIndex(`${key}|close`, CLOSING_LABELS.length)]
    blocks.push(`${label}: ${phrases.join(', ')}`)
  }

  return blocks.join('\n\n').slice(0, DESCRIPTION_MAX)
}
