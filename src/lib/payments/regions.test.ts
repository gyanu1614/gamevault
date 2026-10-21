import { describe, it, expect } from 'vitest'
import { REGIONS, orderMethodsForRegion, regionById, regionForCountry } from './regions'
import { PAYSSION_METHODS, payssionSelectorMethods } from './providers/payssion/methods'

const ids = (ms: Array<{ pmId: string }>) => ms.map((m) => m.pmId)
const rails = payssionSelectorMethods()
/** What a buyer in `cc` sees up front, in order: own-country rails, then the region's. */
const seen = (cc: string) => {
  const { local, regional } = orderMethodsForRegion(rails, regionForCountry(cc), cc)
  return { local: ids(local), regional: ids(regional) }
}

describe('checkout regions: membership', () => {
  it('maps countries to regions; unknown or garbage → Rest of World', () => {
    for (const [cc, id] of [
      ['RO', 'eu'], ['pl', 'eu'], ['GB', 'eu'], ['CH', 'eu'], ['BR', 'latam'], ['MX', 'latam'], ['PE', 'latam'],
      ['PH', 'sea'], ['ID', 'sea'], ['SG', 'sea'], ['MY', 'sea'], ['VN', 'sea'],
      ['SA', 'mea'], ['ZA', 'mea'], ['AE', 'mea'], ['EG', 'mea'], ['NG', 'mea'], ['KE', 'mea'],
      ['KR', 'eastasia'], ['JP', 'eastasia'], ['CN', 'eastasia'], ['TW', 'eastasia'], ['HK', 'eastasia'], ['MO', 'eastasia'], ['MN', 'eastasia'],
      ['US', 'row'], ['AU', 'row'], ['IN', 'row'], ['', 'row'], ['XXL', 'row'], [null, 'row'],
    ] as const) {
      expect(regionForCountry(cc as any), String(cc)).toBe(id)
    }
  })

  it('regions in chip order; Middle East & Africa and East Asia never spill', () => {
    expect(REGIONS.map((r) => r.id)).toEqual(['eu', 'latam', 'sea', 'mea', 'eastasia', 'row'])
    expect(regionById('mea')).toMatchObject({ label: 'Middle East & Africa', spill: false })
    expect(regionById('eastasia')).toMatchObject({ label: 'East Asia', spill: false })
    expect(regionById('eu').spill && regionById('latam').spill && regionById('sea').spill).toBe(true)
  })

  it('no country sits in two regions', () => {
    const seenIn = new Map<string, string>()
    for (const r of REGIONS) for (const c of r.countries) {
      expect(seenIn.get(c), `${c} in ${seenIn.get(c)} and ${r.id}`).toBeUndefined()
      seenIn.set(c, r.id)
    }
  })

  it('every single-country rail sits in a named region (none is stranded in Rest of World)', () => {
    for (const m of rails.filter((x) => x.countries.length === 1)) {
      expect(regionForCountry(m.countries[0]), `${m.pmId}`).not.toBe('row')
    }
  })
})

