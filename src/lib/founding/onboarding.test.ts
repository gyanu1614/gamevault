import { describe, it, expect } from 'vitest'
import {
  detailsSchema, storeNameSchema, typedNameSchema, parsePngDataUrl, deriveStage, agreementCanonicalText, completionRefusalMessage,
} from './onboarding'

const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
function pngDataUrl(bytes: number) {
  const body = Buffer.concat([PNG_HEAD, Buffer.alloc(Math.max(0, bytes - PNG_HEAD.length), 7)])
  return `data:image/png;base64,${body.toString('base64')}`
}

describe('detailsSchema', () => {
  const ok = { country: 'gb', sells: [{ game: 'adopt-me', categories: ['items'] }], isAdult: true as const }
  it('accepts a valid set and normalises the country code', () => {
    const r = detailsSchema.safeParse(ok)
    expect(r.success).toBe(true)
    if (r.success) { expect(r.data.country).toBe('GB'); expect(r.data.discord).toBe('') }
  })
  it('refuses an unknown country, an empty sells list, an unknown category, and a minor', () => {
    expect(detailsSchema.safeParse({ ...ok, country: 'ZZ' }).success).toBe(false)
    expect(detailsSchema.safeParse({ ...ok, sells: [] }).success).toBe(false)
    expect(detailsSchema.safeParse({ ...ok, sells: [{ game: 'adopt-me', categories: ['weapons'] }] }).success).toBe(false)
    expect(detailsSchema.safeParse({ ...ok, isAdult: false }).success).toBe(false)
  })
  it('discord: strips a leading @, accepts new and legacy handles, refuses junk', () => {
    expect(detailsSchema.parse({ ...ok, discord: '@gyan.trades' }).discord).toBe('gyan.trades')
    expect(detailsSchema.parse({ ...ok, discord: 'Gyan#1234' }).discord).toBe('Gyan#1234')
    expect(detailsSchema.safeParse({ ...ok, discord: 'has spaces here' }).success).toBe(false)
    expect(detailsSchema.safeParse({ ...ok, discord: '<script>' }).success).toBe(false)
  })
})

describe('storeNameSchema / typedNameSchema', () => {
  it('store names: 3–50, friendly characters only', () => {
    expect(storeNameSchema.safeParse("Gyan's Pets & More").success).toBe(true)
    expect(storeNameSchema.safeParse('ab').success).toBe(false)
    expect(storeNameSchema.safeParse('<b>Shop</b>').success).toBe(false)
    expect(storeNameSchema.safeParse('---').success).toBe(false)
    expect(storeNameSchema.safeParse('x'.repeat(51)).success).toBe(false)
  })
  it('typed names: letters, spaces, apostrophes, hyphens', () => {
    expect(typedNameSchema.safeParse("Gyanendra O'Pandey-Smith").success).toBe(true)
    expect(typedNameSchema.safeParse('G').success).toBe(false)
    expect(typedNameSchema.safeParse('Name 123').success).toBe(false)
  })
})

describe('parsePngDataUrl', () => {
  it('accepts a PNG under the cap', () => {
    const r = parsePngDataUrl(pngDataUrl(4000))
    expect(r.ok).toBe(true)
  })
  it('refuses non-PNG, SVG, oversize and tiny payloads', () => {
    expect(parsePngDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=').ok).toBe(false)
    expect(parsePngDataUrl(`data:image/png;base64,${Buffer.from('GIF89a', 'utf8').toString('base64')}`).ok).toBe(false)
    expect(parsePngDataUrl(pngDataUrl(300 * 1024)).ok).toBe(false)
    expect(parsePngDataUrl(pngDataUrl(20)).ok).toBe(false)
    expect(parsePngDataUrl(42).ok).toBe(false)
  })
})

describe('deriveStage', () => {
  const base = { signedIn: true, isSeller: false, details: true, store: true, agreement: false }
  it('walks 1 → 2 → 3 → 4 → 5', () => {
    expect(deriveStage({ ...base, signedIn: false })).toBe(1)
    expect(deriveStage({ ...base, details: false })).toBe(2)
    expect(deriveStage({ ...base, store: false })).toBe(3)
    expect(deriveStage(base)).toBe(4)
    expect(deriveStage({ ...base, isSeller: true })).toBe(5)
  })
})

describe('agreementCanonicalText', () => {
  const doc = {
    slug: 'seller-agreement', title: 'Seller Agency Agreement', version: undefined,
    sections: [{ h: '1. Appointment', blocks: [{ t: 'p' as const, md: 'The Seller appoints…' }, { t: 'ul' as const, items: ['a', 'b'] }] }],
  }
  it('is deterministic, carries the version, and changes when the text changes', () => {
    const a = agreementCanonicalText(doc, 'v1.0')
    expect(a).toBe(agreementCanonicalText(doc, 'v1.0'))
    expect(a).toContain('version:v1.0')
    expect(agreementCanonicalText({ ...doc, version: 'v2.0' }, 'v1.0')).toContain('version:v2.0')
    const edited = { ...doc, sections: [{ h: '1. Appointment', blocks: [{ t: 'p' as const, md: 'The Seller appoints… (edited)' }] }] }
    expect(agreementCanonicalText(edited, 'v1.0')).not.toBe(a)
  })
})

describe('completionRefusalMessage', () => {
  it('maps every RPC reason to a sentence and has a default', () => {
    for (const r of ['details_incomplete', 'store_incomplete', 'store_name_taken', 'agreement_missing', 'staff_account', 'no_profile']) {
      expect(completionRefusalMessage(r)).not.toMatch(/went wrong/)
    }
    expect(completionRefusalMessage('???')).toMatch(/went wrong/)
  })
})
