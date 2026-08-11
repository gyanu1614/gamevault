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
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {BLOCKS.map((b) => (
          <button
            key={b.label}
            type="button"
            title={b.hint}
            onClick={() => doInsert(b)}
            className="border border-white/15 px-2.5 py-1 text-[12px] font-medium text-gray-200 transition hover:border-white/30 hover:bg-white/[0.04]"
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          onClick={insertLink}
          className="border border-white/15 px-2.5 py-1 text-[12px] font-medium text-gray-200 transition hover:border-white/30 hover:bg-white/[0.04]"
        >
          Link
        </button>

        <span className="mx-1 h-4 w-px bg-white/10" />

        {/* Image insert with alignment choice */}
        <select
          value={imgAlign}
          onChange={(e) => setImgAlign(e.target.value as typeof imgAlign)}
          className="border border-white/15 bg-transparent px-1.5 py-1 text-[12px] text-gray-300"
          title="Image alignment"
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
          className="border border-lime/50 px-2.5 py-1 text-[12px] font-semibold text-lime-text transition hover:bg-lime/10 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : '+ Image'}
        </button>
      </div>

      {/* ── Editor (full width) — write markdown here. ── */}
      <textarea
        ref={bodyRef as RefObject<HTMLTextAreaElement>}
        className="min-h-[380px] w-full resize-y rounded-lg border border-white/15 bg-white/[0.03] px-4 py-3 text-[14px] leading-7 text-white outline-none transition focus:border-lime/60"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={'Paste your blog markdown here.\n\n## A section\n\nA paragraph with **bold** and a [link](/values).\n\n1. A numbered step\n2. Another step'}
        spellCheck
      />

      <p className="mt-1.5 text-xs text-gray-500">
        Paste markdown, or use the toolbar to insert blocks at your cursor. Supports headings,
        bullet / numbered lists, callouts, steps, tables, quotes, centered images, links,{' '}
        <strong className="text-gray-300">**bold**</strong> and <em className="text-gray-300">*italic*</em>.
        Leave a blank line between blocks.
      </p>

      {/* ── Live preview BELOW, at FULL page width — renders exactly like the
          published article (same ArticleBody + article column width). ── */}
      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Live preview
          </span>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] font-semibold text-gray-300 transition hover:border-white/30"
          >
            {showPreview ? 'Hide preview' : 'Show preview'}
          </button>
        </div>
        {showPreview && (
          <div className="border border-[#1E2723] bg-[#0B0F0C] px-4 py-6 sm:px-8">
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
