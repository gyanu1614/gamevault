/**
 * /wfl — Win / Fair / Loss trade check.
 *
 * Traders type free text ("garama, skibidi toilet" / "2x tralalero diamond"),
 * so this has to survive typos, word-order drift, quantities and mutation
 * names embedded mid-string.
 *
 * The subtle problem is that mutation words collide with real item names —
 * the catalog contains "Gold Elf", and "Ice Dragon" sits next to no mutation
 * at all. Blindly stripping a mutation token would turn "gold elf" into "elf"
 * and match the wrong item. So each fragment is interpreted BOTH ways — as a
 * plain name, and as name-plus-mutation — and whichever reading matches the
 * catalog better wins.
 */

import { getCatalogIndex, type BrainrotIndexEntry } from '../catalog'
import { ephemeral, wflMessage, type TradeSide } from '../embeds'
import { normalizeText, scoreMatch } from '../match'
import { getPricesForSlugs, resolveVariantPrice } from '../prices'
import type { MessagePayload } from '../types'

/** Per side. Enough for any real trade, low enough to bound the work. */
const MAX_ITEMS_PER_SIDE = 12

/** Below this, we say we didn't recognise it rather than guess. */
const MIN_MATCH_SCORE = 300

type ParsedItem = {
  raw: string
  quantity: number
  brainrot: BrainrotIndexEntry
  mutationSlug: string
  mutationName: string
}

/** Split a side into item fragments on commas, plus signs, and newlines. */
export function splitItems(input: string): string[] {
  return input
    .split(/[,\n+]|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS_PER_SIDE)
}

/** Leading "2x " / "3 " quantity prefix, defaulting to 1. */
function takeQuantity(fragment: string): { quantity: number; rest: string } {
  const match = fragment.match(/^(\d{1,2})\s*[x×]?\s+(.*)$/)
  if (!match) return { quantity: 1, rest: fragment }

  const quantity = Number(match[1])
  if (!Number.isFinite(quantity) || quantity < 1) {
    return { quantity: 1, rest: fragment }
  }

  return { quantity: Math.min(quantity, 99), rest: match[2] }
}

type Interpretation = {
  brainrot: BrainrotIndexEntry
  score: number
  mutationSlug: string
  mutationName: string
}

function bestReading(
  normalized: string,
  brainrots: BrainrotIndexEntry[],
  mutationSlug: string,
  mutationName: string,
): Interpretation | null {
  let best: Interpretation | null = null

  for (const brainrot of brainrots) {
    const score = scoreMatch(normalized, brainrot.normalized)
    if (score <= 0) continue
    if (!best || score > best.score) {
      best = { brainrot, score, mutationSlug, mutationName }
    }
  }

  return best
}

async function parseFragment(fragment: string): Promise<ParsedItem | null> {
  const index = await getCatalogIndex()
  const { quantity, rest } = takeQuantity(fragment)
  const normalized = normalizeText(rest)
  if (!normalized) return null

  // Reading 1: the whole fragment is an item name, no mutation.
  const readings: Interpretation[] = []
  const plain = bestReading(normalized, index.brainrots, 'default', 'Default')
  if (plain) readings.push(plain)

  // Reading 2: a mutation name appears as whole tokens — strip it and match
  // the remainder. Longest mutation names first so "yin yang" wins over any
  // shorter partial.
  const byLength = [...index.mutations]
    .filter((mutation) => mutation.slug !== 'default')
    .sort((left, right) => right.normalized.length - left.normalized.length)

  for (const mutation of byLength) {
    const pattern = new RegExp(`(^|\\s)${mutation.normalized}($|\\s)`)
    if (!pattern.test(normalized)) continue

    const stripped = normalizeText(normalized.replace(pattern, ' '))
    if (!stripped) continue

    const reading = bestReading(
      stripped,
      index.brainrots,
      mutation.slug,
      mutation.name,
    )
    if (reading) readings.push(reading)
    break
  }

  if (!readings.length) return null

  // Whichever interpretation the catalog agrees with more. This is what keeps
  // "gold elf" as the item Gold Elf rather than a golden "elf".
  readings.sort((left, right) => right.score - left.score)
  const winner = readings[0]

  if (winner.score < MIN_MATCH_SCORE) return null

  return {
    raw: fragment,
    quantity,
    brainrot: winner.brainrot,
    mutationSlug: winner.mutationSlug,
    mutationName: winner.mutationName,
  }
}

async function priceSide(
  label: string,
  parsed: ParsedItem[],
  priceRows: Awaited<ReturnType<typeof getPricesForSlugs>>,
): Promise<TradeSide> {
  const items: TradeSide['items'] = []
  let total = 0

  for (const item of parsed) {
    const variant = await resolveVariantPrice(
      priceRows.get(item.brainrot.slug),
      item.mutationSlug,
    )

    const unit = variant?.valueUsd ?? null
    const lineTotal = unit != null ? unit * item.quantity : 0
    total += lineTotal

    items.push({
      name:
        item.quantity > 1
          ? `${item.quantity}× ${item.brainrot.name}`
          : item.brainrot.name,
      mutationName: variant?.mutationName ?? item.mutationName,
      valueUsd: unit != null ? lineTotal : null,
      isEstimated: variant?.isEstimated || variant?.isAnchored || false,
      matchedFrom: item.raw,
    })
  }

  return { label, items, total: Math.round(total * 100) / 100 }
}

export async function runWfl(
  yoursInput: string,
  theirsInput: string,
): Promise<MessagePayload> {
  const [yourFragments, theirFragments] = [
    splitItems(yoursInput),
    splitItems(theirsInput),
  ]

  if (!yourFragments.length || !theirFragments.length) {
    return ephemeral(
      'Give me both sides of the trade — for example: `/wfl you: garama, skibidi toilet them: tralalero diamond`',
    )
  }

  const unmatched: string[] = []

  const parseAll = async (fragments: string[]): Promise<ParsedItem[]> => {
    const parsed: ParsedItem[] = []
    for (const fragment of fragments) {
      const item = await parseFragment(fragment)
      if (item) parsed.push(item)
      else unmatched.push(fragment)
    }
    return parsed
  }

  const yourItems = await parseAll(yourFragments)
  const theirItems = await parseAll(theirFragments)

  if (!yourItems.length && !theirItems.length) {
    return ephemeral(
      `I couldn't recognise any of those items: ${unmatched.join(', ')}. Try the exact names from /value.`,
    )
  }

  // One round trip for every slug on both sides.
  const priceRows = await getPricesForSlugs([
    ...yourItems.map((item) => item.brainrot.slug),
    ...theirItems.map((item) => item.brainrot.slug),
  ])

  const [yours, theirs] = await Promise.all([
    priceSide('You give', yourItems, priceRows),
    priceSide('You get', theirItems, priceRows),
  ])

  return wflMessage(yours, theirs, unmatched)
}
