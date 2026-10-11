import { describe, it, expect } from 'vitest'
import { buildListingRow, insertListing, type NewListing } from './create'
import type { ListingWrite } from './validate'

const WRITE: ListingWrite = {
  title: 'Sword of Testing',
  description: 'a description',
  price: 4.99,
  original_price: null,
  quantity: 3,
  min_quantity: 1,
  delivery_method: 'manual',
  delivery_time: '1hr',
  images: ['https://example.test/a.webp'],
  template_data: { rarity: 'rare' },
  region: null,
  platform: null,
  bundle_id: null,
  delivery_method_type: null,
  status: 'active',
}

const BASE: NewListing = {
  sellerId: 'seller-1',
  target: { gameId: 'game-1', gameCategoryId: 'pair-1', legacyCategoryId: 'cat-1' },
  write: WRITE,
  status: 'active',
}

/** Minimal writer stub in the shape the seam declares. */
function writerStub(result: { data: unknown; error: { message: string } | null }) {
  const inserted: Array<Record<string, unknown>> = []
  return {
    inserted,
    from(_table: string) {
      return {
        insert(row: Record<string, unknown>) {
          inserted.push(row)
          return {
            select: () => ({ single: async () => result }),
          }
        },
      }
    },
  }
}

describe('buildListingRow — the validated write becomes the row verbatim', () => {
  it('carries every validated field plus the seller and the target pair', () => {
    const row = buildListingRow(BASE)
    expect(row).toMatchObject({
      seller_id: 'seller-1',
      game_id: 'game-1',
      game_category_id: 'pair-1',
      category_id: 'cat-1',
      title: 'Sword of Testing',
      description: 'a description',
      price: 4.99,
      original_price: null,
      quantity: 3,
      min_quantity: 1,
      delivery_method: 'manual',
      delivery_time: '1hr',
      images: ['https://example.test/a.webp'],
      template_data: { rarity: 'rare' },
      region: null,
      platform: null,
      bundle_id: null,
      delivery_method_type: null,
      status: 'active',
    })
  })

  it('writes the currency delivery method the validator resolved', () => {
    const row = buildListingRow({ ...BASE, write: { ...WRITE, delivery_method_type: 'gamepass' } })
    expect(row.delivery_method_type).toBe('gamepass')
  })

  it('writes the CALLER decided status, not the requested one inside the validated write', () => {
    // validateListingWrite only ever returns draft|active; the publish policy
    // (or the importer's approval) is what decides pending_approval.
    const row = buildListingRow({ ...BASE, status: 'pending_approval' })
    expect(row.status).toBe('pending_approval')
  })

  it('never emits an empty title — the column is NOT NULL and the DB slug derives from it', () => {
    const row = buildListingRow({ ...BASE, write: { ...WRITE, title: '' } })
    expect(row.title).toBe('Untitled')
  })

  it('takes the resolved title and images when the caller overrides them (currency auto-fill)', () => {
    const row = buildListingRow({
      ...BASE,
      write: { ...WRITE, title: '', images: [] },
      title: 'Fortnite V-Bucks',
      images: ['https://example.test/logo.png'],
    })
    expect(row.title).toBe('Fortnite V-Bucks')
    expect(row.images).toEqual(['https://example.test/logo.png'])
  })
})

describe('buildListingRow — moderation columns (AUTH-031)', () => {
  it('OMITS approved_by / approved_at entirely when the caller does not approve', () => {
    const row = buildListingRow(BASE)
    expect(row).not.toHaveProperty('approved_by')
    expect(row).not.toHaveProperty('approved_at')
    expect(row).not.toHaveProperty('rejected_by')
  })

  it('sets both approval columns together when an admin publishes on behalf of a store', () => {
    const row = buildListingRow({ ...BASE, approvedBy: 'admin-9' })
    expect(row.approved_by).toBe('admin-9')
    expect(typeof row.approved_at).toBe('string')
  })
})

describe('buildListingRow — import identity', () => {
  it('omits the import columns on an ordinary publish, so the unique index ignores it', () => {
    const row = buildListingRow(BASE)
    expect(row).not.toHaveProperty('import_batch_id')
    expect(row).not.toHaveProperty('import_item_ref')
    expect(row).not.toHaveProperty('import_variant')
  })

  it('carries the catalogue identity when the importer writes it', () => {
    const row = buildListingRow({
      ...BASE,
      importBatchId: 'batch-1',
      importItemRef: 'frost-dragon',
      importVariant: 'FR',
    })
    expect(row).toMatchObject({
      import_batch_id: 'batch-1',
      import_item_ref: 'frost-dragon',
      import_variant: 'FR',
    })
  })

  it('writes a null variant explicitly, so "no variant" is one slot in the index', () => {
    const row = buildListingRow({ ...BASE, importItemRef: 'jungle-egg' })
    expect(row.import_item_ref).toBe('jungle-egg')
    expect(row.import_variant).toBeNull()
  })
})

describe('buildListingRow — metadata', () => {
  it('omits metadata when the caller passes none, so a wizard row is unchanged', () => {
    expect(buildListingRow(BASE)).not.toHaveProperty('metadata')
  })

  it('passes the caller metadata through verbatim', () => {
    const row = buildListingRow({ ...BASE, metadata: { source: 'bulk' } })
    expect(row.metadata).toEqual({ source: 'bulk' })
  })
})

describe('insertListing', () => {
  it('reports the status the row was STORED as (a trigger may have held it for review)', async () => {
    const w = writerStub({ data: { id: 'l-2', slug: 's', status: 'pending_approval' }, error: null })
    const res = await insertListing(w, BASE)
    expect(res).toEqual({ ok: true, id: 'l-2', slug: 's', status: 'pending_approval' })
  })

  it('inserts the built row and reads back the DB-generated id and slug', async () => {
    const w = writerStub({ data: { id: 'l-1', slug: 'sword-of-testing' }, error: null })
    const res = await insertListing(w, BASE)
    expect(res).toEqual({ ok: true, id: 'l-1', slug: 'sword-of-testing', status: null })
    expect(w.inserted).toHaveLength(1)
    expect(w.inserted[0].seller_id).toBe('seller-1')
  })

  it('returns the DB error as a value instead of throwing, so a batch can continue', async () => {
    const w = writerStub({ data: null, error: { message: 'violates check constraint' } })
    const res = await insertListing(w, BASE)
    expect(res).toEqual({ ok: false, error: 'violates check constraint' })
  })

  it('succeeds with null ids when the row inserted but was not read back', async () => {
    const w = writerStub({ data: null, error: null })
    const res = await insertListing(w, BASE)
    expect(res).toEqual({ ok: true, id: null, slug: null, status: null })
  })
})
