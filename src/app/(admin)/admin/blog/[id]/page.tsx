import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { createClient } from '@/lib/supabase/server'
import { fetchAdminBlogPost } from '@/lib/actions/admin-blog'
import Link from 'next/link'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr/CaretLeft'
import { PageHeader } from '../../components/kit'
import { BlogEditor } from '../BlogEditor'

export const dynamic = 'force-dynamic'

async function getGames() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('games')
    .select('slug, name')
    .eq('is_active', true)
    .order('name', { ascending: true })
  return (data ?? []) as { slug: string; name: string }[]
}

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const [post, games] = await Promise.all([fetchAdminBlogPost(id), getGames()])
  if (!post) notFound()

  return (
    <div className="pb-10">
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
        Blog &amp; Content
      </Link>
      <PageHeader className="mt-2" title="Edit Post" description={post.title} />
      <BlogEditor post={post} games={games} />
    </div>
  )
}
