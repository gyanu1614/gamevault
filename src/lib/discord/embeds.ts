/**
 * Embed builders for the bot.
 *
 * Every embed carries the same two things, and they are the whole distribution
 * strategy: a "DropMarket Values" footer and a link BUTTON back to the site.
 * Both are user-summoned — the bot never posts unprompted and never DMs — which
 * is what keeps this on the right side of Discord's platform rules while still
 * putting the brand in front of a trading channel.
 */

import { SITE_URL } from '@/config/site'
import {
  ButtonStyle,
  ComponentType,
  Limits,
  MessageFlags,
  type Component,
  type Embed,
  type EmbedField,
  type MessagePayload,
} from './types'
import {
  BRAND_COLOR,
  clamp,
  formatCash,
  formatConfidence,
  formatIncome,
  formatPercentDelta,
  formatRange,
  rarityColor,
  relativeTimestamp,
} from './format'
import type { BrainrotPricing, PricedItem, VariantPrice } from './prices'

const GAME_SLUG = 'steal-a-brainrot'

/** Attribution on outbound clicks. Canonical tags already strip it for SEO. */
const REF = 'ref=discord-bot'

export function itemUrl(slug: string): string {
  return `${SITE_URL}/${GAME_SLUG}/values/${slug}?${REF}`
}

export function pageUrl(path: string): string {
  return `${SITE_URL}/${GAME_SLUG}${path}?${REF}`
}

const FOOTER = { text: 'DropMarket Values • dropmarket.gg' }

function linkButton(label: string, url: string): Component {
  return {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Link,
        label: clamp(label, 80),
        url,
      },
    ],
  }
}

/** A short, honest note about how solid a number is. */
function provenance(variant: VariantPrice): string {
  if (variant.isEstimated) {
    return 'Estimated from this item’s base value — no listings for this mutation yet'
  }
  if (variant.isAnchored) {
    return 'Estimated from similar items — too few listings to price directly'
  }

  const confidence = formatConfidence(variant.confidence)
  const samples =
    variant.sampleSize > 0
      ? `${variant.sampleSize} listing${variant.sampleSize === 1 ? '' : 's'}`
      : 'no listings'
  const sources =
    variant.sourceCount > 1 ? ` across ${variant.sourceCount} sources` : ''

  return `${confidence} · ${samples}${sources}`
}

export function valueMessage(
  pricing: BrainrotPricing,
  selectedSlug: string,
): MessagePayload {
  const variant =
    pricing.mutations.find((m) => m.mutationSlug === selectedSlug) ??
    pricing.defaultPrice ??
    pricing.mutations[0]

  const fields: EmbedField[] = []

  // Market price = the reputable average when present, else the corrected value.
  // Cheapest = the reputable low, shown only when it undercuts the market price.
  const marketUsd = variant?.averageUsd ?? variant?.valueUsd ?? null
  const marketPrice = marketUsd != null ? formatCash(marketUsd) : null
  const cheapestUsd = variant?.cheapestUsd ?? null
  const cheapest =
    cheapestUsd != null && marketUsd != null && cheapestUsd < marketUsd - 0.005
      ? formatCash(cheapestUsd)
      : null

  if (cheapest) {
    fields.push({ name: 'Cheapest', value: cheapest, inline: true })
  }
  fields.push({
    name: 'Market price',
    value: marketPrice ?? 'Not enough data yet',
    inline: true,
  })

  // Range only for older (non-reputable) rows that still lack a cheapest/average
  // and are a real measured spread — an estimated/anchored price has no
  // meaningful range, and a reputable row already shows the cheapest instead.
  const showRange =
    variant &&
    variant.averageUsd == null &&
    !variant.isEstimated &&
    !variant.isAnchored
  const range = showRange ? formatRange(variant.lowUsd, variant.highUsd) : null
  if (range) fields.push({ name: 'Range', value: range, inline: true })

  // Income for THIS mutation (base × multiplier), not the base — a Radioactive
  // earns more than the default. Fall back to base only if the per-mutation
  // figure is unknown.
  const income = variant?.incomePerSecond ?? pricing.incomePerSecond
  if (income != null) {
    fields.push({
      name: 'Income',
      value: formatIncome(income),
      inline: true,
    })
  }

  if (variant) {
    // "From verified sellers" for reputable rows; the older provenance line
    // (confidence + listing/source counts) for everything else.
    fields.push({
      name: 'Based on',
      value:
        variant.averageUsd != null
          ? 'Verified sellers (100+ reviews)'
          : provenance(variant),
      inline: false,
    })
  }

  const updated = variant ? relativeTimestamp(variant.updatedAt) : null

  // Lead with the mutation name + its price so the exact variant being quoted is
  // unmistakable — "Radioactive · $622.15".
  const variantHeadline =
    variant && marketUsd != null
      ? `${variant.mutationName} · ${formatCash(marketUsd)}`
      : variant
        ? variant.mutationName
        : null

  const embed: Embed = {
    title: clamp(pricing.name, Limits.embedTitle),
    url: itemUrl(pricing.slug),
    description: [
      pricing.rarity ? `**${pricing.rarity}**` : null,
      variantHeadline,
    ]
      .filter(Boolean)
      .join(' · '),
    color: rarityColor(pricing.rarity),
    fields,
    footer: FOOTER,
  }

  if (pricing.imageUrl) embed.thumbnail = { url: pricing.imageUrl }
  if (updated) {
    embed.fields = [
      ...fields,
      { name: 'Updated', value: updated, inline: false },
    ]
  }

  const components: Component[] = []

  // A select is only worth showing when there's something to switch to, and
  // Discord caps it at 25 options.
  const options = pricing.mutations
    .filter((m) => m.valueUsd != null)
    .slice(0, Limits.selectOptions)

  if (options.length > 1) {
    components.push({
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.StringSelect,
          // The handler needs to know which Brainrot this belongs to; slugs are
          // well under Discord's 100-char custom_id limit.
          custom_id: clamp(`value:${pricing.slug}`, Limits.customId),
          placeholder: 'Change mutation',
          options: options.map((mutation) => ({
            label: clamp(mutation.mutationName, 100),
            value: mutation.mutationSlug,
            description: clamp(
              [
                formatCash(mutation.valueUsd),
                mutation.isEstimated ? 'estimated' : null,
              ]
                .filter(Boolean)
                .join(' · '),
              100,
            ),
            default: mutation.mutationSlug === variant?.mutationSlug,
          })),
        },
      ],
    })
  }

  components.push(linkButton('View on DropMarket ↗', itemUrl(pricing.slug)))

  return { embeds: [embed], components }
}

