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

  // ── Games overview — the landing view. A card per game, driven by the
  //    games table, so a game added in admin appears here automatically. ──
  if (selected === null) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setSelected('all')}
          className="flex flex-col items-start gap-2 rounded-lg border border-white/15 bg-white/[0.03] p-4 text-left transition hover:border-lime/50"
        >
          <span className="text-sm font-semibold text-white">All posts</span>
          <span className="text-xs text-gray-500">{posts.length} total</span>
        </button>
        <button
          type="button"
          onClick={() => setSelected('general')}
          className="flex flex-col items-start gap-2 rounded-lg border border-white/15 bg-white/[0.03] p-4 text-left transition hover:border-lime/50"
        >
          <span className="text-sm font-semibold text-white">General</span>
          <span className="text-xs text-gray-500">
            {countBySlug.general ?? 0} posts · no game
          </span>
        </button>
        {games.map((g) => (
          <button
            key={g.slug}
            type="button"
            onClick={() => setSelected(g.slug)}
            className="flex flex-col items-start gap-2 rounded-lg border border-white/15 bg-white/[0.03] p-4 text-left transition hover:border-lime/50"
          >
            <span className="flex items-center gap-2">
              {g.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.imageUrl} alt="" className="h-6 w-6 rounded-md object-cover" />
              )}
              <span className="text-sm font-semibold text-white">{g.name}</span>
            </span>
            <span className="text-xs text-gray-500">
              {countBySlug[g.slug] ?? 0} {(countBySlug[g.slug] ?? 0) === 1 ? 'post' : 'posts'}
            </span>
          </button>
        ))}
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2.5 font-semibold">Title</th>
            <th className="px-3 py-2.5 font-semibold">Game</th>
            <th className="px-3 py-2.5 font-semibold">Type</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 font-semibold">Updated</th>
            <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visiblePosts.map((post) => {
            const isBusy = busyId === post.id && pending
            return (
              <tr key={post.id} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                <td className="px-3 py-3">
                  <Link
                    href={`/admin/blog/${post.id}`}
                    className="font-medium text-white hover:text-lime-text"
                  >
                    {post.title || <span className="text-gray-500">(untitled)</span>}
                  </Link>
                  <div className="text-xs text-gray-500">/{post.slug}</div>
                </td>
                <td className="px-3 py-3 text-gray-300">
                  {post.primary_game_slug || <span className="text-gray-600">general</span>}
                </td>
                <td className="px-3 py-3 text-gray-300">{TYPE_LABEL[post.post_type] ?? post.post_type}</td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      STATUS_STYLE[post.status] ?? STATUS_STYLE.archived
                    }`}
                  >
                    {post.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-500">
                  {post.updated_at ? new Date(post.updated_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => togglePublish(post)}
                      disabled={isBusy}
                      className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold text-gray-200 transition hover:border-white/30 disabled:opacity-50"
                    >
                      {post.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <Link
                      href={`/admin/blog/${post.id}`}
                      className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold text-gray-200 transition hover:border-white/30"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(post)}
                      disabled={isBusy}
                      className="rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
      )}
    </div>
  )
}
