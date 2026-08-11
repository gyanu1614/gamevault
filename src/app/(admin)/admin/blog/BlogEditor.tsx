'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  type AdminBlogPost,
  type BlogPostInput,
  type BlogPostType,
  type BlogStatus,
  insertBlogPost,
  updateBlogPost,
  uploadBlogImage,
} from '@/lib/actions/admin-blog'
import { BlogPreview } from './BlogPreview'
import { BlogBodyEditor } from './BlogBodyEditor'

/** Read a File into the base64 payload uploadBlogImage expects. */
function fileToPayload(
  file: File,
): Promise<{ name: string; type: string; size: number; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        base64: String(reader.result),
      })
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

type GameOption = { slug: string; name: string }

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400'
const field =
  'w-full rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition focus:border-lime/60'

export function BlogEditor({
  post,
  games,
  defaultGameSlug,
}: {
  /** Existing post when editing; undefined when creating. */
  post?: AdminBlogPost
  games: GameOption[]
  /** Pre-selects the game when creating from a game's admin view. */
  defaultGameSlug?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const toastTimer = useRef<number>(0)

  const [title, setTitle] = useState(post?.title ?? '')
  const [slug, setSlug] = useState(post?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!!post)
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '')
  const [author, setAuthor] = useState(post?.author ?? 'DropMarket Team')
  const [readMinutes, setReadMinutes] = useState(post?.read_minutes ?? 5)
  const [postType, setPostType] = useState<BlogPostType>(post?.post_type ?? 'value')
  const [status, setStatus] = useState<BlogStatus>(post?.status ?? 'draft')
  const [primaryGame, setPrimaryGame] = useState(
    post?.primary_game_slug ?? defaultGameSlug ?? '',
  )
  const [coverUrl, setCoverUrl] = useState(post?.cover_url ?? '')
  const [body, setBody] = useState((post?.body ?? []).join('\n\n'))
  const [uploading, setUploading] = useState<'cover' | 'body' | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  const handleUpload = async (file: File, target: 'cover' | 'body') => {
    setError(null)
    setUploading(target)
    try {
      const payload = await fileToPayload(file)
      const res = await uploadBlogImage(payload)
      if (!res.success) {
        setError(res.error)
        return
      }
      if (target === 'cover') setCoverUrl(res.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(null)
    }
  }

  /** Upload a body image and RETURN its URL — the split editor places it at the
   * cursor (with alignment), rather than appending to the end. */
  const uploadBodyImage = async (file: File): Promise<string | null> => {
    setError(null)
    setUploading('body')
    try {
      const payload = await fileToPayload(file)
      const res = await uploadBlogImage(payload)
      if (!res.success) {
        setError(res.error)
        return null
      }
      return res.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      return null
    } finally {
      setUploading(null)
    }
  }
  const [seoTitle, setSeoTitle] = useState(post?.seo_title ?? '')
  const [seoDescription, setSeoDescription] = useState(post?.seo_description ?? '')

  const onTitle = (v: string) => {
    setTitle(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  type Tab = 'content' | 'cover' | 'seo' | 'settings'
  const [tab, setTab] = useState<Tab>('content')

  const save = () => {
    setError(null)
    if (!title.trim()) return setError('Title is required.')
    if (!slug.trim()) return setError('Slug is required.')

    const input: BlogPostInput = {
      slug: slug.trim(),
      title: title.trim(),
      excerpt: excerpt.trim(),
      author: author.trim() || 'DropMarket Team',
      read_minutes: Number(readMinutes) || 5,
      post_type: postType,
      status,
      primary_game_slug: primaryGame || null,
      // A game-scoped post is tagged with its own game so rails pick it up.
      game_slugs: primaryGame ? [primaryGame] : [],
      cover_url: coverUrl.trim() || null,
      // Split on blank lines → one entry per paragraph (matches BlogPost.body).
      body: body
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
    }

    startTransition(async () => {
      const res = post ? await updateBlogPost(post.id, input) : await insertBlogPost(input)
      if (!res.success) {
        setError(res.error || 'Failed to save.')
        return
      }
      // Stay on the editor and confirm with a toast (no jarring redirect to the
      // list). refresh() re-runs the server component so the saved data is fresh.
      setToast(post ? 'Blog updated' : 'Blog created')
      router.refresh()
      window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), 3000)
    })
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'content', label: 'Content' },
    { id: 'cover', label: 'Cover' },
    { id: 'seo', label: 'SEO' },
    { id: 'settings', label: 'Settings' },
  ]
  const statusTone =
    status === 'published'
      ? { dot: 'bg-lime', text: 'text-lime-text' }
      : status === 'archived'
        ? { dot: 'bg-gray-500', text: 'text-gray-400' }
        : { dot: 'bg-amber-400', text: 'text-amber-300' }

  return (
    <div className="pb-24">
      {/* ── Sticky action bar: tabs (left) · status + actions (right) ── */}
      <div className="sticky top-0 z-30 -mx-4 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0B0F0C]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition ${
                tab === t.id ? 'bg-lime text-black' : 'text-gray-300 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize ${statusTone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} />
            {status}
          </span>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="rounded-lg border border-white/15 px-3.5 py-2 text-[13px] font-semibold text-gray-200 transition hover:border-white/30"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/blog')}
            className="rounded-lg border border-white/15 px-3.5 py-2 text-[13px] font-semibold text-gray-300 transition hover:border-white/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-lime px-4 py-2 text-[13px] font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Saving…' : post ? 'Save changes' : 'Create post'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── CONTENT tab: title + slug always visible, then full-width body ── */}
      {tab === 'content' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              <label className={label}>Title</label>
              <input
                className={field}
                value={title}
                onChange={(e) => onTitle(e.target.value)}
                placeholder="Steal a Brainrot Value List (July 2026)"
              />
            </div>
            <div>
              <label className={label}>Slug (URL)</label>
              <input
                className={field}
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(slugify(e.target.value))
                }}
                placeholder="value-list"
              />
              <p className="mt-1 truncate text-xs text-gray-500">
                {primaryGame ? `/${primaryGame}/blog/${slug || '…'}` : `/blog/${slug || '…'}`}
              </p>
            </div>
          </div>
          <div>
            <label className={label}>Body</label>
            <BlogBodyEditor
              body={body}
              setBody={setBody}
              bodyRef={bodyRef}
              onUploadImage={uploadBodyImage}
              uploading={uploading === 'body'}
            />
          </div>
        </div>
      )}

      {/* ── COVER tab: excerpt + cover image ── */}
      {tab === 'cover' && (
        <div className="max-w-2xl space-y-5">
          <div>
            <label className={label}>Excerpt</label>
            <textarea
              className={field}
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="One-sentence summary shown on cards and in search."
            />
            <p className="mt-1 text-xs text-gray-500">Shown on the blog cards and in search results.</p>
          </div>
          <div>
            <label className={label}>Cover image</label>
            <div className="flex items-center gap-2">
              <input
                className={field}
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="Upload or paste a URL"
              />
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleUpload(f, 'cover')
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploading !== null}
                className="shrink-0 rounded-lg border border-lime/50 px-3 py-2 text-xs font-semibold text-lime-text transition hover:bg-lime/10 disabled:opacity-50"
              >
                {uploading === 'cover' ? 'Uploading…' : 'Upload'}
              </button>
            </div>
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt="Cover preview"
                className="mt-3 aspect-[16/9] w-full max-w-md rounded-lg border border-white/10 object-cover"
              />
            )}
          </div>
        </div>
      )}

      {/* ── SEO tab ── */}
      {tab === 'seo' && (
        <div className="max-w-2xl space-y-5">
          <div>
            <label className={label}>SEO title (optional)</label>
            <input className={field} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Falls back to the post title" />
          </div>
          <div>
            <label className={label}>SEO description (optional)</label>
            <textarea className={field} rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Falls back to the excerpt" />
          </div>
        </div>
      )}

      {/* ── SETTINGS tab ── */}
      {tab === 'settings' && (
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          <div>
            <label className={label}>Status</label>
            <select className={field} value={status} onChange={(e) => setStatus(e.target.value as BlogStatus)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className={label}>Post type</label>
            <select className={field} value={postType} onChange={(e) => setPostType(e.target.value as BlogPostType)}>
              <option value="value">Value list</option>
              <option value="seller">Seller guide</option>
              <option value="guide">General guide</option>
            </select>
          </div>
          <div>
            <label className={label}>Game</label>
            <select className={field} value={primaryGame} onChange={(e) => setPrimaryGame(e.target.value)}>
              <option value="">General (no game)</option>
              {games.map((g) => (
                <option key={g.slug} value={g.slug}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Author</label>
            <input className={field} value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div>
            <label className={label}>Read minutes</label>
            <input
              type="number"
              className={field}
              value={readMinutes}
              onChange={(e) => setReadMinutes(Number(e.target.value))}
              min={1}
            />
          </div>
        </div>
      )}

      {/* Save confirmation toast — stays on the editor, no redirect. */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-lime/40 bg-[#0E1211] px-4 py-3 text-sm font-semibold text-lime-text shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)]">
          <span aria-hidden className="h-2 w-2 rounded-full bg-lime" />
          {toast}
        </div>
      )}

      {/* Live preview — renders from current editor state, no save needed. */}
      <BlogPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        gameSlug={primaryGame || null}
        slug={slug}
        title={title}
        excerpt={excerpt}
        author={author}
        readMinutes={readMinutes}
        postType={postType}
        coverUrl={coverUrl}
        body={body}
      />
    </div>
  )
}
