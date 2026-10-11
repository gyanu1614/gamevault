import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls: string[] = []
const listing = vi.fn()
const policy = vi.fn()
const games = vi.fn()
const template = vi.fn()
const config = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/actions/sell-wizard', () => ({
  fetchListingForDuplicate: (...a: unknown[]) => (calls.push('listing'), listing(...a)),
  fetchPublishPolicy: () => (calls.push('policy'), policy()),
  fetchSellGamesForCategory: (...a: unknown[]) => (calls.push('games'), games(...a)),
}))
vi.mock('@/lib/actions/new-schema', () => ({
  getAttributeTemplateFull: (...a: unknown[]) => (calls.push('template'), template(...a)),
}))
vi.mock('@/lib/actions/admin-category-configs', () => ({
  fetchCategoryConfig: (...a: unknown[]) => (calls.push('config'), config(...a)),
}))

import { loadWizardPrefill } from './wizard-prefill'

const row = (over: Record<string, unknown> = {}) => ({
  category_slug: 'currency', game_id: 'g1', game_slug: 'roblox', game_category_id: 'gc1',
  title: 'Robux', description: '', price: 1, original_price: null, quantity: 10, min_quantity: 1,
  delivery_method: 'manual', delivery_time: '1hr', region: null, platform: null, bundle_id: 'b1',
  template_data: {}, images: [], status: 'active', moderation_notes: null, delivery_method_type: null, ...over,
})
const option = { game_id: 'g1', game_category_id: 'gc1', game_name: 'Roblox' }

describe('loadWizardPrefill', () => {
  beforeEach(() => {
    calls.length = 0
    vi.clearAllMocks()
    listing.mockResolvedValue({ success: true, data: row() })
    policy.mockResolvedValue({ success: true, data: { at_listing_limit: false } })
    games.mockResolvedValue({ success: true, data: [option, { game_id: 'g2', game_category_id: 'gc2' }] })
    template.mockResolvedValue({ success: true, data: { attributes: [] } })
    config.mockResolvedValue({ unit_label: 'Robux' })
  })

  it('loads everything the details step needs in two parallel waves', async () => {
    const r = await loadWizardPrefill('L1')
    expect(r).toMatchObject({
      success: true,
      data: { listing: { bundle_id: 'b1' }, game: option, template: { attributes: [] }, currencyConfig: { unit_label: 'Robux' }, policy: { at_listing_limit: false } },
    })
    if (!r.success) throw new Error()
    expect(r.data.games).toHaveLength(2)
    // Wave 1 = listing + policy (independent); wave 2 = games, template, config (need the listing).
    expect(calls.slice(0, 2).sort()).toEqual(['listing', 'policy'])
    expect(calls.slice(2).sort()).toEqual(['config', 'games', 'template'])
    expect(template).toHaveBeenCalledWith('gc1')
    expect(config).toHaveBeenCalledWith('g1', 'currency')
  })

  it('skips the currency config for a non-currency listing', async () => {
    listing.mockResolvedValue({ success: true, data: row({ category_slug: 'items' }) })
    const r = await loadWizardPrefill('L1')
    expect(config).not.toHaveBeenCalled()
    expect(r).toMatchObject({ success: true, data: { currencyConfig: null } })
  })

  it('fails when the listing is not readable (missing or not yours)', async () => {
    listing.mockResolvedValue({ success: false, error: 'You can only duplicate your own listings' })
    expect(await loadWizardPrefill('L1')).toEqual({ success: false, error: 'You can only duplicate your own listings' })
    expect(calls).not.toContain('games')
  })

  it('fails when the game is no longer sold in that category', async () => {
    games.mockResolvedValue({ success: true, data: [{ game_id: 'other' }] })
    expect(await loadWizardPrefill('L1')).toEqual({ success: false, error: 'This game is no longer available for this category' })
  })

  it('keeps going without a policy (it only adds the cap banner)', async () => {
    policy.mockResolvedValue({ success: false, error: 'x' })
    expect(await loadWizardPrefill('L1')).toMatchObject({ success: true, data: { policy: null } })
  })
})
