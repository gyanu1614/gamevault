import { describe, it, expect } from 'vitest'
import { resolveTemplateData, type TemplateAttributeLike } from './attributes'

const opt = (label: string, value = label) => ({
  slug: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  value,
  label,
})

/** The real Adopt Me items template, as the category page's Trait filter shows it. */
const ADOPT_ME: TemplateAttributeLike[] = [
  {
    slug: 'item-type',
    name: 'Item Type',
    type: 'select',
    options: [opt('Pets'), opt('Vehicles'), opt('Toys'), opt('Strollers')],
  },
  {
    slug: 'trait',
    name: 'Trait',
    type: 'select',
    options: [
      opt('Normal'), opt('Fly'), opt('Fly Ride (FR)'), opt('Neon'),
      opt('Neon Fly Ride (NFR)'), opt('Mega Neon'), opt('Mega Fly Ride (MFR)'),
    ],
  },
]

const variant = (ref: string, label: string) => ({ ref, label })

describe('the variant maps onto the game\'s own Trait filter', () => {
  it.each([
    ['FR', 'Fly Ride', 'Fly Ride (FR)'],
    ['NFR', 'Neon Fly Ride', 'Neon Fly Ride (NFR)'],
    ['MFR', 'Mega Fly Ride', 'Mega Fly Ride (MFR)'],
    ['N', 'Normal', 'Normal'],
    ['NEON', 'Neon', 'Neon'],
    ['MEGA', 'Mega Neon', 'Mega Neon'],
    ['F', 'Fly', 'Fly'],
  ])('%s / %s → %s', (ref, label, expected) => {
    const { data } = resolveTemplateData(ADOPT_ME, { variant: variant(ref, label) })
    expect(data.trait).toBe(expected)
  })

  it('never confuses a variant with a longer one that contains it', () => {
    // "Fly Ride" must not land on "Neon Fly Ride (NFR)".
    expect(resolveTemplateData(ADOPT_ME, { variant: variant('FR', 'Fly Ride') }).data.trait)
      .toBe('Fly Ride (FR)')
    // ...and "Neon" must not land on "Neon Fly Ride (NFR)".
    expect(resolveTemplateData(ADOPT_ME, { variant: variant('NEON', 'Neon') }).data.trait)
      .toBe('Neon')
  })

  it('writes the option VALUE, which is what the sell wizard writes', () => {
    const attrs: TemplateAttributeLike[] = [{
      slug: 'trait', name: 'Trait', type: 'select',
      options: [{ slug: 'fly-ride-fr', value: 'Fly Ride (FR)', label: 'Fly Ride' }],
    }]
    expect(resolveTemplateData(attrs, { variant: variant('FR', 'Fly Ride') }).data.trait)
      .toBe('Fly Ride (FR)')
  })
})

describe('fixed values a game always carries', () => {
  it('fills an attribute from a hint, matched on the attribute name', () => {
    const { data } = resolveTemplateData(ADOPT_ME, {
      variant: variant('FR', 'Fly Ride'),
      hints: { 'item type': 'Pets' },
    })
    expect(data['item-type']).toBe('Pets')
    expect(data.trait).toBe('Fly Ride (FR)')
  })

  it('matches a hint on the attribute slug too', () => {
    const { data } = resolveTemplateData(ADOPT_ME, { variant: null, hints: { 'item-type': 'Pets' } })
    expect(data['item-type']).toBe('Pets')
  })

  it('ignores a hint whose value is not one of the options — never invents a facet', () => {
    const { data } = resolveTemplateData(ADOPT_ME, { variant: null, hints: { 'item type': 'Spaceships' } })
    expect(data['item-type']).toBeUndefined()
  })

  it('ignores a hint for an attribute the template does not have', () => {
    const { data } = resolveTemplateData(ADOPT_ME, { variant: null, hints: { colour: 'Red' } })
    expect(Object.keys(data)).not.toContain('colour')
  })
})

