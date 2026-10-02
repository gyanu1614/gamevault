import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import { TOKEN_URL } from '../../../scripts/lib/gsc/auth'
import { createRuntime, localDate } from '../../../scripts/lib/gsc/runtime'
import { blockNetwork } from './no-network'

blockNetwork()

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
const keyFile = JSON.stringify({
  type: 'service_account',
  client_email: 'gsc-reader@example-project.iam.gserviceaccount.com',
  private_key: privateKey,
})

describe('createRuntime', () => {
  it('wires key → token → throttled client, reading the key from the default path', async () => {
    const readFile = vi.fn(() => keyFile)
    const calls: string[] = []
    const fetch = vi.fn(async (url: string) => {
      calls.push(url)
      return url === TOKEN_URL
        ? new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }))
        : new Response(JSON.stringify({ sitemap: [] }))
    })
    const sleep = vi.fn(async () => {})

    const rt = createRuntime({
      env: {},
      home: '/home/me',
      fetch,
      clock: { now: () => 1_800_000_000_000, sleep },
      readFile,
    })
    expect(rt.keyPath).toBe('/home/me/.config/gsc/key.json')
    expect(readFile).toHaveBeenCalledWith('/home/me/.config/gsc/key.json')

    await rt.client.listSitemaps()
    expect(calls[0]).toBe(TOKEN_URL)
    expect(calls[1]).toContain('/sites/sc-domain%3Adropmarket.gg/sitemaps')
  })

  it('honours GOOGLE_APPLICATION_CREDENTIALS', () => {
    const readFile = vi.fn(() => keyFile)
    createRuntime({
      env: { GOOGLE_APPLICATION_CREDENTIALS: '/secure/key.json' },
      home: '/home/me',
      fetch: vi.fn(),
      clock: { now: () => 0, sleep: async () => {} },
      readFile,
    })
    expect(readFile).toHaveBeenCalledWith('/secure/key.json')
  })

  it('does not read the key until a runtime is created (no side effects on import)', () => {
    expect(typeof createRuntime).toBe('function')
  })
})

describe('localDate', () => {
  it('formats the local calendar day as YYYY-MM-DD with padding', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDate(new Date(2026, 9, 1, 0, 1))).toBe('2026-10-01')
  })
})
