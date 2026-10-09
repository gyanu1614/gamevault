import { describe, expect, it } from 'vitest'
import {
  activeDeliveryMethods,
  checkDeliveryMethod,
  deliveryMethodLabel,
  filterByDeliveryMethod,
  findDeliveryMethod,
  methodsInUse,
  resolveDeliveryMethodId,
} from './delivery-methods'

const config = {
  delivery_methods: {
    enabled: true,
    options: [
      { id: 'gamepass', label: 'Gamepass', description: 'Buyer buys your Gamepass.' },
      { id: 'login', label: 'UID / Login', description: '' },
      { id: 'blank', label: '   ', description: 'no label → ignored' },
    ],
  },
}

describe('activeDeliveryMethods', () => {
  it('lists the labelled methods when the admin has switched the field on', () => {
    expect(activeDeliveryMethods(config).map((m) => m.id)).toEqual(['gamepass', 'login'])
  })

  it('is empty when the field is off, missing or malformed', () => {
    expect(activeDeliveryMethods({ delivery_methods: { ...config.delivery_methods, enabled: false } })).toEqual([])
    expect(activeDeliveryMethods({})).toEqual([])
    expect(activeDeliveryMethods(null)).toEqual([])
    expect(activeDeliveryMethods({ delivery_methods: { enabled: true, options: 'x' } })).toEqual([])
  })
})

describe('deliveryMethodLabel', () => {
  it('names a stored id, or null when the admin removed it', () => {
    const methods = activeDeliveryMethods(config)
    expect(deliveryMethodLabel(methods, 'login')).toBe('UID / Login')
    expect(deliveryMethodLabel(methods, 'gone')).toBeNull()
    expect(deliveryMethodLabel(methods, null)).toBeNull()
  })
})

describe('checkDeliveryMethod (server side, per listing)', () => {
  it('accepts an active method and stores its id', () => {
    expect(checkDeliveryMethod(config, 'gamepass')).toEqual({ ok: true, value: 'gamepass' })
  })

  it('rejects an id the admin does not offer', () => {
    expect(checkDeliveryMethod(config, 'trade')).toEqual({ ok: false, error: 'Pick a delivery method from the list.' })
  })

  it('stores nothing when the field is off, whatever was sent', () => {
    expect(checkDeliveryMethod({}, 'gamepass')).toEqual({ ok: true, value: null })
  })

  it('allows an empty pick (bulk upload, older clients)', () => {
    expect(checkDeliveryMethod(config, null)).toEqual({ ok: true, value: null })
    expect(checkDeliveryMethod(config, '')).toEqual({ ok: true, value: null })
  })
})

describe('filterByDeliveryMethod (buyer page)', () => {
  const offers = [
    { id: 'a', deliveryMethodId: 'gamepass' },
    { id: 'b', deliveryMethodId: 'login' },
    { id: 'c', deliveryMethodId: null },
  ]
  it('keeps every offer with no filter', () => {
    expect(filterByDeliveryMethod(offers, null)).toHaveLength(3)
  })
  it('keeps only that method (an offer with no method does not match)', () => {
    expect(filterByDeliveryMethod(offers, 'gamepass').map((o) => o.id)).toEqual(['a'])
  })
})

describe('methodsInUse (which filter chips to show)', () => {
  it('keeps only methods some live offer uses, in the admin order', () => {
    const methods = activeDeliveryMethods(config)
    expect(methodsInUse(methods, [{ deliveryMethodId: 'login' }, { deliveryMethodId: null }, {}]).map((m) => m.id)).toEqual(['login'])
    expect(methodsInUse(methods, [])).toEqual([])
  })
})

describe('findDeliveryMethod (checkout + order pages)', () => {
  it("finds a listing's method by id", () => {
    expect(findDeliveryMethod(config, 'gamepass')).toEqual({ id: 'gamepass', label: 'Gamepass', description: 'Buyer buys your Gamepass.' })
  })

  it('still names it after the admin switched the field off (orders keep their method)', () => {
    expect(findDeliveryMethod({ delivery_methods: { ...config.delivery_methods, enabled: false } }, 'login')?.label).toBe('UID / Login')
  })

  it('is null for no id, an unknown id or no config', () => {
    expect(findDeliveryMethod(config, null)).toBeNull()
    expect(findDeliveryMethod(config, 'gone')).toBeNull()
    expect(findDeliveryMethod(null, 'gamepass')).toBeNull()
  })
})

describe('resolveDeliveryMethodId (bulk CSV: sellers type the name)', () => {
  it('matches a method by its name, any case, or by id', () => {
    expect(resolveDeliveryMethodId(config, ' gamepass ')).toBe('gamepass')
    expect(resolveDeliveryMethodId(config, 'uid / login')).toBe('login')
    expect(resolveDeliveryMethodId(config, 'login')).toBe('login')
  })

  it('passes an unknown value through so the validator names the error', () => {
    expect(resolveDeliveryMethodId(config, 'Trade')).toBe('Trade')
  })

  it('is null for an empty cell', () => {
    expect(resolveDeliveryMethodId(config, '')).toBeNull()
    expect(resolveDeliveryMethodId(config, null)).toBeNull()
  })
})
