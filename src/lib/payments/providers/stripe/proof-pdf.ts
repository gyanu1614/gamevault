/**
 * The seller's delivery photos as ONE PDF for a card dispute (2026-10-29).
 * Stripe takes only PDF/JPEG/PNG, at most 4.5 MB for all the evidence of a
 * dispute and 19 pages for Mastercard; our photos are stored as WebP/JPEG/PNG
 * up to 1600 px. Each photo becomes an A4 page with its caption; the whole
 * file is re-encoded smaller until it fits. A file that is not a readable
 * image is skipped.
 */
import 'server-only'

import sharp from 'sharp'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const PROOF_PDF_MAX_BYTES = 4_000_000
export const PROOF_PHOTOS_MAX = 6

export interface ProofPhoto {
  data: Uint8Array
  caption: string
}

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 36
const CAPTION = 22
// Tried in order until the PDF fits PROOF_PDF_MAX_BYTES.
const PASSES: Array<{ px: number; quality: number }> = [
  { px: 1400, quality: 72 },
  { px: 1000, quality: 60 },
  { px: 700, quality: 50 },
]

// Helvetica (WinAnsi) cannot draw most non-Latin characters: keep printable ASCII.
const ascii = (s: string) => s.replace(/[–—]/g, '-').replace(/[^\x20-\x7E]/g, '?').slice(0, 120)

async function toJpeg(data: Uint8Array, px: number, quality: number): Promise<Buffer | null> {
  try {
    return await sharp(data)
      .rotate()
      .resize({ width: px, height: px, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()
  } catch {
    return null
  }
}

async function render(photos: ProofPhoto[], px: number, quality: number): Promise<Uint8Array | null> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const [pw, ph] = A4
  for (const p of photos) {
    const jpeg = await toJpeg(p.data, px, quality)
    if (!jpeg) continue
    const img = await doc.embedJpg(jpeg)
    const scale = Math.min((pw - MARGIN * 2) / img.width, (ph - MARGIN * 2 - CAPTION) / img.height, 1)
    const w = img.width * scale
    const h = img.height * scale
    const page = doc.addPage(A4)
    page.drawText(ascii(p.caption), { x: MARGIN, y: ph - MARGIN - 12, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
    page.drawImage(img, { x: MARGIN, y: ph - MARGIN - CAPTION - h, width: w, height: h })
  }
  return doc.getPageCount() ? doc.save() : null
}

export async function buildProofPdf(photos: ProofPhoto[]): Promise<Uint8Array | null> {
  const list = photos.slice(0, PROOF_PHOTOS_MAX)
  if (!list.length) return null
  for (const { px, quality } of PASSES) {
    const pdf = await render(list, px, quality)
    if (!pdf || pdf.byteLength <= PROOF_PDF_MAX_BYTES) return pdf
  }
  throw new Error('The delivery photos are too large for a dispute even after shrinking them. Untick some and try again.')
}
