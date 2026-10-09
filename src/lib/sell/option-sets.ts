/**
 * Option-driven autofill for the sell form. An attribute option may carry
 * `metadata.sets = { <attribute slug>: <option value> }`: picking it fills
 * those fields too. Used where the catalogue already knows the answer — an
 * MM2 item's rarity, so buyers can still filter by rarity while the seller
 * only picks Type → Item. Only real fields and real option values are set.
 */

interface OptionLike {
  value: string
  metadata?: Record<string, unknown> | null
}

interface AttributeLike {
  id: string
  slug: string
  options?: OptionLike[]
}

export function applyOptionSets(
  attrs: readonly AttributeLike[],
  changedId: string,
  value: unknown,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const picked = attrs.find((a) => a.id === changedId)?.options?.find((o) => o.value === value)
  const sets = picked?.metadata?.sets
  if (!sets || typeof sets !== 'object') return values
  const next = { ...values }
  for (const [slug, target] of Object.entries(sets as Record<string, unknown>)) {
    const attr = attrs.find((a) => a.slug === slug)
    if (!attr || typeof target !== 'string') continue
    if (!attr.options?.some((o) => o.value === target)) continue
    next[attr.id] = target
  }
  return next
}
