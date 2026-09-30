import { requireAdmin } from '@/lib/actions/admin-permissions'
import { createClient } from '@/lib/supabase/server'
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
    <div className="pb-10">
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
        Blog &amp; Content
      </Link>
      <PageHeader className="mt-2" title="New Post" description="Create a value guide, seller guide, or article." />
      <BlogEditor games={games} defaultGameSlug={defaultGameSlug} />
    </div>
  )
}
