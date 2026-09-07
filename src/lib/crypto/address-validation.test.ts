import { describe, expect, it } from 'vitest'
import { validatePayoutAddress } from './address-validation'

/**
 * Addresses below are well-known public ones (genesis//burn/foundation
 * addresses and documentation examples). They are used only as valid-format
 * fixtures — nothing is ever sent to them.
 */

describe('validatePayoutAddress — illegal coin/network pairs', () => {
  it('rejects the exact production row that would have burned funds', () => {
    // withdrawal_requests holds: method_name "btc", network "Trc20",
    // wallet_address "$sejsjsjwjh28383". Both faults, one row.
    const result = validatePayoutAddress('btc', 'tron', '$sejsjsjwjh28383')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/can’t be sent over that network/i)
  })

  it('rejects BTC over Ethereum even with a perfectly valid ETH address', () => {
    // The dangerous case: address is well-formed, chain is simply wrong.
    const result = validatePayoutAddress(
      'btc',
      'ethereum',
      '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe',
    )
    expect(result.valid).toBe(false)
  })

  it('rejects an unknown coin', () => {
    expect(validatePayoutAddress('doge', 'bitcoin', '1BvBMSEY').valid).toBe(false)
  })
})

describe('validatePayoutAddress — Bitcoin', () => {
  it('accepts a legacy P2PKH address', () => {
    expect(
      validatePayoutAddress('btc', 'bitcoin', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').valid,
    ).toBe(true)
  })

  it('accepts a P2SH address', () => {
    expect(
      validatePayoutAddress('btc', 'bitcoin', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy').valid,
    ).toBe(true)
  })

  it('accepts a bech32 SegWit address', () => {
    expect(
      validatePayoutAddress('btc', 'bitcoin', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4').valid,
    ).toBe(true)
  })

  it('rejects a bech32 address with a single transposed character', () => {
    // Last char l -> m. This is precisely what a checksum exists to catch.
    expect(
      validatePayoutAddress('btc', 'bitcoin', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5').valid,
    ).toBe(false)
  })

  it('rejects junk', () => {
    expect(validatePayoutAddress('btc', 'bitcoin', '$sejsjsjwjh28383').valid).toBe(false)
  })

  it('rejects an address containing whitespace', () => {
    expect(
      validatePayoutAddress('btc', 'bitcoin', '1A1zP1eP5QGefi2DM PTfTL5SLmv7DivfNa').valid,
    ).toBe(false)
  })
})

describe('validatePayoutAddress — Tron (TRC-20)', () => {
  it('accepts a valid TRON address', () => {
    expect(
      validatePayoutAddress('usdt', 'tron', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t').valid,
    ).toBe(true)
  })

  it('rejects an address not starting with T', () => {
    expect(
      validatePayoutAddress('usdt', 'tron', 'AR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t').valid,
    ).toBe(false)
  })

  it('rejects a TRON address of the wrong length', () => {
    expect(validatePayoutAddress('usdt', 'tron', 'TR7NHqjeKQxGTCi8q8ZY4pL8ot').valid).toBe(false)
  })
})

describe('validatePayoutAddress — EVM chains', () => {
  it('accepts USDT on Ethereum', () => {
    expect(
      validatePayoutAddress('usdt', 'ethereum', '0xdAC17F958D2ee523a2206206994597C13D831ec7')
        .valid,
    ).toBe(true)
  })

  it('accepts USDT on Polygon', () => {
    expect(
      validatePayoutAddress('usdt', 'polygon', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F').valid,
    ).toBe(true)
  })

  it('rejects a too-short hex address', () => {
    expect(validatePayoutAddress('usdt', 'ethereum', '0xdAC17F958D2ee523').valid).toBe(false)
  })

  it('rejects a missing 0x prefix', () => {
    expect(
      validatePayoutAddress('usdt', 'ethereum', 'dAC17F958D2ee523a2206206994597C13D831ec7').valid,
    ).toBe(false)
  })

  it('rejects a TRON address pasted into an Ethereum withdrawal', () => {
    expect(
      validatePayoutAddress('usdt', 'ethereum', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t').valid,
    ).toBe(false)
  })
})

describe('validatePayoutAddress — empty input', () => {
  it('asks for an address rather than failing obscurely', () => {
    const result = validatePayoutAddress('btc', 'bitcoin', '   ')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/enter your wallet address/i)
  })
})