export type TradeSide = {
  label: string
  items: {
    name: string
    mutationName: string
    valueUsd: number | null
    isEstimated: boolean
    matchedFrom: string
  }[]
  total: number
}

/** Win / Fair / Loss thresholds, in percent difference of the two totals. */
const FAIR_BAND_PERCENT = 5

export function wflMessage(
  yours: TradeSide,
  theirs: TradeSide,
  unmatched: string[],
): MessagePayload {
  const delta =
    yours.total > 0 ? ((theirs.total - yours.total) / yours.total) * 100 : 0

  const verdict =
    Math.abs(delta) <= FAIR_BAND_PERCENT
      ? { text: '🟡 FAIR — close enough to even', color: 0xf5c542 }
      : delta > 0
        ? { text: `🟢 WIN — you gain ${formatPercentDelta(yours.total, theirs.total)}`, color: 0x4fb477 }
        : { text: `🔴 LOSS — you lose ${formatPercentDelta(yours.total, theirs.total).replace('−', '')}`, color: 0xe23b4e }

  const renderSide = (side: TradeSide): string => {
    if (!side.items.length) return '_nothing_'
    const lines = side.items.map((item) => {
      const price = formatCash(item.valueUsd) ?? '—'
      const flag = item.isEstimated ? ' *(est)*' : ''
      return `${item.name} (${item.mutationName}) — **${price}**${flag}`
    })
    lines.push(`**Total: ${formatCash(side.total) ?? '$0'}**`)
    return clamp(lines.join('\n'), Limits.fieldValue)
  }

  const fields: EmbedField[] = [
    { name: 'You give', value: renderSide(yours), inline: false },
    { name: 'You get', value: renderSide(theirs), inline: false },
  ]

  const difference = theirs.total - yours.total
  fields.push({
    name: 'Difference',
    value:
      difference === 0
        ? 'Dead even'
        : `${formatCash(Math.abs(difference))} ${difference > 0 ? 'in your favour' : 'against you'}`,
    inline: false,
  })

  if (unmatched.length) {
    fields.push({
      name: '⚠️ Not recognised',
      value: clamp(
        `${unmatched.join(', ')} — check the spelling, or it may not be in the catalog yet.`,
        Limits.fieldValue,
      ),
      inline: false,
    })
  }

  const embed: Embed = {
    title: clamp(verdict.text, Limits.embedTitle),
    description:
      'Values are marketplace estimates, not a guarantee. Anything marked *(est)* is derived from the item’s base value.',
    color: verdict.color,
    fields,
    footer: FOOTER,
  }

  return {
    embeds: [embed],
    components: [
      linkButton('Open Trade Calculator ↗', pageUrl('/trade-calculator')),
    ],
  }
}

export function topMessage(
  items: PricedItem[],
  rarity: string | null,
): MessagePayload {
  const lines = items.map((item, index) => {
    const price = formatCash(item.valueUsd) ?? '—'
    const flag = item.isAnchored ? ' *(est)*' : ''
    return `**${index + 1}.** ${item.name} — **${price}**${flag}`
  })

  const embed: Embed = {
    title: clamp(
      rarity ? `Top ${rarity} Values` : 'Top Steal a Brainrot Values',
      Limits.embedTitle,
    ),
    description: clamp(
      lines.length ? lines.join('\n') : 'No priced items found for that filter.',
      Limits.embedDescription,
    ),
    color: rarity ? rarityColor(rarity) : BRAND_COLOR,
    footer: FOOTER,
  }

  return {
    embeds: [embed],
    components: [linkButton('See the full index ↗', pageUrl('/price-index'))],
  }
}

/** Errors and misses are ephemeral — only the person who asked sees them. */
export function ephemeral(content: string): MessagePayload {
  return {
    content: clamp(content, 1900),
    flags: MessageFlags.Ephemeral,
    allowed_mentions: { parse: [] },
  }
}
