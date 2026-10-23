import { describe, it, expect } from 'vitest'
import {
  BELOW_PROVIDER_MINIMUM_MESSAGE,
  METHOD_REFUSED_MESSAGE,
  PROVIDER_UNAVAILABLE_MESSAGE,
  chargeFailureMessage,
} from './checkout-errors'

describe('chargeFailureMessage — what the buyer reads when a charge cannot be created', () => {
  it('Payssion 417: under the method minimum', () => {
    expect(chargeFailureMessage(new Error('payssion: create failed (result_code 417)'))).toBe(BELOW_PROVIDER_MINIMUM_MESSAGE)
  })

  it('Payssion refuses the method (491 not enabled, 492 undocumented): pick another, never "try again shortly"', () => {
    for (const code of ['491', '492', '405', '418']) {
      expect(chargeFailureMessage(new Error(`payssion: create failed (result_code ${code})`)), code).toBe(METHOD_REFUSED_MESSAGE)
    }
    expect(METHOD_REFUSED_MESSAGE).toMatch(/pick another payment method/i)
  })

  it('network, 5xx or anything unknown: the service is down for now', () => {
    expect(chargeFailureMessage(new Error('payssion: create failed (result_code 500)'))).toBe(PROVIDER_UNAVAILABLE_MESSAGE)
    expect(chargeFailureMessage(new Error('fetch failed'))).toBe(PROVIDER_UNAVAILABLE_MESSAGE)
    expect(chargeFailureMessage(undefined)).toBe(PROVIDER_UNAVAILABLE_MESSAGE)
  })
})
