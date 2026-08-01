/**
 * /top — highest-value Brainrots, optionally filtered to one rarity.
 *
 * Cheap to build and highly shareable: it gets screenshotted into other
 * servers, and every screenshot carries the DropMarket footer.
 */

import { ephemeral, topMessage } from '../embeds'
import { getTopValues } from '../prices'
import type { MessagePayload } from '../types'

/** The eight rarities that actually exist in the catalog. */
export const RARITIES = [
  'Secret',
  'Brainrot God',
  'Mythic',
  'Legendary',
  'Epic',
  'Rare',
  'Common',
  'OG',
] as const

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 25

export async function runTop(
  rarityInput: string | undefined,
  limitInput: string | undefined,
): Promise<MessagePayload> {
  const rarity =
    RARITIES.find(
      (value) => value.toLowerCase() === rarityInput?.trim().toLowerCase(),
    ) ?? null

  if (rarityInput?.trim() && !rarity) {
    return ephemeral(
      `Unknown rarity **${rarityInput}**. Pick one of: ${RARITIES.join(', ')}.`,
    )
  }

  const parsedLimit = Number(limitInput)
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(parsedLimit)))
    : DEFAULT_LIMIT

  const items = await getTopValues(rarity, limit)

  if (!items.length) {
    return ephemeral(
      rarity
        ? `No priced ${rarity} items yet. Coverage is still filling in for that rarity.`
        : 'No priced items available right now.',
    )
  }

  return topMessage(items, rarity)
}