describe('what it refuses to do', () => {
  it('leaves an attribute empty rather than guessing when nothing matches', () => {
    const { data, unfilled } = resolveTemplateData(ADOPT_ME, { variant: variant('XX', 'Nonexistent') })
    expect(data.trait).toBeUndefined()
    expect(unfilled).toContain('Trait')
  })

  it('reports every filterable attribute it could not fill, so the preview can warn', () => {
    const { unfilled } = resolveTemplateData(ADOPT_ME, { variant: null })
    expect(unfilled.sort()).toEqual(['Item Type', 'Trait'])
  })

  it('reports nothing unfilled when everything is filled', () => {
    const { unfilled } = resolveTemplateData(ADOPT_ME, {
      variant: variant('FR', 'Fly Ride'),
      hints: { 'item type': 'Pets' },
    })
    expect(unfilled).toEqual([])
  })

  it('ignores non-filter attribute types — a text box is not a facet', () => {
    const attrs: TemplateAttributeLike[] = [
      { slug: 'notes', name: 'Notes', type: 'text' },
      { slug: 'level', name: 'Level', type: 'number' },
    ]
    const { data, unfilled } = resolveTemplateData(attrs, { variant: variant('FR', 'Fly Ride') })
    expect(data).toEqual({})
    expect(unfilled).toEqual([])
  })

  it('handles an empty template and an attribute with no options', () => {
    expect(resolveTemplateData([], { variant: variant('FR', 'Fly Ride') })).toEqual({ data: {}, unfilled: [] })
    const noOpts: TemplateAttributeLike[] = [{ slug: 'trait', name: 'Trait', type: 'select' }]
    expect(resolveTemplateData(noOpts, { variant: variant('FR', 'Fly Ride') })).toEqual({ data: {}, unfilled: [] })
  })

  it('covers multiselect and image_select, which are filters too', () => {
    for (const type of ['multiselect', 'image_select']) {
      const attrs: TemplateAttributeLike[] = [{ slug: 'trait', name: 'Trait', type, options: [opt('Fly Ride (FR)')] }]
      expect(resolveTemplateData(attrs, { variant: variant('FR', 'Fly Ride') }).data.trait).toBe('Fly Ride (FR)')
    }
  })
})

/**
 * Production's Adopt Me items template, verbatim (read 2026-10-10). The Trait
 * codes do NOT match their labels — "Fly Ride (FR)" stores `r`, "Neon" stores
 * `fr`, "Mega Neon" stores `mfr` — and Pet Name / Egg Name are shown only for
 * their Item Type.
 */
const PROD: TemplateAttributeLike[] = [
  {
    id: 'a-type', slug: 'item-type-2', name: 'Item Type', type: 'select',
    options: [
      { slug: 'pets', value: 'pets', label: 'Pets' },
      { slug: 'eggs', value: 'eggs', label: 'Eggs' },
      { slug: 'vehicles', value: 'vehicles', label: 'Vehicles' },
    ],
  },
  {
    id: 'a-pet', slug: 'pet-name', name: 'Pet Name', type: 'select',
    conditional_rules: [{ trigger_attribute_id: 'a-type', operator: 'equals', trigger_values: ['pets'] }],
    options: [
      { slug: 'frost-dragon', value: 'frost-dragon', label: 'Frost Dragon' },
      { slug: 'bat-dragon', value: 'bat-dragon', label: 'Bat Dragon' },
      { slug: 'strawberry-shortcake-bat-dragon', value: 'strawberry-shortcake-bat-dragon', label: 'Strawberry Shortcake Bat Dragon' },
    ],
  },
  {
    id: 'a-egg', slug: 'egg-name', name: 'Egg Name', type: 'select',
    conditional_rules: [{ trigger_attribute_id: 'a-type', operator: 'equals', trigger_values: ['eggs'] }],
    options: [{ slug: 'jungle-egg', value: 'jungle-egg', label: 'Jungle Egg' }],
  },
  {
    id: 'a-trait', slug: 'trait', name: 'Trait', type: 'select',
    options: [
      { slug: 'n', value: 'n', label: 'Normal' },
      { slug: 'f', value: 'f', label: 'Fly' },
      { slug: 'r', value: 'r', label: 'Fly Ride (FR)' },
      { slug: 'fr', value: 'fr', label: 'Neon' },
      { slug: 'nfr', value: 'nfr', label: 'Neon Fly Ride (NFR)' },
      { slug: 'mfr', value: 'mfr', label: 'Mega Neon' },
      { slug: 'mega-fly-ride', value: 'mega-fly-ride', label: 'Mega Fly Ride (MFR)' },
    ],
  },
]

