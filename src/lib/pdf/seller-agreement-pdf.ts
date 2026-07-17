/**
 * buildSellerAgreementPdf — renders the FULL Seller Agency Agreement (the
 * live legal doc from src/lib/legal/documents.ts) into a professional,
 * per-seller executed PDF: parties block naming the seller as PRINCIPAL,
 * every section of the agreement, and an execution page carrying their
 * electronic signature, timestamp, and the recorded consents. Suitable for
 * sending to the seller, auditors, or authorities.
 *
 * pdf-lib only (no native deps). Standard fonts: Helvetica family for boo,
 * Times-Italic for the signature script.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { getLegalDoc, type LegalBlock } from '@/lib/legal/documents'

// Monochrome, formal-contract palette (no brand colors — prints clean).
const BLACK = rgb(0.08, 0.08, 0.08)
const INK = rgb(0.13, 0.13, 0.13)
const INK2 = rgb(0.42, 0.42, 0.42)
const LINE = rgb(0.82, 0.82, 0.82)

const A4 = { w: 595.28, h: 841.89 }
const MARGIN = 56
const CONTENT_W = A4.w - MARGIN * 2

export interface AgreementPdfInput {
  applicationId: string
  legalName: string
  shopName: string | null
  email: string | null
  country: string | null
  sellerType: string | null
  signatureName: string | null
  /** Drawn signature-pad PNG (data URL) — embedded in the execution block. */
  signatureImage?: string | null
  signedAt: string | null
  /** Draft preview for the applicant — unsigned, watermarked. */
  draft?: boolean
  submittedAt: string | null
  consents: Array<{ label: string; accepted: boolean }>
}

