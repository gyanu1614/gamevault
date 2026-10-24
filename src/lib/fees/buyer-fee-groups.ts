/**
 * How /fees organises payment methods (research 2026-10-23: G2G filters by
 * currency into a handful of groups, Stripe lists local methods by type;
 * nobody shows one flat list of every method). Pure and client-safe.
 *
 *  · feeGroupOf: a method's region from its registry countries. Crypto, and
 *    any rail whose countries span more than one region, is "Worldwide".
 *  · publicMethodNames: checkout shows each buyer only their own country's
 *    rails, so several share a label there ("Credit / Debit Card"); a page
 *    listing every method adds the country to a shared label.
 */

import { PAYSSION_METHODS } from '@/lib/payments/providers/payssion/methods'
import { REGIONS, regionForCountry, type RegionId } from '@/lib/payments/regions'

export type FeeGroupId = 'worldwide' | RegionId

export interface FeeGroup<M> {
  id: FeeGroupId
  label: string
  methods: M[]
}

const GROUP_ORDER: readonly FeeGroupId[] = ['worldwide', 'eu', 'latam', 'sea', 'mea', 'eastasia', 'row']

export function feeGroupOf(method: string): FeeGroupId {
  const countries = PAYSSION_METHODS[method]?.countries ?? []
  if (countries.length === 0) return 'worldwide'
  const regions = new Set(countries.map(regionForCountry))
  return regions.size === 1 ? [...regions][0] : 'worldwide'
}

const groupLabel = (id: FeeGroupId) => (id === 'worldwide' ? 'Worldwide' : REGIONS.find((r) => r.id === id)!.label)

/** Methods split into regions, Worldwide first; each group keeps the input order. */
export function groupByRegion<M extends { method: string }>(methods: readonly M[]): FeeGroup<M>[] {
  const byGroup = new Map<FeeGroupId, M[]>()
  for (const m of methods) {
    const id = feeGroupOf(m.method)
    byGroup.set(id, [...(byGroup.get(id) ?? []), m])
  }
  return GROUP_ORDER.filter((id) => byGroup.has(id)).map((id) => ({ id, label: groupLabel(id), methods: byGroup.get(id)! }))
}

/** method → the name to print where every method is listed together. */
export function publicMethodNames(rows: readonly { method: string; label: string }[]): Map<string, string> {
  const shared = new Set(rows.map((r) => r.label).filter((l, i, all) => all.indexOf(l) !== i))
  return new Map(
    rows.map((r) => {
      const coverage = shared.has(r.label) ? PAYSSION_METHODS[r.method]?.coverage : undefined
      return [r.method, coverage ? `${r.label} (${coverage})` : r.label]
    }),
  )
}

const EXAMPLE_PREFERENCE = ['btcpay', 'pix_br', 'trustly']

/** Up to three methods for the worked example: crypto, Pix and Trustly first. */
export function pickExampleMethods<M extends { method: string }>(methods: readonly M[], count = 3): M[] {
  const preferred = EXAMPLE_PREFERENCE.map((id) => methods.find((m) => m.method === id)).filter((m): m is M => !!m)
  const rest = methods.filter((m) => !preferred.includes(m))
  return [...preferred, ...rest].slice(0, count)
}