const HINTS = { 'item type': 'Pets' }
const frost = { ref: 'frost-dragon', name: 'Frost Dragon' }

describe('against the real production template', () => {
  it.each([
    // [ref, label, the value a seller clicking the matching label stores]
    ['N', 'Normal', 'n'],
    ['F', 'Fly', 'f'],
    ['FR', 'Fly Ride', 'r'],
    ['NEON', 'Neon', 'fr'],
    ['NFR', 'Neon Fly Ride', 'nfr'],
    ['MEGA', 'Mega Neon', 'mfr'],
    ['MFR', 'Mega Fly Ride', 'mega-fly-ride'],
  ])('%s is tagged by LABEL, storing %s → %s (what the wizard stores)', (ref, label, value) => {
    const { data } = resolveTemplateData(PROD, { variant: variant(ref, label), item: frost, hints: HINTS })
    expect(data.trait).toBe(value)
  })

  it('never tags Mega Fly Ride as "Mega Neon", whose stored code happens to be mfr', () => {
    const { data } = resolveTemplateData(PROD, { variant: variant('MFR', 'Mega Fly Ride'), item: frost, hints: HINTS })
    expect(data.trait).not.toBe('mfr')
  })

  it('never tags a plain Ride as "Fly Ride", whose stored code happens to be r — it is left empty instead', () => {
    const { data, unfilled } = resolveTemplateData(PROD, { variant: variant('R', 'Ride'), item: frost, hints: HINTS })
    expect(data.trait).toBeUndefined()
    expect(unfilled).toContain('Trait')
  })

  it('fills Pet Name from the item once Item Type is Pets', () => {
    const { data } = resolveTemplateData(PROD, { variant: variant('FR', 'Fly Ride'), item: frost, hints: HINTS })
    expect(data).toEqual({ 'item-type-2': 'pets', 'pet-name': 'frost-dragon', trait: 'r' })
  })

  it('matches a long pet name too', () => {
    const { data } = resolveTemplateData(PROD, {
      variant: variant('NFR', 'Neon Fly Ride'),
      item: { ref: 'strawberry-shortcake-bat-dragon', name: 'Strawberry Shortcake Bat Dragon' },
      hints: HINTS,
    })
    expect(data['pet-name']).toBe('strawberry-shortcake-bat-dragon')
  })

  it('neither fills nor warns about Egg Name for a pet — it is hidden for pets', () => {
    const { data, unfilled } = resolveTemplateData(PROD, { variant: variant('FR', 'Fly Ride'), item: frost, hints: HINTS })
    expect(data['egg-name']).toBeUndefined()
    expect(unfilled).not.toContain('Egg Name')
    expect(unfilled).toEqual([])
  })

  it('warns when the Pet Name list has no option for this pet (Panda, 2026-10-10)', () => {
    const { data, unfilled } = resolveTemplateData(PROD, {
      variant: variant('FR', 'Fly Ride'),
      item: { ref: 'panda', name: 'Panda' },
      hints: HINTS,
    })
    expect(data['pet-name']).toBeUndefined()
    expect(unfilled).toEqual(['Pet Name'])
    // the rest is still filled, so the listing shows under every other filter
    expect(data.trait).toBe('r')
    expect(data['item-type-2']).toBe('pets')
  })

  it('does not fill Pet Name when Item Type is not pets', () => {
    const { data } = resolveTemplateData(PROD, {
      variant: null,
      item: { ref: 'jungle-egg', name: 'Jungle Egg' },
      hints: { 'item type': 'Eggs' },
    })
    expect(data['pet-name']).toBeUndefined()
    expect(data['egg-name']).toBe('jungle-egg')
  })
})
