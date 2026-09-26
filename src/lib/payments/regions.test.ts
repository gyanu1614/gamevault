import { describe, it, expect } from 'vitest'
import { REGIONS, orderMethodsForRegion, regionForCountry, regionsWithMethods } from './regions'
import { PAYSSION_METHODS, payssionSelectorMethods } from './providers/payssion/methods'

const ids = (ms: Array<{ pmId: string }>) => ms.map((m) => m.pmId)
const rails = payssionSelectorMethods()

describe('checkout regions: membership', () => {
  it('maps countries to regions; unknown or garbage → Rest of World', () => {
    for (const [cc, id] of [['RO', 'eu'], ['pl', 'eu'], ['GB', 'eu'], ['BR', 'latam'], ['MX', 'latam'], ['PH', 'sea'], ['ID', 'sea'], ['US', 'row'], ['AU', 'row'], ['', 'row'], ['XXL', 'row'], [null, 'row']] as const) {
      expect(regionForCountry(cc as any), String(cc)).toBe(id)
    }
  })

  it('every country in the registry belongs to a region with spill, except paysafecard\'s non-European markets', () => {
    for (const m of rails) {
      for (const c of m.countries) {
        const region = regionForCountry(c)
        if (region === 'row') expect(m.pmId, `${m.pmId}: ${c} is Rest of World`).toBe('paysafecard')
      }
    }
    expect(REGIONS.map((r) => r.id)).toEqual(['eu', 'latam', 'sea', 'row'])
  })
})

describe('checkout regions: ordering (country rails → region rails; crypto is the caller\'s last row)', () => {
  it('Romania: Trustly + paysafecard local (both list RO), the rest of Europe regional, registry order kept', () => {
    const { local, regional } = orderMethodsForRegion(rails, 'eu', 'RO')
    expect(ids(local)).toEqual(['trustly', 'paysafecard'])
    expect(ids(regional)).toEqual(['blik_pl', 'p24_pl', 'eps_at', 'mbway_pt', 'bancomatpay_it', 'payu_cz'])
  })

  it('Poland: BLIK, P24, Trustly and paysafecard are local; no LATAM or SEA rail leaks in', () => {
    const { local, regional } = orderMethodsForRegion(rails, 'eu', 'PL')
    expect(ids(local)).toEqual(['trustly', 'blik_pl', 'p24_pl', 'paysafecard'])
    expect(ids(regional)).toEqual(['eps_at', 'mbway_pt', 'bancomatpay_it', 'payu_cz'])
    for (const pm of [...ids(local), ...ids(regional)]) expect(PAYSSION_METHODS[pm].countries.some((c) => regionForCountry(c) === 'eu')).toBe(true)
  })

  it('Philippines: GCash / Maya / QR Ph local, QRIS regional (Southeast Asia spills)', () => {
    const { local, regional } = orderMethodsForRegion(rails, 'sea', 'PH')
    expect(ids(local)).toEqual(['gcash_ph', 'maya_ph', 'qr_ph'])
    expect(ids(regional)).toEqual(['qris_id'])
  })

  it('Brazil: Pix + Boleto local; Mexico / Colombia / Chile rails regional', () => {
    const { local, regional } = orderMethodsForRegion(rails, 'latam', 'BR')
    expect(ids(local)).toEqual(['pix_br', 'boleto_br'])
    expect(ids(regional)).toEqual(['oxxo_mx', 'spei_mx', 'pse_co', 'webpay_cl'])
  })

  it('Rest of World never spills: the US sees nothing local, Australia sees paysafecard only', () => {
    expect(orderMethodsForRegion(rails, 'row', 'US')).toEqual({ local: [], regional: [] })
    const au = orderMethodsForRegion(rails, 'row', 'AU')
    expect(ids(au.local)).toEqual(['paysafecard'])
    expect(au.regional).toEqual([])
  })

  it('a hand-picked region outside the buyer\'s country has no local rails; the whole region is regional', () => {
    const { local, regional } = orderMethodsForRegion(rails, 'latam', 'RO')
    expect(local).toEqual([])
    expect(ids(regional)).toEqual(['pix_br', 'oxxo_mx', 'spei_mx', 'boleto_br', 'pse_co', 'webpay_cl'])
  })

  it('unknown geo: Rest of World, nothing local (the caller shows crypto first and the switcher)', () => {
    expect(orderMethodsForRegion(rails, 'row', null)).toEqual({ local: [], regional: [] })
  })

  it('switcher chips: every region with a rail, plus the current one (Rest of World shows only when current)', () => {
    expect(regionsWithMethods(rails, 'eu').map((r) => r.id)).toEqual(['eu', 'latam', 'sea'])
    expect(regionsWithMethods(rails, 'row').map((r) => r.id)).toEqual(['eu', 'latam', 'sea', 'row'])
  })
})
