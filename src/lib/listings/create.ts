/**
 * ONE place a listings row is built and inserted (Step 4).
 *
 * `validate.ts` is the single validator for every write path; this is the
 * single *writer* for every path that CREATES a listing — the sell wizard, the
 * seller CSV upload, and the admin bulk importer. Keeping the payload assembly
 * here means a new column, or a new rule about moderation columns, is a
 * one-file change instead of three near-identical object literals.
 *
 * What it deliberately does NOT do, so each caller keeps its own policy:
 *   · the seller gate (sell_access_kind) and the publish policy — the caller
 *     decides the status and passes it in
 *   · the (game, category) gate — the caller resolves the pair (AUTH-010) and
 *     passes it as the target
 *   · revalidation and IndexNow — the caller batches those (a 500-row import
 *     revalidates once per category, not once per row)
 *
 * Trust: the insert runs as the SERVICE ROLE at every call site (AUTH-031 —
 * the DB coerces an untrusted insert to pending_approval with NULL moderation
 * columns), so `approvedBy` is a real capability. Only an admin path may pass
 * it, and `listing-create-seam.guard.test.ts` pins which files can.
 *
 * Plain TS, no I/O of its own: the writer client is injected.
 */
import type { ListingWrite } from './validate'

/** The enabled (game, category) pair the listing belongs to. */
export interface ListingTarget {
  gameId: string
  gameCategoryId: string
  /**
   * Phase A of the categories unification: `listings.category_id` is still
   * NOT NULL and points at the mirrored legacy row. `trg_listings_category_sync`
   * would derive it, but writing it explicitly keeps the insert independent of
   * trigger order. Phase B drops the column and this field with it.
   */
  legacyCategoryId: string | null
}

export interface NewListing {
  /** Whose listing this is. Never read from the payload — the caller pins it. */
  sellerId: string
  target: ListingTarget
  /** Output of `validateListingWrite` — never raw client input. */
  write: ListingWrite
  /**
   * The status the caller's policy decided. The validator only admits
   * draft|active; `pending_approval` comes from `decidePublishStatus` (or the
   * bulk auto-approve flag). The DB trigger re-checks it either way.
   */
  status: 'draft' | 'active' | 'pending_approval'
  /** Resolved title, when the caller filled it after validation (currency). */
  title?: string
  /** Resolved images, same reason. */
  images?: string[]
  /** Written verbatim; omitted from the row when absent. */
  metadata?: Record<string, unknown> | null
  /**
   * Admin publishing on behalf of a store: the row is born approved.
   * `check_listing_moderation` returns early when approved_by is set, so this
   * is the same end state as calling `approve_listing()` afterwards — without
   * one RPC per row. Requires an admin caller; see the guard test.
   */
  approvedBy?: string | null
  /**
   * Bulk importer only (Step 4). `importItemRef` + `importVariant` are the
   * catalogue identity this listing represents; with (seller, game) they are the
   * unique key that makes a re-import an UPDATE rather than a duplicate.
   */
  importBatchId?: string | null
  importItemRef?: string | null
  importVariant?: string | null
}

/** The slice of a Supabase client this needs (same pattern as games/icons.ts). */
export interface ListingsWriter {
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{ data: unknown; error: { message: string } | null }>
      }
    }
  }
}

export type InsertResult =
  /** `status` is what the row was STORED as — the DB triggers may have held an
   *  'active' insert for review, and callers alert moderators on that. */
  | { ok: true; id: string | null; slug: string | null; status: string | null }
  | { ok: false; error: string }

/**
 * Build the row. Pure, so a preview can show exactly what would be written.
 *
 * Moderation columns are present ONLY when the caller approves — the AUTH-031
 * test asserts the key is absent, not null, on a seller publish.
 */
export function buildListingRow(input: NewListing): Record<string, unknown> {
  const { write: v } = input
  const row: Record<string, unknown> = {
    seller_id: input.sellerId,
    game_id: input.target.gameId,
    game_category_id: input.target.gameCategoryId,
    category_id: input.target.legacyCategoryId,
    // NOT NULL, and set_listing_slug derives the URL slug from it.
    title: (input.title ?? v.title) || 'Untitled',
    // NOT NULL in the legacy schema; the validator already trimmed it.
    description: v.description,
    price: v.price,
    original_price: v.original_price,
    quantity: v.quantity,
    min_quantity: v.min_quantity,
    delivery_method: v.delivery_method,
    delivery_time: v.delivery_time,
    images: input.images ?? v.images,
    template_data: v.template_data,
    region: v.region,
    platform: v.platform,
    bundle_id: v.bundle_id,
    // Currency delivery method id (Gamepass / Login …), or null.
    delivery_method_type: v.delivery_method_type,
    status: input.status,
  }
  if (input.metadata != null) row.metadata = input.metadata
  if (input.approvedBy) {
    row.approved_by = input.approvedBy
    row.approved_at = new Date().toISOString()
  }
  // Import identity: only present on an imported listing, so the partial unique
  // index and every hand-made listing stay out of each other's way.
  if (input.importBatchId) row.import_batch_id = input.importBatchId
  if (input.importItemRef) {
    row.import_item_ref = input.importItemRef
    row.import_variant = input.importVariant ?? null
  }
  return row
}

/**
 * Insert one listing and read back what the DB generated (id, slug).
 *
 * Returns the error as a value rather than throwing: a 500-row import must
 * record the failing row and carry on.
 */
export async function insertListing(
  writer: ListingsWriter,
  input: NewListing,
): Promise<InsertResult> {
  const { data, error } = await writer
    .from('listings')
    .insert(buildListingRow(input))
    // slug is DB-generated (set_listing_slug); the caller needs it for the
    // listing URL (IndexNow ping, the importer's row audit trail).
    .select('id, slug, status')
    .single()
  if (error) return { ok: false, error: error.message }
  const r = data as { id?: string; slug?: string | null; status?: string | null } | null
  return { ok: true, id: r?.id ?? null, slug: r?.slug ?? null, status: r?.status ?? null }
}