/** Strip the tiny markdown subset used in legal docs (bold + links). */
function stripMd(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .replace(/\s+/g, ' ')
    .trim()
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(probe, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = probe
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function buildSellerAgreementPdf(input: AgreementPdfInput): Promise<Uint8Array> {
  const doc = getLegalDoc('seller-agreement')
  const pdf = await PDFDocument.create()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const timesItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic)

  pdf.setTitle(`Seller Agency Agreement — ${input.legalName}`)
  pdf.setAuthor('DropMarket Ltd')
  pdf.setSubject('Executed Seller Agency Agreement')
  pdf.setCreationDate(new Date())

  let page = pdf.addPage([A4.w, A4.h])
  let y = A4.h - MARGIN

  const pages: PDFPage[] = [page]
  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h])
    pages.push(page)
    y = A4.h - MARGIN
  }
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 26) newPage()
  }
  const drawText = (
    text: string,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {},
  ) => {
    const { font = helv, size = 9.5, color = INK, gap = 4, indent = 0 } = opts
    const lines = wrap(text, font, size, CONTENT_W - indent)
    for (const line of lines) {
      ensure(size + 3)
      page.drawText(line, { x: MARGIN + indent, y: y - size, size, font, color })
      y -= size + 3
    }
    y -= gap
  }

  // ── Letterhead ──────────────────────────────────────────────────────────
  page.drawLine({ start: { x: MARGIN, y: A4.h - 34 }, end: { x: A4.w - MARGIN, y: A4.h - 34 }, thickness: 1.2, color: BLACK })
  page.drawText('DROPMARKET LTD', { x: MARGIN, y: A4.h - 28, size: 13, font: helvBold, color: BLACK })
  page.drawText('dropmarket.gg  ·  support@dropmarket.gg', {
    x: MARGIN, y: A4.h - 48, size: 8.5, font: helv, color: INK2,
  })
  y = A4.h - 84

  drawText('SELLER AGENCY AGREEMENT', { font: helvBold, size: 16, color: BLACK, gap: 2 })
  drawText(
    input.draft
      ? 'DRAFT FOR REVIEW — this document is not executed until you sign in your application'
      : 'Executed electronic counterpart',
    { size: 9, color: INK2, gap: 12 },
  )

  // ── Parties ─────────────────────────────────────────────────────────────
  const signedDate = input.signedAt
    ? new Date(input.signedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
    : '—'
  drawText('THIS AGREEMENT is entered into between:', { font: helvBold, size: 9.5, gap: 4 })
  drawText(
    '(1) DropMarket Ltd, operator of the DropMarket marketplace at dropmarket.gg (the “Agent”); and',
    { indent: 12, gap: 3 },
  )
  drawText(
    `(2) ${input.legalName}${input.shopName ? `, trading on the marketplace as “${input.shopName}”` : ''}${
      input.country ? `, of ${input.country}` : ''
    } (the “Principal”).`,
    { indent: 12, gap: 8 },
  )
  drawText(
    `Application reference ${input.applicationId} · ${input.sellerType === 'business' ? 'Business seller' : 'Individual seller'} · Executed ${signedDate}`,
    { size: 8.5, color: INK2, gap: 6 },
  )
  ensure(14)
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: A4.w - MARGIN, y }, thickness: 0.7, color: LINE,
  })
  y -= 14

  // ── Full agreement body ─────────────────────────────────────────────────
  if (doc) {
    for (const section of doc.sections) {
      if (section.h) {
        ensure(26)
        drawText(section.h, { font: helvBold, size: 11, color: BLACK, gap: 4 })
      }
      for (const block of section.blocks as LegalBlock[]) {
        if (block.t === 'p') drawText(stripMd(block.md), { gap: 5 })
        else if (block.t === 'note') drawText(stripMd(block.md), { font: timesItalic, size: 9, color: INK2, gap: 5 })
        else if (block.t === 'ul') {
          for (const item of block.items) drawText(`•  ${stripMd(item)}`, { indent: 10, gap: 2 })
          y -= 4
        } else if (block.t === 'table') {
          drawText(block.head.join('   ·   '), { font: helvBold, size: 8.5, gap: 2 })
          for (const row of block.rows) drawText(row.join('   ·   '), { size: 8.5, indent: 6, gap: 2 })
          y -= 4
        }
      }
      y -= 4
    }
  } else {
    drawText(
      'The Principal has accepted the Seller Agency Agreement as published at dropmarket.gg/seller-agreement, incorporated here by reference.',
      { gap: 8 },
    )
  }

  // ── Execution page ──────────────────────────────────────────────────────
  newPage()
  drawText('EXECUTION', { font: helvBold, size: 13, color: BLACK, gap: 10 })
  drawText(
    'Executed electronically by the Principal through the DropMarket seller onboarding flow. The typed signature below was entered by the Principal and recorded together with the timestamp and the consents listed.',
    { size: 9, color: INK2, gap: 14 },
  )

  drawText('SIGNED for and on behalf of the PRINCIPAL:', { font: helvBold, size: 9.5, gap: 10 })
  if (input.draft) {
    // Unsigned draft — blank signature area.
    ensure(60)
    y -= 44
  } else if (input.signatureImage?.startsWith('data:image/png;base64,')) {
    // Drawn signature (signature pad PNG).
    try {
      const pngBytes = Uint8Array.from(
        Buffer.from(input.signatureImage.split(',')[1] ?? '', 'base64'),
      )
      const png = await pdf.embedPng(pngBytes)
      const dims = png.scaleToFit(220, 66)
      ensure(dims.height + 16)
      page.drawImage(png, { x: MARGIN, y: y - dims.height, width: dims.width, height: dims.height })
      y -= dims.height + 8
    } catch {
      const sig = input.signatureName || input.legalName
      ensure(60)
      page.drawText(sig, { x: MARGIN, y: y - 24, size: 24, font: timesItalic, color: BLACK })
      y -= 34
    }
  } else {
    const sig = input.signatureName || input.legalName
    ensure(60)
    page.drawText(sig, { x: MARGIN, y: y - 24, size: 24, font: timesItalic, color: BLACK })
    y -= 34
  }
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 240, y }, thickness: 0.8, color: INK })
  y -= 12
  drawText(`${input.legalName} — Principal`, { size: 9, gap: 2 })
  drawText(input.draft ? 'Signed: ________________________' : `Signed: ${signedDate}`, {
    size: 8.5, color: INK2, gap: 2,
  })
  if (input.email) drawText(`Account email: ${input.email}`, { size: 8.5, color: INK2, gap: 14 })

  drawText('ACCEPTED for and on behalf of the AGENT:', { font: helvBold, size: 9.5, gap: 8 })
  drawText('DropMarket Ltd — automated acceptance on application approval', { size: 9, gap: 14 })

  drawText('CONSENTS RECORDED AT EXECUTION:', { font: helvBold, size: 9.5, gap: 6 })
  for (const consent of input.consents) {
    ensure(12)
    page.drawText(consent.accepted ? '[X]' : '[  ]', {
      x: MARGIN, y: y - 9, size: 8.5, font: helvBold, color: consent.accepted ? BLACK : INK2,
    })
    page.drawText(consent.label, { x: MARGIN + 22, y: y - 9, size: 9, font: helv, color: INK })
    y -= 14
  }

  // ── Footer on every page ────────────────────────────────────────────────
  pages.forEach((pg, i) => {
    pg.drawText(
      `Seller Agency Agreement · ${input.legalName} · Ref ${input.applicationId.slice(0, 8)} · Page ${i + 1} of ${pages.length}`,
      { x: MARGIN, y: 30, size: 7.5, font: helv, color: INK2 },
    )
  })

  return pdf.save()
}
