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

/**
 * Where /sell sends a would-be seller. The lighter waitlist on-ramp
 * (email + username, no auth/KYC wall) rather than the auth-gated listing
 * wizard — the KYC wall is the funnel's #1 leak, so the first touch stays
 * frictionless and the concierge team takes it from the captured lead.
 */
export const SELLER_APPLY_URL = `${SITE_URL}/early-seller?${REF}`

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

/**
 * `/sell` — the conversion command.
 *
 * Deliberately NOT a public listing: the bot never posts a peer sell offer
 * (that would make the server an unregulated trading venue and put every scam
 * on our books). Instead it replies EPHEMERALLY to the seller with their item's
 * live value and routes them to the on-site application, where KYC + SafeDrop
 * escrow live. The lead itself is mirrored to a private staff channel by the
 * caller — see `sellerLeadPayload`.
 */
export function sellMessage(
  pricing: BrainrotPricing,
  selectedSlug: string,
): MessagePayload {
  const variant =
    pricing.mutations.find((m) => m.mutationSlug === selectedSlug) ??
    pricing.defaultPrice ??
    pricing.mutations[0]

  // Prefer the reputable average (the headline "market price"), else the
  // corrected value — same precedence the /value embed uses.
  const marketUsd = variant?.averageUsd ?? variant?.valueUsd ?? null
  const valueLine =
    marketUsd != null
      ? `Your **${pricing.name}**${variant && variant.mutationSlug !== 'default' ? ` (${variant.mutationName})` : ''} is worth about **${formatCash(marketUsd)}** right now.`
      : `We don't have a firm value for **${pricing.name}** yet — but you can still list it.`

  const embed: Embed = {
    title: '💸 Sell it for cash — safely',
    description: [
      valueLine,
      '',
      'On Discord you go first and hope they pay. On **DropMarket**, SafeDrop holds the buyer’s money *before* you deliver — so **you always get paid, even if the buyer ghosts**. No chargebacks, no “you first”, no scams.',
      '',
      '**Verified sellers get** a trust badge, priority placement, and buyers who came here *because* it’s safe. Founding sellers lock a reduced commission for life.',
    ].join('\n'),
    color: BRAND_COLOR,
    footer: FOOTER,
  }

  if (pricing.imageUrl) embed.thumbnail = { url: pricing.imageUrl }

  return {
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
    allowed_mentions: { parse: [] },
    components: [linkButton('Apply to sell ↗', SELLER_APPLY_URL)],
  }
}

/**
 * A warm-lead card for the private staff channel. Fire-and-forget via webhook —
 * a named seller intent (item + asking price + who) for 1:1 concierge outreach,
 * which is how the first sellers actually get recruited. Never shown to members.
 */
export function sellerLeadPayload(input: {
  brainrotName: string
  mutationName: string | null
  valueUsd: number | null
  askingPrice: string | null
  handle: string | null
  userId: string | null
}): MessagePayload {
  const fields: EmbedField[] = [
    {
      name: 'Item',
      value: clamp(
        input.mutationName && input.mutationName !== 'Default'
          ? `${input.brainrotName} · ${input.mutationName}`
          : input.brainrotName,
        Limits.fieldValue,
      ),
      inline: true,
    },
    {
      name: 'Our value',
      value: formatCash(input.valueUsd) ?? 'Unknown',
      inline: true,
    },
  ]

  if (input.askingPrice) {
    fields.push({
      name: 'Asking',
      value: clamp(input.askingPrice, 100),
      inline: true,
    })
  }

  fields.push({
    name: 'Seller',
    value:
      (input.userId ? `<@${input.userId}>` : null) ??
      (input.handle ? `@${clamp(input.handle, 80)}` : 'unknown'),
    inline: false,
  })

  return {
    embeds: [
      {
        title: '🎯 New seller lead',
        description: 'Someone ran `/sell` — a warm lead to DM.',
        color: BRAND_COLOR,
        fields,
        footer: FOOTER,
      },
    ],
    allowed_mentions: { parse: [] },
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
