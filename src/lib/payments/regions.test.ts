import { describe, it, expect } from 'vitest'
import { REGIONS, orderMethodsForRegion, regionById, regionForCountry, regionsWithMethods } from './regions'
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

describe('checkout regions: ordering (country rails → region rails; crypto is the caller\'s last row)', () => {
  it('Romania: Trustly local first, Skrill + paysafecard after it; the rest of Europe regional, registry order kept', () => {
    expect(seen('RO')).toEqual({
      local: ['trustly', 'skrill', 'paysafecard'],
      regional: ['blik_pl', 'p24_pl', 'bancontact_be', 'eps_at', 'mbway_pt', 'bancomatpay_it', 'satispay', 'mybank', 'payu_cz', 'twint_ch'],
    })
  })

  it('Poland: BLIK, P24, Trustly local; no LATAM, SEA, MEA or East Asia rail leaks in', () => {
    const { local, regional } = seen('PL')
    expect(local).toEqual(['trustly', 'blik_pl', 'p24_pl', 'skrill', 'paysafecard'])
    for (const pm of [...local, ...regional]) {
      expect(PAYSSION_METHODS[pm].countries.some((c) => regionForCountry(c) === 'eu'), pm).toBe(true)
    }
  })

  it('GB and DE see Skrill', () => {
    expect(seen('GB').local).toEqual(['trustly', 'skrill', 'paysafecard'])
    expect(seen('DE').local).toEqual(['trustly', 'skrill', 'paysafecard'])
  })

  it('Belgium: Bancontact; Switzerland: TWINT; Italy: BANCOMAT Pay, Satispay, MyBank', () => {
    expect(seen('BE').local).toEqual(['trustly', 'bancontact_be', 'mybank', 'skrill', 'paysafecard'])
    expect(seen('CH').local).toEqual(['twint_ch', 'skrill', 'paysafecard'])
    expect(seen('IT').local).toEqual(['trustly', 'bancomatpay_it', 'satispay', 'mybank', 'skrill', 'paysafecard'])
  })

  it('Philippines: GCash / Maya / QR Ph local, the rest of Southeast Asia regional', () => {
    expect(seen('PH')).toEqual({
      local: ['gcash_ph', 'maya_ph', 'qr_ph', 'skrill'],
      regional: ['qris_id', 'fpx_my', 'touchngo_my', 'paynow_sg', 'grabpay_sg', 'vietqr_vn'],
    })
  })

  it('Singapore, Malaysia, Vietnam: their own rails first', () => {
    expect(seen('SG').local).toEqual(['paynow_sg', 'grabpay_sg', 'skrill'])
    expect(seen('MY').local).toEqual(['fpx_my', 'touchngo_my', 'skrill'])
    expect(seen('VN').local).toEqual(['vietqr_vn', 'skrill'])
  })

  it('Brazil: Pix, Brazilian Cards, Boleto local; Mexico / Colombia / Chile / Peru rails regional', () => {
    expect(seen('BR')).toEqual({
      local: ['pix_br', 'creditcard_br', 'boleto_br', 'skrill'],
      regional: ['oxxo_mx', 'spei_mx', 'creditcard_mx', 'pse_co', 'webpay_cl', 'bcp_pe'],
    })
  })

  it('Mexico: OXXO, SPEI, Mexican Cards; Peru: BCP', () => {
    expect(seen('MX').local).toEqual(['oxxo_mx', 'spei_mx', 'creditcard_mx', 'skrill'])
    expect(seen('PE').local).toEqual(['bcp_pe', 'skrill'])
  })

  it('Saudi Arabia: mada, Apple Pay (Saudi Arabia), then Skrill; nothing from other MEA countries spills in', () => {
    expect(seen('SA')).toEqual({ local: ['mada_sa', 'applepay_sa', 'skrill'], regional: [] })
    expect(seen('ZA')).toEqual({ local: ['creditcard_za', 'skrill'], regional: [] })
    // A MEA buyer whose country has no local rail sees nothing local (crypto first).
    expect(seen('AE').regional).toEqual([])
    expect(seen('AE').local).not.toContain('mada_sa')
  })

  it('South Korea: KakaoPay then Skrill; Japan gets no Korean rail', () => {
    expect(seen('KR')).toEqual({ local: ['kakaopay_kr', 'skrill'], regional: [] })
    expect(seen('JP').local).not.toContain('kakaopay_kr')
    expect(seen('JP').regional).toEqual([])
  })

  it('Rest of World never spills: Australia sees paysafecard (+ Skrill where Skrill works), no regional rails', () => {
    expect(seen('AU').regional).toEqual([])
    expect(seen('AU').local).toContain('paysafecard')
  })

  it('a hand-picked region outside the buyer\'s country has no local rails; the whole region is regional', () => {
    const { local, regional } = orderMethodsForRegion(rails, 'latam', 'RO')
    expect(local).toEqual([])
    expect(ids(regional)).toEqual(['pix_br', 'creditcard_br', 'oxxo_mx', 'spei_mx', 'creditcard_mx', 'boleto_br', 'pse_co', 'webpay_cl', 'bcp_pe', 'skrill'])
  })

  it('a hand-picked no-spill region shows nothing to a buyer outside it', () => {
    expect(orderMethodsForRegion(rails, 'mea', 'GB')).toEqual({ local: [], regional: [] })
    expect(orderMethodsForRegion(rails, 'eastasia', 'GB')).toEqual({ local: [], regional: [] })
  })

  it('unknown geo: Rest of World, nothing local (the caller shows crypto first and the switcher)', () => {
    expect(orderMethodsForRegion(rails, 'row', null)).toEqual({ local: [], regional: [] })
  })
})

describe('checkout regions: switcher chips', () => {
  it('spill regions with a rail always show; no-spill regions (and Rest of World) only for their own buyers', () => {
    expect(regionsWithMethods(rails, 'eu').map((r) => r.id)).toEqual(['eu', 'latam', 'sea'])
    expect(regionsWithMethods(rails, 'row').map((r) => r.id)).toEqual(['eu', 'latam', 'sea', 'row'])
    expect(regionsWithMethods(rails, 'mea').map((r) => r.id)).toEqual(['eu', 'latam', 'sea', 'mea'])
    expect(regionsWithMethods(rails, 'eastasia').map((r) => r.id)).toEqual(['eu', 'latam', 'sea', 'eastasia'])
  })
})
