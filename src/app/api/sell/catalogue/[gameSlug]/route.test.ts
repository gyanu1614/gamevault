import { beforeEach, describe, expect, it, vi } from 'vitest'

const getValueCatalog = vi.fn()
vi.mock('@/lib/value-listings/stock-server', () => ({ getValueCatalog: (...a: unknown[]) => getValueCatalog(...a) }))

import { GET } from './route'

const call = (gameSlug: string) => GET(new Request('https://x'), { params: { gameSlug } })

describe('GET /api/sell/catalogue/[gameSlug]', () => {
  beforeEach(() => {
    getValueCatalog.mockReset()
  })

  it('answers pictures and rarities by slug, cached for the CDN', async () => {
    getValueCatalog.mockResolvedValue({ items: [{ slug: 'sunrise', name: 'Sunrise', rarity: 'Godly', imageUrl: 'https://x/sunrise.webp' }, { slug: 'luger', name: 'Luger' }] })
    const res = await call('murder-mystery-2')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600')
    expect(await res.json()).toEqual({ items: { sunrise: ['https://x/sunrise.webp', 'Godly'], luger: [null, null] } })
  })

  it('refuses a game with no item search, without reading anything', async () => {
    const res = await call('fortnite')
    expect(res.status).toBe(404)
    expect(getValueCatalog).not.toHaveBeenCalled()
  })

  it('a failed read is a 500, never a cached empty answer', async () => {
    getValueCatalog.mockRejectedValue(new Error('down'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await call('adopt-me')
    expect(res.status).toBe(500)
    expect(res.headers.get('cache-control')).toBeNull()
    error.mockRestore()
  })
})