describe('checkout regions: ordering (own-country rails; the region only when the country has none; crypto is the caller\'s last row)', () => {
  it('Romania: Trustly, Skrill, paysafecard (all list RO); no other EU country\'s rails', () => {
    expect(seen('RO')).toEqual({ local: ['trustly', 'skrill', 'paysafecard'], regional: [] })
  })

  it('Poland: Trustly, BLIK, P24, Skrill, paysafecard; nothing from another country', () => {
    expect(seen('PL')).toEqual({ local: ['trustly', 'blik_pl', 'p24_pl', 'skrill', 'paysafecard'], regional: [] })
  })

  it('GB and DE see Skrill', () => {
    expect(seen('GB').local).toEqual(['trustly', 'skrill', 'paysafecard'])
    expect(seen('DE').local).toEqual(['trustly', 'skrill', 'paysafecard'])
  })

  it('Belgium: Bancontact + the methods Belgians use, not the whole EU list', () => {
    expect(seen('BE')).toEqual({ local: ['trustly', 'bancontact_be', 'mybank', 'skrill', 'paysafecard'], regional: [] })
  })

  it('Switzerland: TWINT; Italy: BANCOMAT Pay, Satispay, MyBank', () => {
    expect(seen('CH').local).toEqual(['twint_ch', 'skrill', 'paysafecard'])
    expect(seen('IT').local).toEqual(['trustly', 'bancomatpay_it', 'satispay', 'mybank', 'skrill', 'paysafecard'])
  })

  it('Southeast Asia: each country sees only its own rails (Skrill is Europe-only)', () => {
    expect(seen('PH')).toEqual({ local: ['gcash_ph', 'maya_ph', 'qr_ph'], regional: [] })
    expect(seen('SG').local).toEqual(['paynow_sg', 'grabpay_sg'])
    expect(seen('MY').local).toEqual(['fpx_my', 'touchngo_my'])
    expect(seen('VN')).toEqual({ local: ['vietqr_vn'], regional: [] })
  })

  it('Latin America: Brazil, Mexico and Peru see only their own rails', () => {
    expect(seen('BR')).toEqual({ local: ['pix_br', 'creditcard_br', 'boleto_br'], regional: [] })
    expect(seen('MX').local).toEqual(['oxxo_mx', 'spei_mx', 'creditcard_mx'])
    expect(seen('PE').local).toEqual(['bcp_pe'])
  })

  it('a country with no rails of its own falls back to its region\'s list (Argentina, Thailand, Ukraine)', () => {
    expect(seen('AR')).toEqual({
      local: [],
      regional: ['pix_br', 'creditcard_br', 'oxxo_mx', 'spei_mx', 'creditcard_mx', 'boleto_br', 'pse_co', 'webpay_cl', 'bcp_pe'],
    })
    expect(seen('TH').local).toEqual([])
    expect(seen('TH').regional).toEqual(['gcash_ph', 'maya_ph', 'qr_ph', 'qris_id', 'fpx_my', 'touchngo_my', 'paynow_sg', 'grabpay_sg', 'vietqr_vn'])
    expect(seen('UA').local).toEqual([])
    expect(seen('UA').regional).toContain('bancontact_be')
  })

  it('Saudi Arabia: mada then Apple Pay (Saudi Arabia) only; South Africa: its cards; no MEA spill', () => {
    expect(seen('SA')).toEqual({ local: ['mada_sa', 'applepay_sa'], regional: [] })
    expect(seen('ZA')).toEqual({ local: ['creditcard_za'], regional: [] })
    expect(seen('AE')).toEqual({ local: [], regional: [] })
  })

  it('South Korea: Kakao Pay; Japan: nothing (crypto)', () => {
    expect(seen('KR')).toEqual({ local: ['kakaopay_kr'], regional: [] })
    expect(seen('JP')).toEqual({ local: [], regional: [] })
  })

  it('Rest of World never spills: the US sees nothing local, Australia sees paysafecard only', () => {
    expect(seen('US')).toEqual({ local: [], regional: [] })
    expect(seen('AU')).toEqual({ local: ['paysafecard'], regional: [] })
  })

  it('a hand-picked region outside the buyer\'s country has no local rails; the whole region is listed', () => {
    const { local, regional } = orderMethodsForRegion(rails, 'latam', 'RO')
    expect(local).toEqual([])
    expect(ids(regional)).toEqual(['pix_br', 'creditcard_br', 'oxxo_mx', 'spei_mx', 'creditcard_mx', 'boleto_br', 'pse_co', 'webpay_cl', 'bcp_pe'])
  })

  it('a hand-picked no-spill region shows nothing to a buyer outside it', () => {
    expect(orderMethodsForRegion(rails, 'mea', 'GB')).toEqual({ local: [], regional: [] })
    expect(orderMethodsForRegion(rails, 'eastasia', 'GB')).toEqual({ local: [], regional: [] })
  })

  it('unknown geo: Rest of World, nothing local (the caller shows crypto first and the switcher)', () => {
    expect(orderMethodsForRegion(rails, 'row', null)).toEqual({ local: [], regional: [] })
  })
})

