'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CaretDown, CaretLeft, CircleNotch, Image as ImageIcon, Newspaper, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import {
  type AdminBlogPost,
  setBlogPostStatus,
  deleteBlogPost,
} from '@/lib/actions/admin-blog'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { AdminEmpty, StatusBadge, adminBtn, adminBtnSm, type ChipTone } from '../components/kit'
import { GameTile } from '../components/GameTile'

const TYPE_LABEL: Record<string, string> = {
  guide: 'Guide',
  value: 'Value List',
  seller: 'Seller',
}

const STATUS_TONE: Record<string, ChipTone> = {
  published: 'success',
  draft: 'warning',
  archived: 'neutral',
}

export interface BlogGameOption {
  name: string
  slug: string
  imageUrl: string | null
}

const TILE =
  'flex min-w-0 items-center gap-3 rounded-lg bg-bg-raised p-3.5 text-left transition-colors hover:bg-bg-raised-hover'

export function BlogListClient({
  posts,
  games,
}: {
  posts: AdminBlogPost[]
  /** All active games — drives the per-game rail. A game added in admin
   *  appears here automatically with a zero count. */
  games: BlogGameOption[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  // null = games overview; 'all' | 'general' | a game slug = posts view
  const [selected, setSelected] = useState<string | null>(null)
  // Empty (0-post) games are collapsed by default so games WITH content lead.
  const [showEmpty, setShowEmpty] = useState(false)
  /** Post waiting for the delete confirmation. */
  const [confirmDelete, setConfirmDelete] = useState<AdminBlogPost | null>(null)

  const countBySlug = posts.reduce<Record<string, number>>((acc, p) => {
    const key = p.primary_game_slug || 'general'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const visiblePosts =
    selected === 'all' || selected === null
      ? posts
      : posts.filter((p) => (p.primary_game_slug || 'general') === selected)

  const selectedGame = games.find((g) => g.slug === selected)

  const togglePublish = (post: AdminBlogPost) => {
    setBusyId(post.id)
    const next = post.status === 'published' ? 'draft' : 'published'
    startTransition(async () => {
      await setBlogPostStatus(post.id, next)
      setBusyId(null)
      router.refresh()
    })
  }

  const remove = (post: AdminBlogPost) => {
    setConfirmDelete(null)
    setBusyId(post.id)
    startTransition(async () => {
      await deleteBlogPost(post.id)
      setBusyId(null)
      router.refresh()
    })
  }

  const deleteDialog = (
    <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
      <DialogContent className="max-w-[460px] border-0 p-5 sm:p-6">
        <div className="pr-8">
          <DialogTitle className="text-[18px] font-bold leading-tight">Delete This Post?</DialogTitle>
          <DialogDescription className="mt-1.5 leading-relaxed">
            &ldquo;{confirmDelete?.title || 'Untitled'}&rdquo; is removed for good. This cannot be undone.
          </DialogDescription>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirmDelete(null)} className={adminBtn.secondary}>
            Cancel
          </button>
          <button type="button" onClick={() => confirmDelete && remove(confirmDelete)} className={adminBtn.danger}>
            <Trash aria-hidden weight="bold" className="h-4 w-4" />
            Delete Post
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )

  // ── Games overview — the landing view. Games WITH posts lead; empty games
  //    (0 posts) collapse behind a toggle so the page isn't 20 dead tiles. ──
  if (selected === null) {
    const gamesWithPosts = games.filter((g) => (countBySlug[g.slug] ?? 0) > 0)
    const emptyGames = games.filter((g) => (countBySlug[g.slug] ?? 0) === 0)

    return (
      <div className="space-y-6">
        {/* Quick access: All + General. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button type="button" onClick={() => setSelected('all')} className={TILE}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-lime-tint-bg text-lime-text">
              <Newspaper aria-hidden weight="bold" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-text-primary">All Posts</span>
              <span className="block text-[12px] text-text-tertiary">{posts.length} total</span>
            </span>
          </button>
          <button type="button" onClick={() => setSelected('general')} className={TILE}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/[0.06] text-text-secondary">
              <Newspaper aria-hidden weight="bold" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-text-primary">General</span>
              <span className="block text-[12px] text-text-tertiary">{countBySlug.general ?? 0} posts · no game</span>
            </span>
          </button>
        </div>

        {/* Games with content — the ones you actually manage. */}
        {gamesWithPosts.length > 0 && (
          <section>
            <h2 className="mb-3 text-[14px] font-semibold text-text-primary">Games With Posts</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gamesWithPosts.map((g) => {
                const count = countBySlug[g.slug] ?? 0
                return (
                  <button key={g.slug} type="button" onClick={() => setSelected(g.slug)} className={TILE}>
                    <GameTile src={g.imageUrl} name={g.name} className="h-10 w-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-text-primary">{g.name}</span>
                      <span className="block text-[12px] text-text-tertiary">
                        {count} {count === 1 ? 'post' : 'posts'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Empty games — collapsed so they don't bury the active ones. */}
        {emptyGames.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowEmpty((v) => !v)}
              aria-expanded={showEmpty}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              <CaretDown aria-hidden weight="bold" className={cn('h-3.5 w-3.5 transition-transform', !showEmpty && '-rotate-90')} />
              {emptyGames.length} games with no posts yet
            </button>
            {showEmpty && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {emptyGames.map((g) => (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => setSelected(g.slug)}
                    className="flex min-w-0 items-center gap-2 rounded-md bg-bg-raised px-3 py-2 text-left transition-colors hover:bg-bg-raised-hover"
                  >
                    <GameTile src={g.imageUrl} name={g.name} className="h-6 w-6 text-[11px]" />
                    <span className="truncate text-[13px] text-text-secondary">{g.name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        {deleteDialog}
      </div>
    )
  }

  // ── Posts view for the chosen game ──
  const heading =
    selected === 'all' ? 'All Posts' : selected === 'general' ? 'General Posts' : selectedGame?.name ?? selected

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
            Games
          </button>
          <span aria-hidden className="h-4 w-px bg-white/[0.10]" />
          <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-text-primary">
            {selectedGame && <GameTile src={selectedGame.imageUrl} name={selectedGame.name} className="h-6 w-6 text-[11px]" />}
            <span className="truncate">{heading}</span>
            <span className="font-normal tabular-nums text-text-tertiary">{visiblePosts.length}</span>
          </span>
        </div>
        {selected !== 'all' && selected !== 'general' && (
          <Link href={`/admin/blog/new?game=${selected}`} className={adminBtnSm.secondary}>
            <Plus aria-hidden weight="bold" className="h-3.5 w-3.5" />
            New {selectedGame?.name ?? selected} Post
          </Link>
        )}
      </div>

      {visiblePosts.length === 0 ? (
        <AdminEmpty
          icon={Newspaper}
          title="No Posts Yet"
          hint={
            selected === 'all'
              ? 'Click New Post to write one.'
              : 'No posts for this game yet. Use the button above to write the first one.'
          }
        />
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-lg bg-bg-raised">
          {visiblePosts.map((post) => {
            const isBusy = busyId === post.id && pending
            const gameLabel = post.primary_game_slug || 'general'
            return (
              <li key={post.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                  {/* Cover thumbnail (or a placeholder tile). */}
                  <Link
                    href={`/admin/blog/${post.id}`}
                    className="relative aspect-[16/10] w-20 shrink-0 overflow-hidden rounded-md bg-white/[0.05] sm:w-28"
                    aria-label={`Edit ${post.title || 'untitled post'}`}
                  >
                    {post.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-text-disabled">
                        <ImageIcon aria-hidden weight="bold" className="h-5 w-5" />
                      </span>
                    )}
                  </Link>

                  {/* Title + meta. */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/blog/${post.id}`}
                        className="line-clamp-2 text-[14px] font-semibold text-text-primary underline-offset-4 hover:underline sm:text-[15px]"
                      >
                        {post.title || <span className="text-text-tertiary">(untitled)</span>}
                      </Link>
                      <StatusBadge status={post.status} tone={STATUS_TONE[post.status] ?? 'neutral'} className="shrink-0 sm:hidden" />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-text-tertiary">
                      <span className="text-text-secondary">{TYPE_LABEL[post.post_type] ?? post.post_type}</span>
                      <span aria-hidden>·</span>
                      <span>{gameLabel}</span>
                      <span aria-hidden>·</span>
                      <span>{post.updated_at ? `updated ${new Date(post.updated_at).toLocaleDateString()}` : '—'}</span>
                    </div>
                  </div>
                </div>

                <StatusBadge status={post.status} tone={STATUS_TONE[post.status] ?? 'neutral'} className="hidden shrink-0 sm:inline-flex" />

                {/* Actions. */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => togglePublish(post)}
                    disabled={isBusy}
                    className={cn(post.status === 'published' ? adminBtnSm.secondary : adminBtnSm.primary, 'flex-1 sm:flex-none')}
                  >
                    {isBusy && <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />}
                    {post.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <Link href={`/admin/blog/${post.id}`} className={cn(adminBtnSm.secondary, 'flex-1 sm:flex-none')}>
                    <PencilSimple aria-hidden weight="bold" className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(post)}
                    disabled={isBusy}
                    className={cn(adminBtnSm.danger, 'flex-1 sm:flex-none')}
                  >
                    <Trash aria-hidden weight="bold" className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {deleteDialog}
    </div>
  )
}
