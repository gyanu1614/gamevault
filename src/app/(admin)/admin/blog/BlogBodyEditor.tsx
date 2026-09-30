'use client'

import { useMemo, useRef, useState, type RefObject } from 'react'
import { ArticleBody } from '../../../(marketplace)/[gameSlug]/blog/[slug]/_articleBody'

/**
 * Split blog-body editor (design "Option A"): markdown textarea on the left,
 * a LIVE preview (the real ArticleBody renderer) on the right, plus a block
 * insert toolbar. Everything inserts AT THE CURSOR — never appended at the end.
 * Paste a whole markdown doc and it renders exactly as it will publish.
 */

type Block = {
  label: string
  hint: string
  /** Returns { text, selectStart?, selectEnd? } inserted around the selection. */
  build: (sel: string) => string
  /** Whether the block should sit on its own lines (blank-line separated). */
  block?: boolean
}

const BLOCKS: Block[] = [
  { label: 'H2', hint: 'Section heading', block: true, build: (s) => `## ${s || 'Heading'}` },
  { label: 'H3', hint: 'Sub-heading', block: true, build: (s) => `### ${s || 'Sub-heading'}` },
  { label: 'Bold', hint: '**bold**', build: (s) => `**${s || 'bold text'}**` },
  { label: 'Italic', hint: '*italic*', build: (s) => `*${s || 'italic text'}*` },
  { label: 'Bullets', hint: '- list', block: true, build: (s) => (s || 'First item\nSecond item').split('\n').map((l) => `- ${l}`).join('\n') },
  { label: 'Numbered', hint: '1. list', block: true, build: (s) => (s || 'First step\nSecond step').split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n') },
  { label: 'Steps', hint: 'numbered step cards', block: true, build: (s) => `:::steps\n${s || 'Go to the Sell page\nPick your game\nPublish'}\n:::` },
  { label: 'Quote', hint: '> pull quote', block: true, build: (s) => `> ${s || 'A memorable line worth pulling out.'}` },
  { label: 'Tip', hint: 'green callout', block: true, build: (s) => `:::tip\n${s || 'A helpful tip goes here.'}\n:::` },
  { label: 'Warning', hint: 'amber callout', block: true, build: (s) => `:::warning\n${s || 'Something to watch out for.'}\n:::` },
  { label: 'Note', hint: 'neutral callout', block: true, build: (s) => `:::note\n${s || 'A side note.'}\n:::` },
  { label: 'Takeaways', hint: 'key-points box', block: true, build: (s) => `:::takeaways\n${s || '- First takeaway\n- Second takeaway'}\n:::` },
  { label: 'Table', hint: 'markdown table', block: true, build: () => `| Column A | Column B |\n| --- | --- |\n| value | value |\n| value | value |` },
  { label: 'Divider', hint: 'horizontal rule', block: true, build: () => `---` },
]

function insertAtCursor(
  el: HTMLTextAreaElement,
  value: string,
  setValue: (v: string) => void,
  make: (sel: string) => string,
  asBlock: boolean,
) {
  const start = el.selectionStart
  const end = el.selectionEnd
  const sel = value.slice(start, end)
  let snippet = make(sel)
  // Block-level snippets need blank lines around them so the parser separates them.
  if (asBlock) {
    const before = value.slice(0, start)
    const after = value.slice(end)
    const needLeadBreak = before && !before.endsWith('\n\n')
    const needTrailBreak = after && !after.startsWith('\n\n')
    snippet = `${needLeadBreak ? '\n\n' : ''}${snippet}${needTrailBreak ? '\n\n' : ''}`
  }
  const next = value.slice(0, start) + snippet + value.slice(end)
  setValue(next)
  requestAnimationFrame(() => {
    el.focus()
    const pos = start + snippet.length
    el.setSelectionRange(pos, pos)
  })
}

export function BlogBodyEditor({
  body,
  setBody,
  bodyRef,
  onUploadImage,
  uploading,
}: {
  body: string
  setBody: (v: string) => void
  bodyRef: RefObject<HTMLTextAreaElement | null>
  /** Uploads a file, returns its public URL (or null on failure). */
  onUploadImage: (file: File) => Promise<string | null>
  uploading: boolean
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [imgAlign, setImgAlign] = useState<'center' | 'wide' | 'default'>('center')
  const [showPreview, setShowPreview] = useState(true)

  // Preview blocks — same split the editor saves with (blank-line separated).
  const previewBlocks = useMemo(
    () => body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    [body],
  )

  const doInsert = (b: Block) => {
    const el = bodyRef.current
    if (!el) return
    insertAtCursor(el, body, setBody, b.build, !!b.block)
  }

  const insertLink = () => {
    const el = bodyRef.current
    if (!el) return
    const url = window.prompt('Link URL (e.g. /steal-a-brainrot/values or https://…)')
    if (!url?.trim()) return
    insertAtCursor(el, body, setBody, (sel) => `[${sel || 'link text'}](${url.trim()})`, false)
  }

  const handleImage = async (file: File) => {
    const url = await onUploadImage(file)
    if (!url) return
    const el = bodyRef.current
    const altToken = imgAlign === 'default' ? 'Image' : imgAlign
    if (el) {
      insertAtCursor(el, body, setBody, () => `![${altToken}](${url})`, true)
    } else {
      setBody(`${body.trimEnd()}\n\n![${altToken}](${url})\n\n`)
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="-mx-4 mb-2 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {BLOCKS.map((b) => (
          <button
            key={b.label}
            type="button"
            title={b.hint}
            onClick={() => doInsert(b)}
            className="h-8 shrink-0 rounded-md bg-white/[0.06] px-2.5 text-[12.5px] font-medium text-text-secondary transition-colors hover:bg-white/[0.10] hover:text-text-primary"
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          onClick={insertLink}
          className="h-8 shrink-0 rounded-md bg-white/[0.06] px-2.5 text-[12.5px] font-medium text-text-secondary transition-colors hover:bg-white/[0.10] hover:text-text-primary"
        >
          Link
        </button>

        <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-white/[0.10]" />

        {/* Image insert with alignment choice */}
        <select
          value={imgAlign}
          onChange={(e) => setImgAlign(e.target.value as typeof imgAlign)}
          className="h-8 shrink-0 cursor-pointer rounded-md bg-white/[0.06] px-2 text-[12.5px] text-text-secondary [&>option]:bg-bg-raised"
          title="Image alignment"
          aria-label="Image alignment"
        >
          <option value="center">Center</option>
          <option value="wide">Wide</option>
          <option value="default">Full-width</option>
        </select>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImage(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="h-8 shrink-0 rounded-md bg-lime-tint-bg px-2.5 text-[12.5px] font-semibold text-lime-text transition-colors hover:bg-[color-mix(in_srgb,var(--color-lime)_22%,transparent)] disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : '+ Image'}
        </button>
      </div>

      {/* ── Editor (full width) — write markdown here. ── */}
      <textarea
        ref={bodyRef as RefObject<HTMLTextAreaElement>}
        aria-label="Post body (markdown)"
        className="min-h-[380px] w-full resize-y rounded-md border border-transparent bg-bg-overlay px-4 py-3 text-base leading-7 text-text-primary placeholder:text-text-disabled transition-colors hover:border-white/[0.08] focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft sm:text-[14px]"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={'Paste your blog markdown here.\n\n## A section\n\nA paragraph with **bold** and a [link](/values).\n\n1. A numbered step\n2. Another step'}
        spellCheck
      />

      <p className="mt-1.5 text-[12px] leading-relaxed text-text-tertiary">
        Paste markdown, or use the toolbar to insert blocks at your cursor. Supports headings,
        bullet / numbered lists, callouts, steps, tables, quotes, centered images, links,{' '}
        <strong className="text-text-secondary">**bold**</strong> and <em className="text-text-secondary">*italic*</em>.
        Leave a blank line between blocks.
      </p>

      {/* ── Live preview BELOW, at FULL page width — renders exactly like the
          published article (same ArticleBody + article column width). ── */}
      <div className="mt-6 border-t border-white/[0.06] pt-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-text-primary">Live Preview</span>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="h-8 rounded-md bg-white/[0.06] px-3 text-[12.5px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.10] hover:text-text-primary"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
        {showPreview && (
          <div className="rounded-md bg-bg-base px-4 py-6 sm:px-8">
            {/* Match the real article's reading column (max-w-[760px] on the live
                page) so line lengths/layout are identical, not squished. */}
            <div className="mx-auto w-full max-w-[760px]">
              {previewBlocks.length ? (
                <ArticleBody body={previewBlocks} />
              ) : (
                <p className="text-sm text-[#5E685E]">Start writing — the preview renders here exactly as it will publish.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
