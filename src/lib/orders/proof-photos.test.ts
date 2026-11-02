import { describe, it, expect } from 'vitest'

import { proofPhotoPaths } from './proof-photos'

describe('proofPhotoPaths', () => {
  it('reads storage paths and Supabase storage URLs, images only, each once', () => {
    expect(
      proofPhotoPaths([
        'o1/1-shot.webp',
        'https://x.supabase.co/storage/v1/object/public/delivery-evidence/o1/2-shot.png',
        'https://x.supabase.co/storage/v1/object/sign/delivery-evidence/o1/3%20shot.JPG?token=abc',
        'o1/1-shot.webp',
        'o1/clip.mp4',
      ], 'o1')
    ).toEqual(['o1/1-shot.webp', 'o1/2-shot.png', 'o1/3 shot.JPG'])
  })

  it('drops anything that is not a plain path in the order\'s own folder', () => {
    expect(proofPhotoPaths(['', '   ', '../secret.png', 'o1/../x.png', '/abs.png', 'https://evil.example/x.png', 7 as any], 'o1')).toEqual([])
    expect(proofPhotoPaths(['o2/other-order.png', 'https://x.supabase.co/storage/v1/object/public/delivery-evidence/o2/a.png'], 'o1')).toEqual([])
    expect(proofPhotoPaths(null, 'o1')).toEqual([])
  })
})
