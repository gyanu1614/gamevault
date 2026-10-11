import { describe, it, expect } from 'vitest'

import type { Attribute, AttributeTemplateFull } from '@/lib/actions/new-schema'
import type { SellGameOption } from '@/lib/actions/sell-wizard'

import { buildChildIndex } from './attribute-tree'
import { EMPTY_OFFER_FORM, hasDetailsInput, offerFormFromListing, offerFormFromSnapshot, toSnapshot, type OfferForm } from './offer-form'
import { canContinue, canPublishOffer, priceHintInputFor, publishPayloadFor, requiredAttributesFilled, templateDataFor } from './offer-rules'

const attr = (o: Partial<Attribute> & { id: string; slug: string }): Attribute =>
  ({ template_id: 't', parent_attribute_id: null, name: o.slug, description: null, type: 'select', is_required: false, placeholder: null, help_text: null, min_value: null, max_value: null, max_length: null, default_value: null, sort_order: 0, seo_title: null, seo_description: null, facet_indexed: false, ...o }) as Attribute

// Item Type (required) → when "gun": Gun (required); Rarity is free-standing.
const itemType = attr({ id: 'a1', slug: 'item_type', is_required: true, options: [{ value: 'gun', label: 'Gun' }] as never })
const gun = attr({ id: 'a2', slug: 'gun', is_required: true, conditional_rules: [{ trigger_attribute_id: 'a1', operator: 'equals', trigger_values: ['gun'] }] as never, options: [{ value: 'ginger', label: 'Gingerscope' }] as never })
const rarity = attr({ id: 'a3', slug: 'rarity', type: 'text' })
const template = { attributes: [itemType, gun, rarity] } as unknown as AttributeTemplateFull
const { topLevel, childrenOf } = buildChildIndex(template.attributes)
const game = { game_id: 'g1', game_slug: 'mm2', game_category_id: 'gc1', requires_region: false, delivery_modes: ['manual'] } as unknown as SellGameOption
const filled: OfferForm = { ...EMPTY_OFFER_FORM, title: 'Gingerscope', price: '7.5', quantity: '2', images: ['u1'], agreeSellerRules: true, agreeTos: true }

describe('requiredAttributesFilled', () => {
  it('needs the required parent and the required sub-field of the picked choice', () => {
    expect(requiredAttributesFilled(template, {}, topLevel, childrenOf)).toBe(false)
    expect(requiredAttributesFilled(template, { a1: 'gun' }, topLevel, childrenOf)).toBe(false)
    expect(requiredAttributesFilled(template, { a1: 'gun', a2: 'ginger' }, topLevel, childrenOf)).toBe(true)
    expect(requiredAttributesFilled(null, {}, [], new Map())).toBe(true)
  })
})

describe('canContinue', () => {
  it('step 1 needs a category, step 2 a game (and a region when the game asks)', () => {
    expect(canContinue(1, null, null, '')).toBe(false)
    expect(canContinue(1, { id: 'c' } as never, null, '')).toBe(true)
    expect(canContinue(2, { id: 'c' } as never, game, '')).toBe(true)
    expect(canContinue(2, { id: 'c' } as never, { ...game, requires_region: true }, '')).toBe(false)
    expect(canContinue(3, { id: 'c' } as never, game, '')).toBe(false)
  })
})

describe('canPublishOffer', () => {
  const base = { form: filled, attributesFilled: true, categorySlug: 'items', currencyConfig: null, deliveryMethods: [], policy: null }
  it('passes a complete items offer and fails each missing piece', () => {
    expect(canPublishOffer(base)).toBe(true)
    expect(canPublishOffer({ ...base, attributesFilled: false })).toBe(false)
    expect(canPublishOffer({ ...base, form: { ...filled, title: ' ' } })).toBe(false)
    expect(canPublishOffer({ ...base, form: { ...filled, images: [] } })).toBe(false)
    expect(canPublishOffer({ ...base, form: { ...filled, price: '0' } })).toBe(false)
    expect(canPublishOffer({ ...base, form: { ...filled, agreeTos: false } })).toBe(false)
    expect(canPublishOffer({ ...base, policy: { at_listing_limit: true } as never })).toBe(false)
  })
  it('currency skips title and photos but needs the bundle and delivery method when the game has them', () => {
    const cur = { ...base, categorySlug: 'currency', form: { ...filled, title: '', images: [] } }
    expect(canPublishOffer(cur)).toBe(true)
    expect(canPublishOffer({ ...cur, currencyConfig: { bundles: [{ id: 'b1' }] } as never })).toBe(false)
    expect(canPublishOffer({ ...cur, currencyConfig: { bundles: [{ id: 'b1' }] } as never, form: { ...cur.form, bundleId: 'b1' } })).toBe(true)
    expect(canPublishOffer({ ...cur, deliveryMethods: [{ id: 'gamepass' }] as never })).toBe(false)
    expect(canPublishOffer({ ...cur, deliveryMethods: [{ id: 'gamepass' }] as never, form: { ...cur.form, deliveryMethodType: 'gamepass' } })).toBe(true)
  })
})

