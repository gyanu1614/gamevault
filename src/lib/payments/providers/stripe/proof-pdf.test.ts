import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

vi.mock('server-only', () => ({}))

import { buildProofPdf, PROOF_PDF_MAX_BYTES, PROOF_PHOTOS_MAX } from './proof-pdf'

const photo = (w: number, h: number, format: 'webp' | 'png' | 'jpeg' = 'webp') =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 40, g: 120, b: 200 } } })[format]().toBuffer()
/** Random pixels barely compress: the worst case for the size budget. */
const noise = (side: number) =>
  sharp(Buffer.from(Array.from({ length: side * side * 3 }, () => Math.floor(Math.random() * 256))), {
    raw: { width: side, height: side, channels: 3 },
  }).webp({ quality: 90 }).toBuffer()

describe('buildProofPdf', () => {
  it('turns the photos (WebP, PNG, JPEG) into one PDF, a page each', async () => {
    const pdf = await buildProofPdf([
      { data: await photo(1600, 900), caption: 'Delivery photo 1 of 3 - uploaded by the seller 2026-10-01 10:20 UTC' },
      { data: await photo(600, 1200, 'png'), caption: 'Delivery photo 2 of 3' },
      { data: await photo(300, 300, 'jpeg'), caption: 'Delivery photo 3 of 3 — ünïcödé ✓' },
    ])
    expect(pdf).not.toBeNull()
    expect(Buffer.from(pdf!.subarray(0, 5)).toString()).toBe('%PDF-')
    expect((await PDFDocument.load(pdf!)).getPageCount()).toBe(3)
  })

  it('skips a file that is not an image and returns null when nothing is left', async () => {
    const bad = { data: new TextEncoder().encode('not an image'), caption: 'x' }
    expect(await buildProofPdf([])).toBeNull()
    expect(await buildProofPdf([bad])).toBeNull()
    const pdf = await buildProofPdf([bad, { data: await photo(200, 200), caption: 'ok' }])
    expect((await PDFDocument.load(pdf!)).getPageCount()).toBe(1)
  })

  it(`keeps at most ${PROOF_PHOTOS_MAX} photos and stays under Stripe's size limit`, async () => {
    const big = await noise(1600)
    const pdf = await buildProofPdf(Array.from({ length: PROOF_PHOTOS_MAX + 2 }, (_, n) => ({ data: big, caption: `photo ${n + 1}` })))
    expect((await PDFDocument.load(pdf!)).getPageCount()).toBe(PROOF_PHOTOS_MAX)
    expect(pdf!.byteLength).toBeLessThanOrEqual(PROOF_PDF_MAX_BYTES)
  }, 30_000)
})
