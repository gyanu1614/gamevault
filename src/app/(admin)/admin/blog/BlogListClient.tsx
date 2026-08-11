'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  type AdminBlogPost,
  setBlogPostStatus,
  deleteBlogPost,
} from '@/lib/actions/admin-blog'

const TYPE_LABEL: Record<string, string> = {
  guide: 'Guide',
  value: 'Value list',
  seller: 'Seller',
}

const STATUS_STYLE: Record<string, string> = {
  published: 'bg-green-500/15 text-green-400 border-green-500/30',
  draft: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  archived: 'bg-white/10 text-gray-400 border-white/15',
}

export interface BlogGameOption {
  name: string
  slug: string
  imageUrl: string | null
}

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
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return
    setBusyId(post.id)
    startTransition(async () => {
      await deleteBlogPost(post.id)
      setBusyId(null)
      router.refresh()
    })
  }

  // ── Games overview — the landing view. Games WITH posts lead; empty games
  //    (0 posts) collapse behind a toggle so the page isn't 20 dead tiles. ──
  if (selected === null) {
    const gamesWithPosts = games.filter((g) => (countBySlug[g.slug] ?? 0) > 0)
    const emptyGames = games.filter((g) => (countBySlug[g.slug] ?? 0) === 0)

    const GameCard = ({ g }: { g: BlogGameOption }) => {
      const count = countBySlug[g.slug] ?? 0
      return (
        <button
          type="button"
          onClick={() => setSelected(g.slug)}
          className="group flex items-center gap-3 border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-lime/50 hover:bg-white/[0.04]"
        >
          <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.04] text-sm font-bold text-gray-500">
            {g.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              g.name.charAt(0).toUpperCase()
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-white transition-colors group-hover:text-lime-text">
              {g.name}
            </span>
            <span className="text-xs text-gray-500">
              {count} {count === 1 ? 'post' : 'posts'}
            </span>
          </span>
        </button>
      )
    }

    return (
      <div className="space-y-6">
        {/* Quick access: All + General. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setSelected('all')}
            className="flex flex-col items-start gap-1 rounded-lg border-2 border-lime/40 bg-lime/[0.06] p-4 text-left transition hover:border-lime/70"
          >
            <span className="text-sm font-bold text-white">All posts</span>
            <span className="text-xs text-gray-400">{posts.length} total</span>
          </button>
          <button
            type="button"
            onClick={() => setSelected('general')}
            className="flex flex-col items-start gap-1 rounded-lg border border-white/15 bg-white/[0.03] p-4 text-left transition hover:border-lime/50"
          >
            <span className="text-sm font-semibold text-white">General</span>
            <span className="text-xs text-gray-500">{countBySlug.general ?? 0} posts · no game</span>
          </button>
        </div>

        {/* Games with content — the ones you actually manage. */}
        {gamesWithPosts.length > 0 && (
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Games with posts
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gamesWithPosts.map((g) => (
                <GameCard key={g.slug} g={g} />
              ))}
            </div>
          </div>
        )}

        {/* Empty games — collapsed so they don't bury the active ones. */}
        {emptyGames.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowEmpty((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-300"
            >
              {showEmpty ? '▾' : '▸'} {emptyGames.length} games with no posts yet
            </button>
            {showEmpty && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {emptyGames.map((g) => (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => setSelected(g.slug)}
                    className="flex items-center gap-2 border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition hover:border-lime/50"
                  >
                    {g.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.imageUrl} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
                    )}
                    <span className="truncate text-[13px] text-gray-300">{g.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Posts view for the chosen game ──
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-gray-300 transition hover:border-white/30"
          >
            ← Games
          </button>
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            {selectedGame?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedGame.imageUrl} alt="" className="h-5 w-5 rounded-md object-cover" />
            )}
            {selected === 'all'
              ? 'All posts'
              : selected === 'general'
                ? 'General posts'
                : selectedGame?.name ?? selected}
            <span className="font-normal text-gray-500">({visiblePosts.length})</span>
          </span>
        </div>
        {selected !== 'all' && selected !== 'general' && (
          <Link
            href={`/admin/blog/new?game=${selected}`}
            className="inline-flex rounded-md border border-lime/50 px-3 py-1.5 text-xs font-semibold text-lime-text transition hover:bg-lime/10"
          >
            + New {selectedGame?.name ?? selected} post
          </Link>
        )}
      </div>

      {visiblePosts.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          {selected === 'all'
            ? 'No posts yet. Click + New post to write one.'
            : 'No posts for this game yet. Use the button above to write the first one.'}
        </div>
      ) : (
    <div className="flex flex-col gap-2">
      {visiblePosts.map((post) => {
        const isBusy = busyId === post.id && pending
        const gameLabel = post.primary_game_slug || 'general'
        return (
          <div
            key={post.id}
            className="flex items-center gap-3 border border-white/10 bg-white/[0.02] p-2.5 transition hover:border-white/20 sm:gap-4 sm:p-3"
          >
            {/* Cover thumbnail (or a placeholder tile). */}
            <Link
              href={`/admin/blog/${post.id}`}
              className="relative aspect-[16/10] w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.03] sm:w-28"
            >
              {post.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.cover_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] text-gray-600">
                  No cover
                </span>
              )}
            </Link>

            {/* Title + meta. */}
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/blog/${post.id}`}
                className="block truncate text-[14px] font-semibold text-white hover:text-lime-text sm:text-[15px]"
              >
                {post.title || <span className="text-gray-500">(untitled)</span>}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-gray-500">
                <span className="text-gray-400">{TYPE_LABEL[post.post_type] ?? post.post_type}</span>
                <span className="text-gray-700">·</span>
                <span>{gameLabel}</span>
                <span className="text-gray-700">·</span>
                <span>
                  {post.updated_at ? `updated ${new Date(post.updated_at).toLocaleDateString()}` : '—'}
                </span>
              </div>
            </div>

            {/* Status pill. */}
            <span
              className={`hidden shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize sm:inline-flex ${
                STATUS_STYLE[post.status] ?? STATUS_STYLE.archived
              }`}
            >
              {post.status}
            </span>

            {/* Actions. */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => togglePublish(post)}
                disabled={isBusy}
                className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] font-semibold text-gray-200 transition hover:border-white/30 disabled:opacity-50"
              >
                {post.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
              <Link
                href={`/admin/blog/${post.id}`}
                className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] font-semibold text-gray-200 transition hover:border-white/30"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => remove(post)}
                disabled={isBusy}
                className="rounded-md border border-red-500/30 px-2.5 py-1 text-[12px] font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        )
      })}
    </div>
      )}
    </div>
  )
}
