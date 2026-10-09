import { describe, expect, it } from 'vitest'
import { judge, screenImage } from './screen'

describe('image screening', () => {
  it('skips when the vendor keys are unset', async () => {
    delete process.env.SIGHTENGINE_API_USER
    const r = await screenImage(new Uint8Array([1, 2, 3]), 'image/png')
    expect(r).toEqual({ ok: true, skipped: true })
  })
  it('blocks nudity and gore, allows weapons on listings but not avatars', () => {
    expect(judge({ nudity: { sexual_display: 0.9 } }, 'listing').ok).toBe(false)
    expect(judge({ gore: { prob: 0.8 } }, 'listing').ok).toBe(false)
    expect(judge({ offensive: { nazi: 0.9 } }, 'listing').ok).toBe(false)
    expect(judge({ weapon: { classes: { firearm: 0.95 } } }, 'listing').ok).toBe(true)
    expect(judge({ weapon: { classes: { firearm: 0.95 } } }, 'avatar').ok).toBe(false)
    expect(judge({ nudity: { none: 0.99 } }, 'listing').ok).toBe(true)
  })
})
