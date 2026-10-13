/**
 * The blog post format (2026-10-12 revamp). A post body is a Tiptap doc —
 * plain JSON, stored in `blog_posts.body` (jsonb) as `{ v: 2, doc, cover }` —
 * rendered on the server by `@tiptap/static-renderer` with our block set
 * (`schema.ts`). Legacy bodies (an array of markdown strings) are converted
 * to the same doc at read time (`legacy.ts`), so there is one renderer.
 */

/** Tiptap / ProseMirror JSON (the subset we store). */
export interface DocNode {
  type: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  text?: string
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

export interface BlogDoc extends DocNode {
  type: 'doc'
  content: DocNode[]
}

/** One encoded width of an uploaded image. */
export interface SrcItem {
  w: number
  url: string
}

/**
 * An image processed once at upload (src/lib/blog/images.ts): AVIF + WebP at
 * fixed widths, its real size, and a tiny blur placeholder.
 */
export interface StoredImage {
  /** The largest WebP — the plain `src` fallback and the card / OG image. */
  src: string
  width: number
  height: number
  /** data:image/webp;base64,… (a few hundred bytes), or null for legacy images. */
  blur: string | null
  sources: { avif: SrcItem[]; webp: SrcItem[] }
}

export type ImageLayout = 'column' | 'wide'
export type CalloutTone = 'tip' | 'warning' | 'note' | 'takeaways'

export interface BodyV2 {
  v: 2
  doc: BlogDoc
  /** The cover's full source set; `cover_url` keeps the card/OG URL. */
  cover?: StoredImage | null
  /** URLs this post was live at before a rename; they redirect to the current one. */
  oldSlugs?: string[]
}

export const EMPTY_DOC: BlogDoc = { type: 'doc', content: [{ type: 'paragraph' }] }
