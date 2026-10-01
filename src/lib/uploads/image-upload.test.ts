import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MAX_IMAGE_UPLOAD_BYTES,
  base64RequestBytes,
  imageTooLargeMessage,
  uploadErrorMessage,
} from './image-upload'

/** "4mb" / "1 MB" / "512kb" → bytes (the same units Next's bodySizeLimit takes). */
function parseSize(v: string): number {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb)?\s*$/i.exec(v)
  if (!m) throw new Error(`unparseable size ${v}`)
  const n = Number(m[1])
  const unit = (m[2] ?? 'b').toLowerCase()
  return unit === 'mb' ? n * 1024 * 1024 : unit === 'kb' ? n * 1024 : n
}

/** Vercel Functions reject request bodies over 4.5 MB before our code runs. */
const VERCEL_BODY_CAP = 4.5 * 1024 * 1024

describe('admin image uploads fit through a server action', () => {
  it('next.config sets experimental.serverActions.bodySizeLimit (the 1 MB default rejects ~750 KB images)', () => {
    const src = readFileSync(join(process.cwd(), 'next.config.js'), 'utf8')
    const m = /serverActions:\s*\{[^}]*bodySizeLimit:\s*['"]([^'"]+)['"]/.exec(src)
    expect(m, 'experimental.serverActions.bodySizeLimit missing from next.config.js').not.toBeNull()
    const limit = parseSize(m![1])
    // The largest image we let through, base64-encoded, plus JSON/action envelope.
    expect(base64RequestBytes(MAX_IMAGE_UPLOAD_BYTES)).toBeLessThanOrEqual(limit)
    expect(limit).toBeLessThanOrEqual(VERCEL_BODY_CAP)
  })

  it('base64RequestBytes covers the ×4/3 inflation, the data-URL prefix and the envelope', () => {
    const raw = 3 * 1024 * 1024
    expect(base64RequestBytes(raw)).toBeGreaterThan(Math.ceil(raw / 3) * 4)
  })

  it('imageTooLargeMessage passes files at the cap and names the limit above it', () => {
    expect(imageTooLargeMessage({ size: MAX_IMAGE_UPLOAD_BYTES })).toBeNull()
    expect(imageTooLargeMessage({ size: MAX_IMAGE_UPLOAD_BYTES + 1 })).toBe('Image must be 2.5 MB or smaller')
    expect(imageTooLargeMessage({ size: 1_048_577 }, 1_048_576, 'Icon')).toBe('Icon must be 1 MB or smaller')
  })

  it('uploadErrorMessage turns a thrown 413 into a readable message', () => {
    expect(uploadErrorMessage(new Error('Body exceeded 1 MB limit. To configure the body size limit…'))).toBe(
      'That image is too large to upload. Use one under 2.5 MB.',
    )
    expect(uploadErrorMessage(new Error('Failed to fetch'))).toBe('Upload failed: Failed to fetch')
    expect(uploadErrorMessage('nope')).toBe('Upload failed')
  })
})
