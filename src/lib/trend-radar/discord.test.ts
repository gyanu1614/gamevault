import { describe, it, expect } from 'vitest'
import {
  trendAlertPayload,
  liveFollowupPayload,
  markLive,
  postWebhook,
  patchWebhookMessage,
  type FetchLike,
} from './discord'

const alertInput = {
  name: 'Steal An Egg',
  slug: 'steal-an-egg',
  universeId: 10563114921,
  playingNow: 2_034_139,
  playing48hAgo: 1_200_000,
  signals: ['top30_entry', 'growth_48h'] as const,
  rank: 1,
  adminUrl: 'https://dropmarket.gg/admin/games?status=pending#steal-an-egg',
  robloxUrl: 'https://www.roblox.com/games/123',
  iconUrl: 'https://x/icon.webp',
  categories: ['items', 'accounts'],
  wikiFound: true,
  flags: { ambiguous: true },
}

describe('trendAlertPayload', () => {
  it('names the game, players now, 48h change, signals and the review link', () => {
    const p = trendAlertPayload(alertInput)
    const e = p.embeds![0]
    expect(e.title).toContain('Steal An Egg')
    expect(e.url).toBe(alertInput.adminUrl)
    expect(e.thumbnail).toEqual({ url: 'https://x/icon.webp' })
    const text = JSON.stringify(e.fields)
    expect(text).toContain('2,034,139')
    expect(text).toContain('+69.5%')
    expect(text).toContain('top30_entry')
    expect(text).toContain('growth_48h')
    expect(text).toContain('#1')
    expect(text).toContain('items, accounts')
    expect(text).toMatch(/wiki/i)
    expect(text).toMatch(/ambiguous/i)
    expect(p.allowed_mentions).toEqual({ parse: [] })
  })

  it('says when there is no 48h baseline and no wiki', () => {
    const p = trendAlertPayload({ ...alertInput, playing48hAgo: null, wikiFound: false, flags: {} })
    const text = JSON.stringify(p.embeds![0].fields)
    expect(text).toContain('n/a')
    expect(text).toMatch(/no wiki/i)
  })
})

describe('markLive / liveFollowupPayload', () => {
  it('rewrites the original alert as live and produces a short follow-up', () => {
    const p = markLive(trendAlertPayload(alertInput), 'https://dropmarket.gg/steal-an-egg')
    expect(p.embeds![0].title).toMatch(/live/i)
    expect(p.embeds![0].url).toBe('https://dropmarket.gg/steal-an-egg')
    const f = liveFollowupPayload('Steal An Egg', 'https://dropmarket.gg/steal-an-egg')
    expect(f.content).toContain('Steal An Egg')
    expect(f.content).toContain('https://dropmarket.gg/steal-an-egg')
  })
})

describe('postWebhook', () => {
  it('posts with ?wait=true and returns the message id', async () => {
    let seen: { url: string; body: string } | null = null
    const fetchImpl: FetchLike = async (url, init) => {
      seen = { url: String(url), body: String(init?.body) }
      return new Response(JSON.stringify({ id: '999' }), { status: 200 })
    }
    const r = await postWebhook('https://discord.com/api/webhooks/1/abc', { content: 'hi' }, { fetchImpl })
    expect(r).toEqual({ ok: true, messageId: '999' })
    expect(seen!.url).toBe('https://discord.com/api/webhooks/1/abc?wait=true')
    expect(JSON.parse(seen!.body)).toEqual({ content: 'hi' })
  })

  it('in dry-run mode returns the payload and never calls fetch', async () => {
    const fetchImpl: FetchLike = async () => { throw new Error('must not be called') }
    const r = await postWebhook('https://discord.com/api/webhooks/1/abc', { content: 'hi' }, { fetchImpl, dryRun: true })
    expect(r).toEqual({ ok: true, dryRun: true, payload: { content: 'hi' } })
  })

  it('reports a failure without throwing', async () => {
    const fetchImpl: FetchLike = async () => new Response('nope', { status: 400 })
    const r = await postWebhook('https://discord.com/api/webhooks/1/abc', { content: 'hi' }, { fetchImpl })
    expect(r).toEqual({ ok: false, status: 400, error: 'nope' })
  })
})

describe('patchWebhookMessage', () => {
  it('PATCHes /messages/<id> on the same webhook', async () => {
    let seen: { url: string; method: string } | null = null
    const fetchImpl: FetchLike = async (url, init) => {
      seen = { url: String(url), method: String(init?.method) }
      return new Response('{}', { status: 200 })
    }
    const ok = await patchWebhookMessage('https://discord.com/api/webhooks/1/abc', '999', { content: 'x' }, { fetchImpl })
    expect(ok).toBe(true)
    expect(seen!).toEqual({ url: 'https://discord.com/api/webhooks/1/abc/messages/999', method: 'PATCH' })
  })
})
