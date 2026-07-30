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

export default async function NewBlogPostPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>
}) {
  await requireAdmin()
  const [games, params] = await Promise.all([getGames(), searchParams])
  // Pre-select the game when arriving from a game's view in Blog & Content.
  const defaultGameSlug = games.some((g) => g.slug === params.game)
    ? params.game
    : undefined
  return (
    <div className="space-y-6">
      <PageHeader title="New post" description="Create a value guide, seller guide, or article." />
      <AdminPanel>
        <BlogEditor games={games} defaultGameSlug={defaultGameSlug} />
      </AdminPanel>
    </div>
  )
}
