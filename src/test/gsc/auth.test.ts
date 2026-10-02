import { createPublicKey, createVerify, generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import {
  GSC_READONLY_SCOPE,
  TOKEN_URL,
  buildSignedJwt,
  createTokenProvider,
  loadServiceAccountKey,
  resolveKeyPath,
} from '../../../scripts/lib/gsc/auth'
import { blockNetwork } from './no-network'

blockNetwork()

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

const KEY = {
  type: 'service_account',
  client_email: 'gsc-reader@example-project.iam.gserviceaccount.com',
  private_key: privateKey,
  private_key_id: 'abc123',
  // A key file can name any token host; the signed assertion must never go there.
  token_uri: 'https://evil.example/token',
}

const b64urlJson = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))

describe('resolveKeyPath', () => {
  it('prefers GOOGLE_APPLICATION_CREDENTIALS', () => {
    expect(resolveKeyPath({ GOOGLE_APPLICATION_CREDENTIALS: '/x/key.json' }, '/home/me')).toBe('/x/key.json')
  })
  it('defaults to ~/.config/gsc/key.json', () => {
    expect(resolveKeyPath({}, '/home/me')).toBe('/home/me/.config/gsc/key.json')
  })
})

describe('loadServiceAccountKey', () => {
  it('reads a service-account key file', () => {
    const key = loadServiceAccountKey('/k.json', () => JSON.stringify(KEY))
    expect(key.client_email).toBe(KEY.client_email)
  })

  it('rejects a file that is not a service-account key, without echoing its content', () => {
    const read = () => '{ SECRET_MARKER not json'
    let message = ''
    try {
      loadServiceAccountKey('/k.json', read)
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toMatch(/not valid JSON/)
    expect(message).not.toContain('SECRET_MARKER')
  })

  it('names the missing field, never a value', () => {
    const read = () => JSON.stringify({ type: 'service_account', private_key: privateKey })
    expect(() => loadServiceAccountKey('/k.json', read)).toThrow(/client_email/)
    try {
      loadServiceAccountKey('/k.json', read)
    } catch (e) {
      expect((e as Error).message).not.toContain('BEGIN PRIVATE KEY')
    }
  })

  it('reports an unreadable path without leaking anything', () => {
    const read = () => {
      throw new Error('ENOENT')
    }
    expect(() => loadServiceAccountKey('/missing.json', read)).toThrow(/Cannot read.*\/missing\.json/)
  })
})

describe('buildSignedJwt', () => {
  const nowSec = 1_800_000_000

  it('carries the read-only scope, the fixed token audience and a 1h expiry', () => {
    const [h, c] = buildSignedJwt(KEY, nowSec).split('.')
    expect(b64urlJson(h)).toMatchObject({ alg: 'RS256', typ: 'JWT' })
    expect(b64urlJson(c)).toEqual({
      iss: KEY.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
    })
    expect(GSC_READONLY_SCOPE).toBe('https://www.googleapis.com/auth/webmasters.readonly')
  })

  it('is signed with the account key (RS256 verifies against the public key)', () => {
    const [h, c, sig] = buildSignedJwt(KEY, nowSec).split('.')
    const ok = createVerify('RSA-SHA256')
      .update(`${h}.${c}`)
      .verify(createPublicKey(publicKey), Buffer.from(sig, 'base64url'))
    expect(ok).toBe(true)
  })
})

describe('createTokenProvider', () => {
  function fakeFetch(tokens = ['tok-1', 'tok-2', 'tok-3'], expiresIn = 3600) {
    const queue = [...tokens]
    return vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ access_token: queue.shift(), expires_in: expiresIn, token_type: 'Bearer' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  }

  it('exchanges a signed assertion at the fixed Google token URL', async () => {
    const fetch = fakeFetch()
    const provider = createTokenProvider({ key: KEY, fetch, now: () => 1_800_000_000_000 })
    await expect(provider.getToken()).resolves.toBe('tok-1')

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(TOKEN_URL)
    expect(init?.method).toBe('POST')
    const body = new URLSearchParams(String(init?.body))
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    expect(body.get('assertion')?.split('.')).toHaveLength(3)
  })

  it('caches the token until shortly before it expires, then refreshes', async () => {
    const fetch = fakeFetch()
    let now = 1_800_000_000_000
    const provider = createTokenProvider({ key: KEY, fetch, now: () => now })
    expect(await provider.getToken()).toBe('tok-1')
    now += 3000_000 // 50 min in: still valid
    expect(await provider.getToken()).toBe('tok-1')
    expect(fetch).toHaveBeenCalledTimes(1)
    now += 600_000 // 60 min in: inside the 60 s safety margin of expiry
    expect(await provider.getToken()).toBe('tok-2')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('shares one exchange between concurrent callers', async () => {
    const fetch = fakeFetch()
    const provider = createTokenProvider({ key: KEY, fetch, now: () => 1_800_000_000_000 })
    const tokens = await Promise.all([provider.getToken(), provider.getToken(), provider.getToken()])
    expect(tokens).toEqual(['tok-1', 'tok-1', 'tok-1'])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('fails with Google’s error code but never the assertion or the key', async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }), {
        status: 400,
      }),
    )
    const provider = createTokenProvider({ key: KEY, fetch, now: () => 1_800_000_000_000 })
    let message = ''
    try {
      await provider.getToken()
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain('400')
    expect(message).toContain('invalid_grant')
    expect(message).not.toContain('PRIVATE KEY')
    expect(message).not.toContain('assertion')
  })

  it('does not cache a failed exchange', async () => {
    let calls = 0
    const fetch = vi.fn(async () => {
      calls++
      return calls === 1
        ? new Response('{"error":"temporarily_unavailable"}', { status: 503 })
        : new Response('{"access_token":"ok","expires_in":3600}', { status: 200 })
    })
    const provider = createTokenProvider({ key: KEY, fetch, now: () => 1_800_000_000_000 })
    await expect(provider.getToken()).rejects.toThrow(/503/)
    await expect(provider.getToken()).resolves.toBe('ok')
  })
})
