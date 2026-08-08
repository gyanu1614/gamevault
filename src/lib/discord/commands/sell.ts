/**
 * /sell — the seller-conversion command.
 *
 * The bot never publishes a public sell offer (that would turn the server into
 * an unregulated trading venue and put every scam on our books). Instead:
 *   1. it price-checks the item against the SAME live values the site uses,
 *   2. replies EPHEMERALLY with an escrow pitch + a link to the application, and
 *   3. fire-and-forgets the lead (item + asking price + who) to a private staff
 *      channel via webhook, so the first sellers can be recruited 1:1.
 *
 * Net effect: the "list my item" impulse becomes an application click and a
 * named warm lead — with zero peer-trade liability and no free competitor to
 * our own marketplace.
 */

import { getCatalogIndexOrEmpty } from '../catalog'
import {
  SELLER_APPLY_URL,
  ephemeral,
  sellMessage,
  sellerLeadPayload,
} from '../embeds'
import { sendToWebhook } from '../dailyPost'
import { getBrainrotPricing } from '../prices'
import { clamp } from '../format'
import type { Interaction, MessagePayload } from '../types'
import { interactionUserId } from '../types'
import {
  resolveBrainrotSlug,
  resolveMutationSlug,
} from './value'

const LEADS_WEBHOOK = process.env.DISCORD_SELLER_LEADS_WEBHOOK_URL

/** The display name for a resolved mutation slug, for the lead card. */
async function mutationName(slug: string): Promise<string | null> {
  if (slug === 'default') return null
  const index = await getCatalogIndexOrEmpty()
  return index.mutations.find((row) => row.slug === slug)?.name ?? null
}

/**
 * Mirror the lead to the private staff channel. Fire-and-forget: a failed post
 * must never break the seller's ephemeral reply — the pitch is what matters,
 * the lead card is a bonus for us.
 */
function dropLead(payload: MessagePayload): void {
  if (!LEADS_WEBHOOK) return
  // Intentionally not awaited — the interaction response shouldn't wait on our
  // internal notification, and any failure is logged inside sendToWebhook.
  void sendToWebhook(LEADS_WEBHOOK, payload)
}

export async function runSell(
  interaction: Interaction,
  brainrotInput: string,
  mutationInput: string | undefined,
  priceInput: string | undefined,
): Promise<MessagePayload> {
  const slug = await resolveBrainrotSlug(brainrotInput)

  if (!slug) {
    return ephemeral(
      `I couldn't find a Brainrot matching **${clamp(brainrotInput, 80)}**. Pick one from the autocomplete list and try again.`,
    )
  }

  const [pricing, mutationSlug] = await Promise.all([
    getBrainrotPricing(slug),
    resolveMutationSlug(mutationInput),
  ])

  if (!pricing) {
    // Still a lead worth capturing, but without live pricing we can't build the
    // value-led pitch — send them to the application directly.
    return ephemeral(
      `I found **${slug}** but have no price data for it yet. You can still list it — apply to sell here: ${SELLER_APPLY_URL}`,
    )
  }

  const variant =
    pricing.mutations.find((m) => m.mutationSlug === mutationSlug) ??
    pricing.defaultPrice ??
    pricing.mutations[0]
  const valueUsd = variant?.averageUsd ?? variant?.valueUsd ?? null

  const user = interaction.member?.user ?? interaction.user
  dropLead(
    sellerLeadPayload({
      brainrotName: pricing.name,
      mutationName: await mutationName(mutationSlug),
      valueUsd,
      askingPrice: priceInput?.trim() ? clamp(priceInput.trim(), 100) : null,
      handle: user?.username ?? null,
      userId: interactionUserId(interaction),
    }),
  )

  return sellMessage(pricing, mutationSlug)
}
