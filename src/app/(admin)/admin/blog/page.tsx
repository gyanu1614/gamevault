/**
 * Admin → Blog & Content — list all posts (any status) with create/edit links
 * and quick publish/unpublish + delete. Authoring lives in the client component.
 */

import Link from 'next/link'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { fetchAdminBlogPosts } from '@/lib/actions/admin-blog'
import { PageHeader, AdminPanel } from '../components/kit'
import { BlogListClient } from './BlogListClient'

export const dynamic = 'force-dynamic'

export default async function AdminBlogPage() {
  await requireAdmin()
  const posts = await fetchAdminBlogPosts()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog & Content"
        description="Value guides, seller guides, and articles. Published posts appear under /[game]/blogs and /blog."
        actions={
          <Link
            href="/admin/blog/new"
            className="inline-flex items-center gap-2 rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            + New post
          </Link>
        }
      />
      <AdminPanel>
        <BlogListClient posts={posts} />
      </AdminPanel>
    </div>
  )
}
