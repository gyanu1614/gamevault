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
  const bodyInputRef = useRef<HTMLInputElement | null>(null)

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
      if (target === 'cover') {
        setCoverUrl(res.url)
      } else {
        // Append as a markdown image paragraph the article renderer shows.
        setBody((b) => `${b.trimEnd()}\n\n![Image](${res.url})\n\n`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
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
      router.push('/admin/blog')
      router.refresh()
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Main column */}
      <div className="space-y-5">
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
          <p className="mt-1 text-xs text-gray-500">
            {primaryGame ? `/${primaryGame}/blog/${slug || '…'}` : `/blog/${slug || '…'}`}
          </p>
        </div>

        <div>
          <label className={label}>Excerpt</label>
          <textarea
            className={field}
            rows={2}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="One-sentence summary shown on cards and in search."
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className={label.replace('mb-1.5 block ', '')}>Body</label>
            <div>
              <input
                ref={bodyInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleUpload(f, 'body')
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => bodyInputRef.current?.click()}
                disabled={uploading !== null}
                className="rounded-lg border border-lime/50 px-3 py-1.5 text-xs font-semibold text-lime-text transition hover:bg-lime/10 disabled:opacity-50"
              >
                {uploading === 'body' ? 'Uploading…' : '+ Insert image'}
              </button>
            </div>
          </div>
          <textarea
            className={`${field} font-mono text-[13px] leading-6`}
            rows={18}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'Write in paragraphs.\n\nSeparate each paragraph with a blank line.'}
          />
          <p className="mt-1 text-xs text-gray-500">
            Separate paragraphs with a blank line. Use ## for section headings,
            - for bullets, and ![caption](url) for photos — Insert image
            uploads and appends one for you.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>SEO title (optional)</label>
            <input className={field} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
          </div>
          <div>
            <label className={label}>SEO description (optional)</label>
            <input
              className={field}
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="space-y-4">
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
              <select
                className={field}
                value={postType}
                onChange={(e) => setPostType(e.target.value as BlogPostType)}
              >
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
                  <option key={g.slug} value={g.slug}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
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
                className="mt-2 h-24 w-full rounded-md border border-white/10 object-cover"
              />
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex-1 rounded-lg bg-lime px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Saving…' : post ? 'Save changes' : 'Create post'}
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="rounded-lg border border-lime/50 px-4 py-2.5 text-sm font-semibold text-lime-text transition hover:bg-lime/10"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/blog')}
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:border-white/30"
          >
            Cancel
          </button>
        </div>
      </div>

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