describe('templateDataFor / priceHintInputFor', () => {
  it('keeps only visible, non-empty answers keyed by slug', () => {
    expect(templateDataFor(template, { a1: 'gun', a2: 'ginger', a3: '' })).toEqual({ item_type: 'gun', gun: 'ginger' })
    // A stale child under a parent that no longer reveals it is dropped.
    expect(templateDataFor(template, { a1: 'knife', a2: 'ginger' })).toEqual({ item_type: 'knife' })
  })
  it('asks the price helper with the dropdown picks and their labels (items only)', () => {
    const hint = priceHintInputFor({ game, category: { slug: 'items' } as never, template, values: { a1: 'gun', a2: 'ginger', a3: 'Ancient' }, bundleId: '' })
    expect(hint).toEqual({ gameSlug: 'mm2', categorySlug: 'items', gameCategoryId: 'gc1', templateData: { item_type: 'gun', gun: 'ginger' }, optionLabels: { item_type: { gun: 'Gun' }, gun: { ginger: 'Gingerscope' } }, bundleId: null })
    expect(priceHintInputFor({ game: null, category: null, template, values: {}, bundleId: '' })).toBeNull()
  })
})

describe('publishPayloadFor', () => {
  it('builds the listing write from the form', () => {
    const p = publishPayloadFor({ form: { ...filled, fieldValues: { a1: 'gun', a2: 'ginger' }, region: 'eu', bundleId: '' }, game, categorySlug: 'items', template, currencyConfig: null, asDraft: false })
    expect(p).toMatchObject({ game_id: 'g1', category_slug: 'items', title: 'Gingerscope', price: 7.5, quantity: 2, min_quantity: 1, region: 'eu', platform: null, bundle_id: null, status: 'active', template_data: { item_type: 'gun', gun: 'ginger' } })
  })
})

describe('offer form', () => {
  it('opens an existing listing with its bundle (edit used to drop it) and unticked terms', () => {
    const f = offerFormFromListing({ category_slug: 'currency', game_id: 'g1', game_slug: 'roblox', game_category_id: 'gc1', bundle_id: 'b1', title: 'Robux', description: 'd', price: 4, original_price: null, quantity: 3, min_quantity: 1, delivery_method: 'manual', delivery_time: null, region: null, platform: 'pc', template_data: {}, images: [], status: 'active', moderation_notes: null, delivery_method_type: 'gamepass' })
    expect(f).toMatchObject({ bundleId: 'b1', price: '4', quantity: '3', platform: 'pc', deliveryTime: '1hr', deliveryMethodType: 'gamepass', agreeTos: false })
  })
  it('round-trips a refresh snapshot without the device', () => {
    const form = { ...filled, device: 'ios' }
    const snap = toSnapshot(form, { step: 3, categoryId: 'c', gameId: 'g1' })
    expect(snap).not.toHaveProperty('device')
    expect(offerFormFromSnapshot(snap)).toEqual({ ...form, device: '' })
    expect(offerFormFromSnapshot({})).toEqual(EMPTY_OFFER_FORM)
  })
  it('counts only real input as unsaved work', () => {
    expect(hasDetailsInput(EMPTY_OFFER_FORM)).toBe(false)
    expect(hasDetailsInput({ ...EMPTY_OFFER_FORM, fieldValues: { a1: [] } })).toBe(false)
    expect(hasDetailsInput({ ...EMPTY_OFFER_FORM, price: '3' })).toBe(true)
  })
})
