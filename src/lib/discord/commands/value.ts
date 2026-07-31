/**
 * /value — the core lookup.
 *
 * Autocomplete sends the Brainrot SLUG as the choice value, but a user can
 * always ignore the picker and submit free text, so resolution accepts either.
 */

import { getCatalogIndex, getCatalogIndexOrEmpty } from '../catalog'
import { ephemeral, valueMessage } from '../embeds'
import { bestMatch, rankMatches } from '../match'
import { getBrainrotPricing } from '../prices'
import { Limits, type MessagePayload } from '../types'
import { clamp } from '../format'

export type AutocompleteChoice = { name: string; value: string }

export async function autocompleteBrainrot(
  query: string,
): Promise<AutocompleteChoice[]> {
  const index = await getCatalogIndexOrEmpty()

  return rankMatches(query, index.brainrots, Limits.autocompleteChoices).map(
    ({ item }) => ({
      name: clamp(
        item.rarity ? `${item.name} · ${item.rarity}` : item.name,
        Limits.choiceName,
      ),
      value: item.slug,
    }),
  )
}

export async function autocompleteMutation(
  query: string,
): Promise<AutocompleteChoice[]> {
  const index = await getCatalogIndexOrEmpty()

  return rankMatches(query, index.mutations, Limits.autocompleteChoices).map(
    ({ item }) => ({
      name: clamp(item.name, Limits.choiceName),
      value: item.slug,
    }),
  )
}

/**
 * Turn whatever the user submitted into a catalog slug.
 *
 * Exact slug first (the autocomplete path), then fuzzy on the name so
 * "skibdi toilet" still lands.
 */
export async function resolveBrainrotSlug(
  input: string,
): Promise<string | null> {
  const trimmed = input.trim()
  if (!trimmed) return null

  const index = await getCatalogIndex()

  const exact = index.brainrots.find((row) => row.slug === trimmed)
  if (exact) return exact.slug

  return bestMatch(trimmed, index.brainrots)?.slug ?? null
}

/** Resolve a mutation to a slug, defaulting to `default` when unspecified. */
export async function resolveMutationSlug(
  input: string | undefined,
): Promise<string> {
  const trimmed = input?.trim()
  if (!trimmed) return 'default'

  const index = await getCatalogIndex()

  const exact = index.mutations.find((row) => row.slug === trimmed)
  if (exact) return exact.slug

  return bestMatch(trimmed, index.mutations)?.slug ?? 'default'
}

export async function runValue(
  brainrotInput: string,
  mutationInput: string | undefined,
): Promise<MessagePayload> {
  const slug = await resolveBrainrotSlug(brainrotInput)

  if (!slug) {
    return ephemeral(
      `I couldn't find a Brainrot matching **${clamp(brainrotInput, 80)}**. Try picking one from the autocomplete list.`,
    )
  }

  const pricing = await getBrainrotPricing(slug)

  if (!pricing) {
    return ephemeral(
      `I found **${slug}** in the catalog but have no price data for it yet.`,
    )
  }

  const mutationSlug = await resolveMutationSlug(mutationInput)
  return valueMessage(pricing, mutationSlug)
}

/** Handles the mutation dropdown on an existing /value message. */
export async function runValueSelect(
  brainrotSlug: string,
  mutationSlug: string,
): Promise<MessagePayload> {
  const pricing = await getBrainrotPricing(brainrotSlug)

  if (!pricing) {
    return ephemeral('That item no longer has price data.')
  }

  return valueMessage(pricing, mutationSlug)
}
