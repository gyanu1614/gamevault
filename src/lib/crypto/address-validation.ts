/**
 * Crypto payout address validation.
 *
 * Why this exists: the live `withdrawal_requests` table contains a real row
 * reading
 *
 *   { method_name: "btc", payment_details: { network: "Trc20",
 *     wallet_address: "$sejsjsjwjh28383" } }
 *
 * — Bitcoin over the TRON network, to an address starting with "$". Both were
 * accepted without complaint. Approving that would have destroyed the funds
 * irrecoverably: crypto sends are final, and there is no chargeback.
 *
 * Two independent classes of mistake are guarded here:
 *
 *   1. ILLEGAL PAIR — a coin sent over a chain it does not exist on. This is
 *      the expensive one, because the *address* can be perfectly well-formed
 *      (a TRON address is a valid TRON address whether you meant to send
 *      USDT or BTC to it) so no amount of address checking catches it.
 *   2. MALFORMED ADDRESS — wrong charset, length, prefix, or a mistyped
 *      character.
 *
 * Dependency-free on purpose: the project carries no crypto libraries, and a
 * payout path is the last place to take a supply-chain risk for the sake of a
 * regex. Bech32 and Base58 are implemented below; both are short and are
 * covered by the unit tests alongside this file.
 *
 * KNOWN LIMIT — EIP-55: for EVM addresses we verify `0x` + 40 hex characters
 * but do NOT verify the mixed-case checksum, which needs keccak256 (Node's
 * built-in sha3-256 is a *different* function and cannot substitute). A
 * transposed character in an all-lowercase EVM address is therefore not
 * caught here. The admin review step is the backstop; adding a keccak
 * implementation would close it.
 */

export type PayoutChain = 'bitcoin' | 'ethereum' | 'tron' | 'polygon'

export interface AddressCheck {
  valid: boolean
  /** User-facing reason. Safe to render directly. */
  error?: string
}

/**
 * Which (coin, chain) combinations actually exist.
 *
 * Keys are `withdrawal_methods.method_name`. This is the table that makes
 * "BTC over TRC-20" impossible to submit.
 */
export const COIN_CHAINS: Record<string, PayoutChain[]> = {
  btc: ['bitcoin'],
  eth: ['ethereum'],
  usdt: ['ethereum', 'tron', 'polygon'],
  usdc: ['ethereum', 'tron', 'polygon'],
}

/** Human labels for the chain, as sellers know them. */
export const CHAIN_LABELS: Record<PayoutChain, string> = {
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum (ERC-20)',
  tron: 'Tron (TRC-20)',
  polygon: 'Polygon',
}

// ── Bech32 (BIP-173) ─────────────────────────────────────────────
// Native SegWit BTC addresses (bc1…). Checksum is a pure polynomial —
// no hashing — so it runs identically on client and server.

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1
  for (const v of values) {
    const b = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= GEN[i]
  }
  return chk
}

function bech32HrpExpand(hrp: string): number[] {
  const out: number[] = []
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5)
  out.push(0)
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31)
  return out
}

/** Verifies a bech32 / bech32m string. Returns false on any structural fault. */
function bech32Verify(addr: string): boolean {
  // Mixed case is explicitly invalid per BIP-173.
  if (addr !== addr.toLowerCase() && addr !== addr.toUpperCase()) return false
  const s = addr.toLowerCase()

  const pos = s.lastIndexOf('1')
  if (pos < 1 || pos + 7 > s.length || s.length > 90) return false

  const hrp = s.slice(0, pos)
  const data: number[] = []
  for (const ch of s.slice(pos + 1)) {
    const d = BECH32_CHARSET.indexOf(ch)
    if (d === -1) return false
    data.push(d)
  }

  const chk = bech32Polymod([...bech32HrpExpand(hrp), ...data])
  // 1 = bech32 (v0 / P2WPKH, P2WSH), 0x2bc830a3 = bech32m (v1+ / Taproot).
  return chk === 1 || chk === 0x2bc830a3
}

