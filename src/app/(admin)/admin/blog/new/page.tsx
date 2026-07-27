import { requireAdmin } from '@/lib/actions/admin-permissions'
import { createClient } from '@/lib/supabase/server'
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

export default async function NewBlogPostPage() {
  await requireAdmin()
  const games = await getGames()
  return (
    <div className="space-y-6">
      <PageHeader title="New post" description="Create a value guide, seller guide, or article." />
      <AdminPanel>
        <BlogEditor games={games} />
      </AdminPanel>
    </div>
  )
}
