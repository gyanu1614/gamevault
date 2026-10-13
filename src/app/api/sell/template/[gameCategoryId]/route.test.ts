import { describe, expect, it, vi } from 'vitest'

const read = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock('@/lib/sell/template-read', () => ({ getSellTemplate: read.fn }))

const ID = '3f2b6f0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'

describe('GET /api/sell/template/[gameCategoryId]', () => {
  it('serves the template with a shared-cache header', async () => {
    read.fn.mockResolvedValueOnce({ id: 't1', attributes: [] })
    const { GET } = await import('./route')
    const res = await GET(new Request('http://x'), { params: { gameCategoryId: ID } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ template: { id: 't1', attributes: [] } })
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=30,')
    expect(read.fn).toHaveBeenCalledWith(ID)
  })
  it('rejects a non-uuid without reading', async () => {
    read.fn.mockClear()
    const { GET } = await import('./route')
    const res = await GET(new Request('http://x'), { params: { gameCategoryId: "x' or 1=1" } })
    expect(res.status).toBe(400)
    expect(read.fn).not.toHaveBeenCalled()
  })
  it('a read failure is a 500, never an empty template', async () => {
    read.fn.mockRejectedValueOnce(new Error('db down'))
    const { GET } = await import('./route')
    const res = await GET(new Request('http://x'), { params: { gameCategoryId: ID } })
    expect(res.status).toBe(500)
    expect(res.headers.get('Cache-Control')).toBeNull()
  })
})
