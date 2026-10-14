import { legacyToDoc } from './legacy'
import { EMPTY_DOC, type BlogDoc, type BodyV2, type StoredImage } from './types'

/**
 * Whatever `blog_posts.body` holds → one doc. A legacy array is converted
 * (`legacy: true`, so the editor can say "converted from the old format");
 * a v2 body is used as is; anything malformed renders as an empty post
 * rather than crashing the page.
 */
export function readBody(raw: unknown): { doc: BlogDoc; cover: StoredImage | null; legacy: boolean; note: string | null } {
  if (Array.isArray(raw)) return { doc: legacyToDoc(raw.map(String)), cover: null, legacy: true, note: null }
  if (raw && typeof raw === 'object' && (raw as { v?: unknown }).v === 2) {
    const body = raw as BodyV2
    if (body.doc?.type === 'doc' && Array.isArray(body.doc.content)) {
      return { doc: body.doc, cover: body.cover ?? null, legacy: false, note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null }
    }
  }
  return { doc: EMPTY_DOC, cover: null, legacy: false, note: null }
}

export function makeBody(doc: BlogDoc, cover: StoredImage | null): BodyV2 {
  return { v: 2, doc, cover }
}