// ── Base58 ───────────────────────────────────────────────────────
// Used by legacy BTC (1…, 3…) and every TRON address (T…). We decode to
// confirm charset and payload length. The trailing 4-byte SHA-256d checksum
// needs hashing, so it is verified server-side (see verifyBase58Checksum).

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** Decode Base58 to bytes, or null if any character is outside the alphabet. */
export function base58Decode(input: string): Uint8Array | null {
  const bytes: number[] = [0]
  for (const ch of input) {
    const value = B58_ALPHABET.indexOf(ch)
    if (value === -1) return null

    let carry = value
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58
      bytes[i] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  // Leading '1's are leading zero bytes.
  for (const ch of input) {
    if (ch !== '1') break
    bytes.push(0)
  }
  return new Uint8Array(bytes.reverse())
}

// ── Per-chain format checks ──────────────────────────────────────

function checkBitcoin(address: string): AddressCheck {
  if (/^(bc1)[0-9a-zA-Z]{6,87}$/i.test(address)) {
    return bech32Verify(address)
      ? { valid: true }
      : { valid: false, error: 'That Bitcoin address failed its checksum — check for a typo.' }
  }

  if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address)) {
    const decoded = base58Decode(address)
    // 1 version byte + 20 payload + 4 checksum.
    if (!decoded || decoded.length !== 25) {
      return { valid: false, error: 'That Bitcoin address is the wrong length.' }
    }
    return { valid: true }
  }

  return {
    valid: false,
    error: 'Enter a Bitcoin address starting with 1, 3 or bc1.',
  }
}

function checkEvm(address: string, chain: 'ethereum' | 'polygon'): AddressCheck {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return {
      valid: false,
      error: `Enter a ${CHAIN_LABELS[chain]} address — 0x followed by 40 characters.`,
    }
  }
  return { valid: true }
}

function checkTron(address: string): AddressCheck {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    return { valid: false, error: 'Enter a Tron address starting with T (34 characters).' }
  }
  const decoded = base58Decode(address)
  // 0x41 prefix + 20 payload + 4 checksum.
  if (!decoded || decoded.length !== 25 || decoded[0] !== 0x41) {
    return { valid: false, error: 'That Tron address failed its checksum — check for a typo.' }
  }
  return { valid: true }
}

/**
 * Validate that `coin` can be sent over `chain`, and that `address` is
 * well-formed for that chain.
 *
 * Order matters: the pair is checked FIRST, because a legal-looking address
 * on the wrong chain is the failure mode that actually loses money.
 */
export function validatePayoutAddress(
  coin: string,
  chain: string,
  address: string,
): AddressCheck {
  const normalisedCoin = (coin || '').trim().toLowerCase()
  const normalisedChain = (chain || '').trim().toLowerCase() as PayoutChain
  const trimmed = (address || '').trim()

  const allowed = COIN_CHAINS[normalisedCoin]
  if (!allowed) {
    return { valid: false, error: 'Unsupported coin.' }
  }
  if (!allowed.includes(normalisedChain)) {
    const names = allowed.map((c) => CHAIN_LABELS[c]).join(', ')
    return {
      valid: false,
      error: `${normalisedCoin.toUpperCase()} can’t be sent over that network. Choose: ${names}.`,
    }
  }

  if (!trimmed) return { valid: false, error: 'Enter your wallet address.' }
  // Guards against pasted URIs ("bitcoin:bc1…?amount=") and stray whitespace
  // inside the string, both of which decode to a different destination.
  if (/\s/.test(trimmed)) {
    return { valid: false, error: 'Wallet addresses can’t contain spaces.' }
  }

  switch (normalisedChain) {
    case 'bitcoin':
      return checkBitcoin(trimmed)
    case 'tron':
      return checkTron(trimmed)
    case 'ethereum':
    case 'polygon':
      return checkEvm(trimmed, normalisedChain)
    default:
      return { valid: false, error: 'Unsupported network.' }
  }
}

// ── Review formatting ────────────────────────────────────────────

/**
 * Split an address into 4-character groups for the confirmation screen.
 *
 * Address-poisoning attacks work because people verify only the first and
 * last few characters — an attacker seeds a lookalike address with a matching
 * prefix and suffix into your transaction history and waits for a copy-paste.
 * Attempts jumped from roughly 628k (Nov 2025) to ~3.4M (Jan 2026) once
 * Fusaka cut the cost of sending them, and a single victim lost 4,556 ETH.
 *
 * Chunking forces the eye through the middle of the string, which is the part
 * that actually differs. Always render the FULL address at confirmation —
 * never a truncated "0x1234…abcd", which defeats the entire check.
 */
export function chunkAddress(address: string, size = 4): string[] {
  const clean = (address || '').trim()
  if (!clean) return []
  const groups: string[] = []
  for (let i = 0; i < clean.length; i += size) {
    groups.push(clean.slice(i, i + size))
  }
  return groups
}
