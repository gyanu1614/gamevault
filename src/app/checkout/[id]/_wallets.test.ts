import { describe, it, expect } from 'vitest'

import { detectWallets } from './_wallets'

const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

describe('detectWallets', () => {
  it('Apple Pay where the browser can pay with it', () => {
    expect(detectWallets({ ApplePaySession: { canMakePayments: () => true } }, MAC_CHROME)).toEqual({ applePay: true, googlePay: false })
  })
  it('iPhones get Apple Pay even without ApplePaySession (plain-http preview)', () => {
    expect(detectWallets({}, IPHONE)).toEqual({ applePay: true, googlePay: false })
  })
  it('everyone else gets Google Pay', () => {
    expect(detectWallets({}, ANDROID)).toEqual({ applePay: false, googlePay: true })
    expect(detectWallets({}, MAC_CHROME)).toEqual({ applePay: false, googlePay: true })
    expect(detectWallets({ ApplePaySession: { canMakePayments: () => { throw new Error('insecure') } } }, MAC_CHROME)).toEqual({ applePay: false, googlePay: true })
  })
})
