import { describe, expect, it } from 'vitest'
import { pictureFit, PAIR_BOX, SMALL_HEIGHT } from './picture-size'

describe('one picture size system (owner, 2026-10-13: big and small uploads look consistent)', () => {
  it('a photo 640px+ wide fills the column, height capped (560 column, 640 wide)', () => {
    const f = pictureFit({ width: 1920, height: 1080 }, 'column')
    expect(f.kind).toBe('photo')
    expect(f.style).toEqual({ maxHeight: 560 })
    expect(pictureFit({ width: 1920, height: 1080 }, 'wide').style).toEqual({ maxHeight: 640 })
  })
  it('a small picture shows at the standard height, never stretched past 1.5×', () => {
    expect(pictureFit({ width: 300, height: 400 }, 'column').style).toEqual({ height: SMALL_HEIGHT })
    expect(pictureFit({ width: 120, height: 80 }, 'column').style).toEqual({ height: 120 })
    expect(pictureFit({ width: 300, height: 400 }, 'column').kind).toBe('small')
  })
  it('a transparent cut-out sits on the page: no rounded box, no placeholder', () => {
    const f = pictureFit({ width: 1365, height: 768, alpha: true }, 'column')
    expect(f.kind).toBe('cutout')
    expect(f.rounded).toBe(false)
    expect(f.placeholder).toBe(false)
  })
  it('an opaque photo keeps rounded corners and its blur placeholder', () => {
    const f = pictureFit({ width: 1600, height: 900 }, 'column')
    expect(f.rounded).toBe(true)
    expect(f.placeholder).toBe(true)
  })
  it('a picture with no known size (old posts) fills the column like a photo', () => {
    expect(pictureFit({}, 'column').kind).toBe('photo')
  })
  it('two pictures side by side share one box height', () => {
    expect(PAIR_BOX).toMatch(/h-\[220px\].*sm:h-\[260px\]/)
  })
})
