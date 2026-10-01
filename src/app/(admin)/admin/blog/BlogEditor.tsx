'use client'

import { slugify } from '@/lib/utils'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast as notify } from 'sonner'
import { CircleNotch, Eye, FloppyDisk, UploadSimple } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { accountInputCls } from '@/components/account/AccountSurface'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { StatusBadge, adminBtn, type ChipTone } from '../components/kit'
import { imageTooLargeMessage, uploadErrorMessage } from '@/lib/uploads/image-upload'
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

const label = 'mb-1.5 block text-[13px] font-medium text-text-secondary'
const field = accountInputCls
const selectField = cn(accountInputCls, 'h-10 cursor-pointer py-0')
const hintCls = 'mt-1.5 text-[12px] text-text-tertiary'
const card = 'rounded-lg bg-bg-raised p-4 sm:p-5'

const STATUS_TONE: Record<BlogStatus, ChipTone> = {
  draft: 'warning',
  published: 'success',
  archived: 'neutral',
}

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
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

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
    const tooLarge = imageTooLargeMessage(file)
    if (tooLarge) return setError(tooLarge)
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
      setError(uploadErrorMessage(e))
    } finally {
      setUploading(null)
    }
  }

  /** Upload a body image and RETURN its URL — the split editor places it at the
   * cursor (with alignment), rather than appending to the end. */
  const uploadBodyImage = async (file: File): Promise<string | null> => {
    setError(null)
    const tooLarge = imageTooLargeMessage(file)
    if (tooLarge) {
      setError(tooLarge)
      return null
    }
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
      setError(uploadErrorMessage(e))
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
      notify.success(post ? 'Blog updated' : 'Blog created')
      router.refresh()
    })
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'content', label: 'Content' },
    { id: 'cover', label: 'Cover' },
    { id: 'seo', label: 'SEO' },
    { id: 'settings', label: 'Settings' },
  ]
  return (
    <div className="space-y-4 pb-6">
      {/* Tabs (left) · status (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs<Tab> tabs={TABS} value={tab} onChange={setTab} layoutId="blog-editor-tabs" ariaLabel="Post sections" />
        <StatusBadge status={status} tone={STATUS_TONE[status] ?? 'neutral'} className="px-2.5 py-1 text-[12px]" />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-error-bg px-3.5 py-2.5 text-[13px] text-error">
          {error}
        </p>
      )}

      <div role="tabpanel" id={`blog-editor-tabs-panel-${tab}`} aria-labelledby={`blog-editor-tabs-tab-${tab}`}>
      {/* ── CONTENT tab: title + slug always visible, then full-width body ── */}
      {tab === 'content' && (
        <div className="space-y-4">
          <div className={cn(card, 'grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
            <div>
              <label htmlFor="blog-title" className={label}>Title</label>
              <input
                id="blog-title"
                className={field}
                value={title}
                onChange={(e) => onTitle(e.target.value)}
                placeholder="Steal a Brainrot Value List (July 2026)"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="blog-slug" className={label}>Slug (URL)</label>
              <input
                id="blog-slug"
                className={cn(field, 'font-mono')}
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(slugify(e.target.value))
                }}
                placeholder="value-list"
              />
              <p className={cn(hintCls, 'truncate font-mono')}>
                {primaryGame ? `/${primaryGame}/blog/${slug || '…'}` : `/blog/${slug || '…'}`}
              </p>
            </div>
          </div>
          <div className={card}>
            <p className="mb-3 text-[15px] font-semibold text-text-primary">Body</p>
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
        <div className={cn(card, 'max-w-3xl space-y-5')}>
          <div>
            <label htmlFor="blog-excerpt" className={label}>Excerpt</label>
            <textarea
              id="blog-excerpt"
              className={cn(field, 'resize-none')}
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="One-sentence summary shown on cards and in search."
            />
            <p className={hintCls}>Shown on the blog cards and in search results.</p>
          </div>
          <div>
            <label htmlFor="blog-cover" className={label}>Cover Image</label>
            <div className="flex items-center gap-2">
              <input
                id="blog-cover"
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
                className={cn(adminBtn.secondary, 'shrink-0')}
              >
                {uploading === 'cover' ? (
                  <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadSimple aria-hidden weight="bold" className="h-4 w-4" />
                )}
                {uploading === 'cover' ? 'Uploading…' : 'Upload'}
              </button>
            </div>
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt="Cover preview"
                className="mt-3 aspect-[16/9] w-full max-w-md rounded-md object-cover"
              />
            )}
          </div>
        </div>
      )}

      {/* ── SEO tab ── */}
      {tab === 'seo' && (
        <div className={cn(card, 'max-w-3xl space-y-5')}>
          <div>
            <label htmlFor="blog-seo-title" className={label}>SEO Title (Optional)</label>
            <input id="blog-seo-title" className={field} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Falls back to the post title" />
          </div>
          <div>
            <label htmlFor="blog-seo-description" className={label}>SEO Description (Optional)</label>
            <textarea id="blog-seo-description" className={cn(field, 'resize-none')} rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Falls back to the excerpt" />
          </div>
        </div>
      )}

      {/* ── SETTINGS tab ── */}
      {tab === 'settings' && (
        <div className={cn(card, 'grid max-w-3xl gap-5 sm:grid-cols-2')}>
          <div>
            <label htmlFor="blog-status" className={label}>Status</label>
            <select id="blog-status" className={selectField} value={status} onChange={(e) => setStatus(e.target.value as BlogStatus)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label htmlFor="blog-type" className={label}>Post Type</label>
            <select id="blog-type" className={selectField} value={postType} onChange={(e) => setPostType(e.target.value as BlogPostType)}>
              <option value="value">Value List</option>
              <option value="seller">Seller Guide</option>
              <option value="guide">General Guide</option>
            </select>
          </div>
          <div>
            <label htmlFor="blog-game" className={label}>Game</label>
            <select id="blog-game" className={selectField} value={primaryGame} onChange={(e) => setPrimaryGame(e.target.value)}>
              <option value="">General (No Game)</option>
              {games.map((g) => (
                <option key={g.slug} value={g.slug}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="blog-author" className={label}>Author</label>
            <input id="blog-author" className={field} value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div>
            <label htmlFor="blog-read-minutes" className={label}>Read Minutes</label>
            <input
              id="blog-read-minutes"
              type="number"
              className={cn(field, 'tabular-nums')}
              value={readMinutes}
              onChange={(e) => setReadMinutes(Number(e.target.value))}
              min={1}
            />
          </div>
        </div>
      )}
      </div>

      {/* Sticky action bar: preview · cancel · save */}
      <div className="pointer-events-none sticky bottom-4 z-10 flex justify-end">
      <div className="pointer-events-auto flex w-full items-center gap-2 rounded-lg bg-bg-overlay-2 p-2 sm:w-auto">
        <button type="button" onClick={() => setPreviewOpen(true)} className={cn(adminBtn.secondary, 'mr-auto sm:mr-0')}>
          <Eye aria-hidden weight="bold" className="h-4 w-4" />
          Preview
        </button>
        <button type="button" onClick={() => router.push('/admin/blog')} className={adminBtn.secondary}>
          Cancel
        </button>
        <button type="button" onClick={save} disabled={pending} className={adminBtn.primary}>
          {pending ? (
            <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
          ) : (
            <FloppyDisk aria-hidden weight="bold" className="h-4 w-4" />
          )}
          {pending ? 'Saving…' : post ? 'Save Changes' : 'Create Post'}
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
