/**
 * Service-account auth for Search Console, with node:crypto only.
 *
 * The key file is read once, used to sign a short-lived JWT, and never
 * printed: every error here names a field or an HTTP status, never a value.
 * The token host is a constant — a key file is data, and a signed assertion
 * must not be sent to a URL the file chooses.
 */

import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { FetchLike } from './types'

export const GSC_READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
export const TOKEN_URL = 'https://oauth2.googleapis.com/token'

const TOKEN_LIFETIME_SEC = 3600
/** Refresh this long before the token expires. */
const EXPIRY_MARGIN_MS = 60_000

export interface ServiceAccountKey {
  client_email: string
  private_key: string
  private_key_id?: string
  [extra: string]: unknown
}

export function resolveKeyPath(env: Record<string, string | undefined>, home: string): string {
  return env.GOOGLE_APPLICATION_CREDENTIALS || join(home, '.config', 'gsc', 'key.json')
}

export function loadServiceAccountKey(
  path: string,
  readFile: (path: string) => string = (p) => readFileSync(p, 'utf8'),
): ServiceAccountKey {
  let raw: string
  try {
    raw = readFile(path)
  } catch {
    throw new Error(`Cannot read the service-account key at ${path}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // JSON.parse messages quote the input — say nothing about the content.
    throw new Error(`The key file at ${path} is not valid JSON`)
  }

  const key = parsed as Partial<ServiceAccountKey> & { type?: string }
  for (const field of ['client_email', 'private_key'] as const) {
    if (typeof key[field] !== 'string' || !key[field]) {
      throw new Error(`The key file at ${path} has no "${field}" — expected a service-account key`)
    }
  }
  if (key.type && key.type !== 'service_account') {
    throw new Error(`The key file at ${path} is a "${key.type}" credential, not a service-account key`)
  }
  return key as ServiceAccountKey
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString('base64url')

export function buildSignedJwt(
  key: ServiceAccountKey,
  nowSec: number,
  scope: string = GSC_READONLY_SCOPE,
): string {
  const header = { alg: 'RS256', typ: 'JWT', ...(key.private_key_id ? { kid: key.private_key_id } : {}) }
  const claims = {
    iss: key.client_email,
    scope,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + TOKEN_LIFETIME_SEC,
  }
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key)
  return `${unsigned}.${b64url(signature)}`
}

export interface TokenProviderOptions {
  key: ServiceAccountKey
  fetch: FetchLike
  now: () => number
  scope?: string
}

export function createTokenProvider({ key, fetch, now, scope }: TokenProviderOptions) {
  let cached: { token: string; expiresAt: number } | null = null
  let inFlight: Promise<string> | null = null

  async function exchange(): Promise<string> {
    const assertion = buildSignedJwt(key, Math.floor(now() / 1000), scope)
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    })

    const text = await res.text()
    let json: { access_token?: string; expires_in?: number; error?: string; error_description?: string } = {}
    try {
      json = JSON.parse(text)
    } catch {
      /* non-JSON body: report the status only */
    }

    if (!res.ok || !json.access_token) {
      const code = json.error ? ` ${json.error}` : ''
      const detail = json.error_description ? `: ${json.error_description}` : ''
      throw new Error(`Token exchange failed (HTTP ${res.status}${code}${detail})`)
    }
    cached = {
      token: json.access_token,
      expiresAt: now() + (json.expires_in ?? TOKEN_LIFETIME_SEC) * 1000,
    }
    return json.access_token
  }

  return {
    async getToken(): Promise<string> {
      if (cached && now() < cached.expiresAt - EXPIRY_MARGIN_MS) return cached.token
      inFlight ??= exchange().finally(() => {
        inFlight = null
      })
      return inFlight
    },
  }
}
