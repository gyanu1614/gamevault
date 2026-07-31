/**
 * Ed25519 request verification for the Discord interactions endpoint.
 *
 * Discord signs every request and REQUIRES that we reject bad signatures with
 * a 401 — it sends deliberately-invalid requests during endpoint setup and
 * refuses to save the URL unless they're rejected. An unverified endpoint is
 * also a free spoofing surface, since anyone who learns the URL could POST
 * fake interactions.
 *
 * Implemented on native node:crypto rather than tweetnacl: Discord hands us a
 * raw 32-byte Ed25519 public key as hex, and Node only accepts DER/PEM, so we
 * prepend the fixed SPKI header for Ed25519 keys. Saves a dependency on the
 * one route where supply-chain surface matters most.
 */

import { createPublicKey, verify, type KeyObject } from 'node:crypto'

/**
 * ASN.1 DER SubjectPublicKeyInfo header for Ed25519. Constant for every
 * Ed25519 key, so a raw key becomes valid DER by concatenation.
 */
const SPKI_ED25519_HEADER = Buffer.from(
  '302a300506032b6570032100',
  'hex',
)

const ED25519_RAW_KEY_BYTES = 32

// Parsing the key allocates; the key never changes within a deployment.
let cachedKeyHex: string | null = null
let cachedKey: KeyObject | null = null

function toKeyObject(publicKeyHex: string): KeyObject | null {
  if (cachedKey && cachedKeyHex === publicKeyHex) {
    return cachedKey
  }

  try {
    const raw = Buffer.from(publicKeyHex, 'hex')

    if (raw.length !== ED25519_RAW_KEY_BYTES) {
      return null
    }

    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_HEADER, raw]),
      format: 'der',
      type: 'spki',
    })

    cachedKeyHex = publicKeyHex
    cachedKey = key

    return key
  } catch {
    return null
  }
}

export type VerifyInput = {
  /** Raw request body, byte-for-byte as received — NOT re-serialized JSON. */
  rawBody: string
  signature: string | null
  timestamp: string | null
  publicKeyHex: string
}

/**
 * True only when the signature is valid for `timestamp + rawBody`.
 *
 * Every failure mode (missing header, malformed hex, wrong key) returns false
 * rather than throwing, so the route can answer 401 uniformly and never leak
 * which part was wrong.
 */
export function verifyDiscordSignature({
  rawBody,
  signature,
  timestamp,
  publicKeyHex,
}: VerifyInput): boolean {
  if (!signature || !timestamp || !publicKeyHex) {
    return false
  }

  const key = toKeyObject(publicKeyHex)

  if (!key) {
    return false
  }

  let signatureBytes: Buffer

  try {
    signatureBytes = Buffer.from(signature, 'hex')
  } catch {
    return false
  }

  if (signatureBytes.length !== 64) {
    return false
  }

  try {
    return verify(
      null,
      Buffer.from(timestamp + rawBody, 'utf8'),
      key,
      signatureBytes,
    )
  } catch {
    return false
  }
}
