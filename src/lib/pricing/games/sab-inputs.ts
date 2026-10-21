/**
 * Everything the SAB reprice reads, in one place, read the cheap way.
 *
 * - The two reference VIEWS (catalog, calculator) come from ONE rpc,
 *   sab_reprice_reference(), each view computed once. Paged, every page
 *   recomputed the whole view (2026-10-20 usage audit, C1).
 * - Every TABLE is read by keyset (`selectAllByKey`), never OFFSET: the raw
 *   listings read was 34 OFFSET pages over a 300 MB table.
 */
import { selectAllByKey } from '@/lib/db/select-all-by-key'
import type { createServiceRoleClient } from '@/lib/supabase/service'

type Admin = ReturnType<typeof createServiceRoleClient>

export type CatalogRow = {
  brainrot_id: string
  mutation_id: string
  mutation_slug: string
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  confidence_label: string | null
  external_sample_size: number | null
  source_count: number | null
}

export type BrainrotRow = {
  id: string
  rarity: string | null
  ingame_cost: number | string | null
  base_income_per_second: number | string | null
  obtainability: string | null
}

export type EvidenceRow = {
  brainrot_id: string
  mutation_id: string
  unit_price_usd: number | string | null
  source_slug: string | null
}

export type ReputableRow = {
  brainrot_id: string
  mutation_id: string
  unit_price_usd: number | string | null
  /**
   * ROUTE-010: these four arrive as server-side JSONB extractions of raw_payload
   * rather than the whole blob. `->>` always yields text, so every one of these
   * is a string (or null) even when the JSON value is a number or a boolean:
   * parse accordingly, never compare identity.
   */
  /** raw_payload->>'seller_sales_count' */
  payload_sales: string | null
  /** raw_payload->>'title' */
  payload_title: string | null
  /** False when the collector tagged the listing OUTSIDE the item's canonical
   * income tier. raw_payload->>'is_canonical_band', the TEXT 'false'. */
  payload_canonical_band: string | null
  /** The listing's income tier upper bound. raw_payload->'income_band'->>'upper' */
  payload_band_upper: string | null
  listing_status: string | null
  parse_status: string | null
  /** When the crawl last saw this listing: the incremental signal. */
  observed_at: string | null
  is_bundle: boolean | null
  is_account_listing: boolean | null
  is_inventory_listing: boolean | null
  is_duplicate: boolean | null
  is_outlier: boolean | null
  rejection_reason: string | null
}

/** One previously-written correction: just enough to decide skip vs rewrite. */
export type ExistingCorrectionRow = {
  brainrot_id: string
  mutation_id: string
  computed_at: string | null
}

export type MutationRow = {
  slug: string
  income_multiplier: number | string | null
}

export type CalculatorRow = {
  brainrot_id: string
  mutation_id: string
  calculated_income_per_second: number | string | null
}

export type SabRepriceInputs = {
  catalog: CatalogRow[]
  mutations: MutationRow[]
  calculator: CalculatorRow[]
  brainrots: BrainrotRow[]
  evidence: EvidenceRow[]
  rawListings: ReputableRow[]
  existingCorrections: ExistingCorrectionRow[]
}

/** sab_reprice_reference(): { catalog, calculator } as one jsonb document. */
async function loadReferenceViews(admin: Admin): Promise<Pick<SabRepriceInputs, 'catalog' | 'calculator'>> {
  const { data, error } = await (admin as any).rpc('sab_reprice_reference')
  if (error) throw new Error(`sab_reprice_reference: ${error.message}`)
  const doc = (data ?? {}) as { catalog?: CatalogRow[]; calculator?: CalculatorRow[] }
  return { catalog: doc.catalog ?? [], calculator: doc.calculator ?? [] }
}

export async function loadSabRepriceInputs(admin: Admin): Promise<SabRepriceInputs> {
  const [reference, mutations, brainrots, evidence, rawListings, existingCorrections] = await Promise.all([
    loadReferenceViews(admin),
    selectAllByKey<MutationRow>(admin, { table: 'sab_mutations', columns: 'slug,income_multiplier', key: 'slug' }),
    selectAllByKey<BrainrotRow>(admin, {
      table: 'sab_brainrots',
      columns: 'id,rarity,ingame_cost,base_income_per_second,obtainability',
      key: 'id',
    }),
    // ROUTE-014: the materialized evidence snapshot, not the live view (the
    // view seq-scans every raw listing twice). Refreshed by the caller first.
    selectAllByKey<EvidenceRow>(admin, {
      table: 'sab_market_evidence_display',
      columns: 'brainrot_id,mutation_id,unit_price_usd,source_slug',
      key: 'id',
    }),
    selectAllByKey<ReputableRow>(admin, {
      table: 'sab_market_raw_listings',
      // ROUTE-010: only the four raw_payload keys, extracted server-side.
      columns:
        'brainrot_id,mutation_id,unit_price_usd,listing_status,parse_status,' +
        'observed_at,' +
        'is_bundle,is_account_listing,is_inventory_listing,is_duplicate,' +
        'is_outlier,rejection_reason,' +
        'payload_title:raw_payload->>title,' +
        'payload_sales:raw_payload->>seller_sales_count,' +
        'payload_canonical_band:raw_payload->>is_canonical_band,' +
        'payload_band_upper:raw_payload->income_band->>upper',
      key: 'id',
      // Only these ever survive the correction's filter loop: let Postgres drop
      // the rest (~34k rows read instead of the whole table).
      filter: (q) => q.eq('listing_status', 'active').eq('parse_status', 'matched'),
    }),
    // What we last wrote, so unchanged evidence is skipped and keys that left
    // the catalogue are pruned.
    selectAllByKey<ExistingCorrectionRow>(admin, {
      table: 'sab_price_corrections',
      columns: 'brainrot_id,mutation_id,computed_at',
      key: ['brainrot_id', 'mutation_id'],
    }),
  ])

  return { ...reference, mutations, brainrots, evidence, rawListings, existingCorrections }
}
