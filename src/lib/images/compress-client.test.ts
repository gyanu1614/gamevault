import { describe, expect, it } from 'vitest'
import { compressImageForUpload } from './compress-client'

describe('compressImageForUpload (outside a browser)', () => {
  it('returns non-images and GIFs untouched', async () => {
    const pdf = new File([new Uint8Array(10)], 'a.pdf', { type: 'application/pdf' })
    const gif = new File([new Uint8Array(10)], 'a.gif', { type: 'image/gif' })
    expect(await compressImageForUpload(pdf)).toBe(pdf)
    expect(await compressImageForUpload(gif)).toBe(gif)
  })
  it('without createImageBitmap (server / old browser) returns the file as is', async () => {
    const png = new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })
    expect(await compressImageForUpload(png)).toBe(png)
  })
})
