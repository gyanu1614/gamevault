/**
 * Currency delivery methods (owner, 2026-10-08): per-game list an admin
 * switches on and edits in the Currency config (`delivery_methods`). The
 * seller picks one per listing; it is stored as the method id in
 * `listings.delivery_method_type` and buyers filter by it. Reads tolerate
 * any JSON the config blob holds — it is not validated on save.
 */
import type { CurrencyDeliveryMethod } from '@/lib/types/category-configs'

function readMethods(config: unknown, activeOnly: boolean): CurrencyDeliveryMethod[] {
  const dm = (config as { delivery_methods?: unknown } | null | undefined)?.delivery_methods as
    | { enabled?: unknown; options?: unknown }
    | undefined
  if (!dm || (activeOnly && dm.enabled !== true) || !Array.isArray(dm.options)) return []
  const out: CurrencyDeliveryMethod[] = []
  for (const o of dm.options as Array<Record<string, unknown>>) {
    const id = typeof o?.id === 'string' ? o.id.trim() : ''
    const label = typeof o?.label === 'string' ? o.label.trim() : ''
    if (!id || !label) continue
    out.push({ id, label, description: typeof o.description === 'string' ? o.description.trim() : '' })
  }
  return out
}

/** The methods sellers can pick and buyers can filter by ([] when the field is off). */
export function activeDeliveryMethods(config: unknown): CurrencyDeliveryMethod[] {
  return readMethods(config, true)
}

/**
 * A listing's or order's method by id, for checkout and the order page.
 * Ignores the on/off switch: an order keeps naming its method after an
 * admin turns the field off. Null when the admin deleted that method.
 */
export function findDeliveryMethod(config: unknown, id: string | null | undefined): CurrencyDeliveryMethod | null {
  if (!id) return null
  return readMethods(config, false).find((m) => m.id === id) ?? null
}

export function deliveryMethodLabel(methods: readonly CurrencyDeliveryMethod[], id: string | null | undefined): string | null {
  if (!id) return null
  return methods.find((m) => m.id === id)?.label ?? null
}

/** Server check for a listing write: an id from the active list, or nothing. */
export function checkDeliveryMethod(
  config: unknown,
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const methods = activeDeliveryMethods(config)
  if (methods.length === 0 || !raw) return { ok: true, value: null }
  return methods.some((m) => m.id === raw) ? { ok: true, value: raw } : { ok: false, error: 'Pick a delivery method from the list.' }
}

export function filterByDeliveryMethod<T extends { deliveryMethodId?: string | null }>(offers: readonly T[], methodId: string | null): T[] {
  return methodId ? offers.filter((o) => (o.deliveryMethodId ?? null) === methodId) : [...offers]
}

/** The methods at least one live offer uses — the buyer filter's chips. */
export function methodsInUse<T extends { deliveryMethodId?: string | null }>(
  methods: readonly CurrencyDeliveryMethod[],
  offers: readonly T[],
): CurrencyDeliveryMethod[] {
  const used = new Set(offers.map((o) => o.deliveryMethodId).filter(Boolean))
  return methods.filter((m) => used.has(m.id))
}

/**
 * Bulk CSV cell → method id. Sellers type the method's name ("Gamepass");
 * an id works too. Unknown text is returned as-is so validateListingWrite
 * rejects the row with its usual message.
 */
export function resolveDeliveryMethodId(config: unknown, raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  const key = v.toLowerCase()
  const hit = activeDeliveryMethods(config).find((m) => m.id.toLowerCase() === key || m.label.toLowerCase() === key)
  return hit?.id ?? v
}
