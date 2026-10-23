/**
 * Buyer copy names only methods the checkout really offers (PSP site
 * review, 2026-10-23: listing FAQs promised PayPal, Google Pay and "all
 * major cards", none of which checkout has).
 */
import { describe, it, expect } from 'vitest'

import { acceptedMethodsPhrase, NAMED_LOCAL_METHODS } from './accepted-methods'
import { PAYSSION_METHODS } from './providers/payssion/methods'

describe('acceptedMethodsPhrase', () => {
  it('names the well-known local rails, Apple Pay by country, and the checkout coins', () => {
    expect(acceptedMethodsPhrase()).toBe(
      'local payment methods such as Pix, Trustly, BLIK and BANCOMAT Pay, Apple Pay in some countries, and crypto (USDT and Bitcoin).',
    )
  })

  it('every named rail is a real checkout method', () => {
    for (const pm of NAMED_LOCAL_METHODS) expect(PAYSSION_METHODS[pm], pm).toBeTruthy()
    expect(PAYSSION_METHODS.applepay_sa).toBeTruthy()
  })

  it('never promises a method checkout does not have', () => {
    expect(acceptedMethodsPhrase()).not.toMatch(/paypal|google pay|all major|visa|mastercard/i)
  })
})
