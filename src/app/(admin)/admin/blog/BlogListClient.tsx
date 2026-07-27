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

export function BlogListClient({ posts }: { posts: AdminBlogPost[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

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

  if (posts.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-400">
        No posts yet. Click <span className="font-semibold text-white">+ New post</span> to write one.
      </div>
    )
  }

  return (
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
          {posts.map((post) => {
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
  )
}
