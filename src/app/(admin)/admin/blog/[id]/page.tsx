import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { createClient } from '@/lib/supabase/server'
import { fetchAdminBlogPost } from '@/lib/actions/admin-blog'
import { PageHeader, AdminPanel } from '../../components/kit'
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
    <div className="space-y-6">
      <PageHeader title="Edit post" description={post.title} />
      <AdminPanel>
        <BlogEditor post={post} games={games} />
      </AdminPanel>
    </div>
  )
}
