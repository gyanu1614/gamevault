/**
 * Admin → Blog & Content — list all posts (any status) with create/edit links
 * and quick publish/unpublish + delete. Authoring lives in the client component.
 */

import Link from 'next/link'
import { Plus } from '@phosphor-icons/react/dist/ssr/Plus'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { fetchAdminBlogPosts } from '@/lib/actions/admin-blog'
import { getAllGames } from '@/lib/utils/games'
import { PageHeader, adminBtn } from '../components/kit'
import { BlogListClient } from './BlogListClient'

export const dynamic = 'force-dynamic'

export default async function AdminBlogPage() {
  await requireAdmin()
  const [posts, games] = await Promise.all([
    fetchAdminBlogPosts(),
    getAllGames(),
  ])

  return (
    <div className="pb-10">
      <PageHeader
        title="Blog & Content"
        description="Value guides, seller guides and articles. Published posts appear under /[game]/blog and /blog."
        actions={
          <Link href="/admin/blog/new" className={adminBtn.primary}>
            <Plus aria-hidden weight="bold" className="h-4 w-4" />
            New Post
          </Link>
        }
      />
      <BlogListClient
        posts={posts}
        games={games.map((g) => ({
          name: g.name,
          slug: g.slug,
          imageUrl: g.image_url,
        }))}
      />
    </div>
  )
}
