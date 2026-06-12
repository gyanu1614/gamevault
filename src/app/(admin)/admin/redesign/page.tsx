/**
 * /admin/redesign — landing hub for the redesigned admin surfaces.
 *
 * Single page that lists every v2 surface so admins can navigate the new
 * world without typing URLs. Server-rendered; counts queried live.
 */

import Link from 'next/link'
import { ArrowRight, Gamepad2, FolderTree, Sparkles, ListChecks, Wand2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { fetchAdminGames } from '@/lib/actions/admin-games'
import { fetchAdminGameCategoryBadges } from '@/lib/actions/admin-game-categories'
import { fetchAdminGlobalCategories } from '@/lib/actions/admin-global-categories'

export const dynamic = 'force-dynamic'

export default async function AdminRedesignHub() {
  const [games, badges, globals] = await Promise.all([
    fetchAdminGames() as unknown as Promise<Array<{ id: string; is_active: boolean }>>,
    fetchAdminGameCategoryBadges(),
    fetchAdminGlobalCategories(),
  ])

  const activeGames = games.filter((g) => g.is_active).length
  const enabledPairs = badges.filter((b) => b.is_enabled).length
  const activeGlobals = globals.filter((g) => g.is_active).length

  const tiles: Array<{
    href: string
    title: string
    description: string
    metric: string
    icon: React.ComponentType<{ className?: string }>
  }> = [
    {
      href: '/admin/games-v2',
      title: 'Games',
      description: 'Manage games, branding, and which categories each game supports.',
      metric: `${activeGames} active / ${games.length} total`,
      icon: Gamepad2,
    },
    {
      href: '/admin/categories-v2',
      title: 'Global categories',
      description: 'Edit the 5 fixed categories — Currency, Items, Accounts, Top Up, Boosting.',
      metric: `${activeGlobals} active`,
      icon: FolderTree,
    },
    {
      href: '/admin/games-v2/new',
      title: 'New game wizard',
      description: 'Add a game with the redesigned step-by-step flow.',
      metric: 'Add new',
      icon: Wand2,
    },
    {
      href: '/admin/games-v2',
      title: 'Attribute templates',
      description: 'Build per-(game, category) attribute templates with conditional rules.',
      metric: `${enabledPairs} (game · category) pairs enabled`,
      icon: ListChecks,
    },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Redesigned admin</h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-lime-tint-border bg-lime-tint-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-lime-text">
            <Sparkles className="h-3 w-3" />
            hub
          </span>
        </div>
        <p className="text-sm text-text-secondary">
          A single entry point to every Phase-B surface. The classic admin pages stay live
          and unchanged — every link here opens a parallel <code className="rounded bg-bg-raised-hover px-1 font-mono text-[11px] text-lime-text">-v2</code> route.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <Link
              key={t.href + t.title}
              href={t.href}
              className="group block focus:outline-none"
            >
              <GlassCard intensity="light" rounded="2xl" className="h-full p-5 transition-colors group-hover:bg-bg-raised-hover">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-tint-border bg-lime-tint-bg">
                    <Icon className="h-5 w-5 text-lime-text" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-base font-semibold text-text-primary">{t.title}</h2>
                      <ArrowRight className="h-3.5 w-3.5 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{t.description}</p>
                    <div className="mt-2 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                      {t.metric}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </Link>
          )
        })}
      </div>

      <GlassCard intensity="light" rounded="2xl">
        <h3 className="text-sm font-semibold text-text-primary">Status</h3>
        <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
          <li>• Phase A schema applied — new tables live alongside the legacy ones.</li>
          <li>• Phase B admin redesign is shipping piece by piece behind the <code className="rounded bg-bg-raised-hover px-1 font-mono text-[11px] text-lime-text">-v2</code> routes.</li>
          <li>• Phase C seller wizard at <code className="rounded bg-bg-raised-hover px-1 font-mono text-[11px] text-lime-text">/sell/new</code> is the next milestone.</li>
        </ul>
      </GlassCard>
    </div>
  )
}
