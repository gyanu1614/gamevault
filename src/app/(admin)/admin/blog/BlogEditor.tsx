'use client'

/**
 * Write or edit a post (2026-10-12 block editor).
 *
 * Left: title, the one- or two-line summary under it, then the body. Right:
 * what's still needed, game / type / URL / author, cover, Google preview.
 * Bottom bar: status, save state, Preview, Save Draft / Publish / Update.
 *
 * Saving: ONE action for create and update (saveBlogPost). After the first
 * save the address becomes /admin/blog/<id> in place, so a second save can
 * never make a copy. Drafts save themselves 3 s after you stop typing; a
 * live post changes only when you press Update. Old (markdown) posts open
 * converted to blocks and keep the new format from their next save.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AdminBlogPost, BlogStatus } from '@/lib/actions/admin-blog'
import { saveBlogPost, type SaveBlogPostInput } from '@/lib/actions/admin-blog-save'
import { postChecklist, slugify } from '@/lib/blog/editor/checklist'
import { readBody } from '@/lib/blog/doc/body'
import type { BlogDoc, StoredImage } from '@/lib/blog/doc/types'
import { BlockEditor } from './_editor/BlockEditor'
import { EditorGameContext } from './_editor/node-views'
import { Checklist, CoverPicker, PostSettings, SearchPreview, type Meta, type PostType } from './_editor/SidePanel'
import { Preview } from './_editor/Preview'
import { ActionBar } from './_editor/ActionBar'
import { TEMPLATES } from './_editor/templates'

type GameOption = { slug: string; name: string }
type TemplateKey = keyof typeof TEMPLATES

const AUTOSAVE_MS = 3000

function grow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/** New post: pick an outline first (each is just headings to fill in). */
function TemplatePicker({ onPick }: { onPick: (k: TemplateKey) => void }) {
  const hint: Record<TemplateKey, string> = {
    blank: 'An empty page.',
    guide: 'Short answer, steps, mistakes, FAQ.',
    codes: 'Codes table with copy buttons, how to redeem, FAQ.',
    tier: 'How we ranked them, then S / A / B tiers.',
    news: 'What changed and what it means for prices.',
  }
  return (
    <div className="rounded-[10px] bg-[#1D1E23] p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">Start From</h2>
      <p className="mt-1 text-[13px] text-text-secondary">Pick an outline. You can change everything after.</p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            className="flex flex-col items-start rounded-lg bg-white/[0.04] p-4 text-left transition-colors hover:bg-white/[0.08]"
          >
            <span className="text-[14px] font-semibold text-text-primary">{TEMPLATES[k].label}</span>
            <span className="mt-1 text-[12.5px] leading-5 text-text-tertiary">{hint[k]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function BlogEditor({ post, games, defaultGameSlug }: { post?: AdminBlogPost; games: GameOption[]; defaultGameSlug?: string }) {
  const initial = useMemo(() => (post ? readBody(post.body) : null), [post])
  const [started, setStarted] = useState(!!post)
  const [docSeed, setDocSeed] = useState<BlogDoc>(initial?.doc ?? TEMPLATES.blank.doc)

  const [id, setId] = useState<string | null>(post?.id ?? null)
  const [status, setStatus] = useState<BlogStatus>(post?.status ?? 'draft')
  const [title, setTitle] = useState(post?.title ?? '')
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '')
  const [doc, setDoc] = useState<BlogDoc>(docSeed)
  const [cover, setCover] = useState<StoredImage | null>(initial?.cover ?? null)
  const [coverUrl, setCoverUrl] = useState<string | null>(initial?.cover ? null : post?.cover_url ?? null)
  const [meta, setMetaState] = useState<Meta>({
    gameSlug: post?.primary_game_slug ?? defaultGameSlug ?? '',
    postType: (post?.post_type as PostType) ?? 'guide',
    slug: post?.slug ?? '',
    author: post?.author ?? 'DropMarket Team',
    seoTitle: post?.seo_title ?? '',
    seoDescription: post?.seo_description ?? '',
  })
  const [slugTouched, setSlugTouched] = useState(!!post)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(post?.updated_at ?? null)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Every edit bumps `seq`; a save clears `dirty` only if nothing changed while it ran.
  const seq = useRef(0)
  const inFlight = useRef(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const excerptRef = useRef<HTMLTextAreaElement>(null)
  const touch = useCallback(() => {
    seq.current += 1
    setDirty(true)
  }, [])

  const setMeta = (patch: Partial<Meta>) => {
    setMetaState((m) => ({ ...m, ...patch }))
    touch()
  }
  const onTitle = (v: string) => {
    setTitle(v)
    if (!slugTouched) setMetaState((m) => ({ ...m, slug: slugify(v) }))
    touch()
  }
  const onDoc = useCallback((d: BlogDoc) => {
    setDoc(d)
    touch()
  }, [touch])

  const checks = postChecklist({
    title,
    slug: meta.slug,
    gameSlug: meta.gameSlug || null,
    excerpt,
    seoDescription: meta.seoDescription,
    hasCover: !!(cover || coverUrl),
    doc,
  })

  // Latest values for saves fired from timers.
  const latest = useRef<SaveBlogPostInput>()
  latest.current = {
    title,
    slug: meta.slug,
    excerpt,
    author: meta.author,
    postType: meta.postType,
    status,
    gameSlug: meta.gameSlug || null,
    coverUrl: cover ? null : coverUrl,
    cover,
    seoTitle: meta.seoTitle || null,
    seoDescription: meta.seoDescription || null,
    doc: doc as SaveBlogPostInput['doc'],
  }

  const save = useCallback(
    async (next: BlogStatus, opts: { quiet?: boolean } = {}) => {
      if (inFlight.current || !latest.current) return
      inFlight.current = true
      setSaving(true)
      setError(null)
      const startedAt = seq.current
      let res: Awaited<ReturnType<typeof saveBlogPost>>
      try {
        // ProseMirror builds attrs with null prototypes, which a server action
        // refuses ("only plain objects"): send a plain copy.
        const doc = JSON.parse(JSON.stringify(latest.current.doc)) as SaveBlogPostInput['doc']
        res = await saveBlogPost(id, { ...latest.current, doc, status: next })
      } catch {
        // Offline, or the server is restarting: keep the edits, say so, try again on the next change.
        res = { success: false, error: 'Could not reach the server. Your changes are still here; save again in a moment.' }
      } finally {
        inFlight.current = false
        setSaving(false)
      }
      if (!res.success) {
        setError(res.error)
        if (!opts.quiet) toast.error(res.error)
        return
      }
      if (!id) {
        setId(res.id)
        // Same screen, real address: no remount, and the next save updates this row.
        window.history.replaceState(null, '', `/admin/blog/${res.id}`)
      }
      setStatus(next)
      setSavedAt(res.updatedAt)
      if (seq.current === startedAt) setDirty(false)
      if (opts.quiet) return
      if (next === 'published' && status !== 'published') toast.success('Published', { description: `/${meta.gameSlug}/blog/${meta.slug}` })
      else if (next === 'draft' && status === 'published') toast.success('Moved back to draft. The page is no longer public.')
      else toast.success('Saved')
    },
    [id, status, meta.gameSlug, meta.slug],
  )

  // Drafts save themselves once a title exists (a live post waits for Update).
  useEffect(() => {
    if (!dirty || status !== 'draft' || !title.trim() || !meta.slug) return
    const t = setTimeout(() => void save('draft', { quiet: true }), AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [dirty, status, title, meta.slug, doc, excerpt, meta, cover, save])

  // Unsaved changes: ask before leaving.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Title and summary grow with their text — and again when the column's
  // width changes (window resize, side panel stacking), or a wrapped title
  // would show only its first line.
  useEffect(() => {
    const els = [titleRef.current, excerptRef.current].filter((el): el is HTMLTextAreaElement => !!el)
    els.forEach(grow)
    let width = els[0]?.clientWidth ?? 0
    const ro = new ResizeObserver(() => {
      const w = els[0]?.clientWidth ?? 0
      if (w === width) return
      width = w
      els.forEach(grow)
    })
    els.forEach((el) => ro.observe(el))
    return () => ro.disconnect()
  }, [started])

  if (!started) {
    return (
      <TemplatePicker
        onPick={(k) => {
          setDocSeed(TEMPLATES[k].doc)
          setDoc(TEMPLATES[k].doc)
          setMetaState((m) => ({ ...m, postType: TEMPLATES[k].postType }))
          setStarted(true)
        }}
      />
    )
  }

  const live = status === 'published'
  const blocked = checks.blocking.length > 0
  const gameName = games.find((g) => g.slug === meta.gameSlug)?.name ?? 'Game'
  const stateText = saving ? 'Saving…' : dirty ? (live ? 'Changes not live yet' : 'Unsaved changes') : savedAt ? 'All changes saved' : 'Not saved yet'

  return (
    <EditorGameContext.Provider value={meta.gameSlug || null}>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-[10px] bg-[#1D1E23] px-4 pb-2 pt-6 sm:px-6">
          {initial?.legacy && (
            <p className="mb-5 rounded-md bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-text-secondary">
              This post was written in the old editor and has been turned into blocks. Check it over; it keeps the new format from the next save.
            </p>
          )}
          <textarea
            ref={titleRef}
            rows={1}
            value={title}
            onChange={(e) => {
              onTitle(e.target.value)
              grow(e.target)
            }}
            placeholder="Post title"
            aria-label="Title"
            className="block w-full resize-none overflow-hidden bg-transparent text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-text-primary outline-none placeholder:text-text-tertiary sm:text-[34px]"
          />
          <textarea
            ref={excerptRef}
            rows={1}
            value={excerpt}
            onChange={(e) => {
              setExcerpt(e.target.value)
              touch()
              grow(e.target)
            }}
            placeholder="The answer in one or two lines. Shown under the title, on guide cards and on Google."
            aria-label="Summary"
            className="mt-3 block w-full resize-none overflow-hidden bg-transparent text-[17px] leading-[1.6] text-text-secondary outline-none placeholder:text-text-tertiary sm:text-[18px]"
          />
          <div className="mt-6">
            <BlockEditor initial={docSeed} onChange={onDoc} />
          </div>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-20">
          <Checklist items={checks.items} />
          <PostSettings meta={meta} set={setMeta} games={games} slugLocked={live} onSlugEdit={() => setSlugTouched(true)} />
          <CoverPicker
            cover={cover}
            coverUrl={coverUrl}
            onChange={(img) => {
              setCover(img)
              setCoverUrl(null)
              touch()
            }}
          />
          <SearchPreview meta={meta} set={setMeta} title={title} excerpt={excerpt} />
        </aside>
      </div>

      {/* Actions, always in reach: a full-width bottom bar on phones, a floating box on desktop. */}
      <ActionBar
        status={status}
        stateText={stateText}
        error={error}
        saving={saving}
        dirty={dirty}
        blocked={blocked}
        blockedText={blocked ? `Still needed: ${checks.blocking.map((x) => x.label.toLowerCase()).join(', ')}` : undefined}
        canSaveDraft={!!title.trim() && !!meta.slug}
        onPreview={() => setPreviewOpen(true)}
        onSave={(next) => void save(next)}
      />

      <Preview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        gameSlug={meta.gameSlug}
        gameName={gameName}
        postType={meta.postType}
        title={title}
        excerpt={excerpt}
        author={meta.author}
        cover={cover}
        coverUrl={coverUrl}
        doc={doc}
      />
    </EditorGameContext.Provider>
  )
}
