'use client'

/**
 * V17y — Game detail tabs. Replaces the linear "edit wizard" UX with
 * a tabbed control panel.
 *
 * Tabs:
 *   • Setup        — wraps the existing 4-step GameWizard
 *                    (Identity / Branding / Categories / Review).
 *   • Currency     — per-game currency pricing/copy via category_configs.
 *   • Items        — link to the existing template builder route.
 *   • Accounts     — per-game required listing fields, delivery, policy.
 *   • Boosting     — tier ladder, avg delivery, instructions placeholder.
 *
 * Currency/Accounts/Boosting tabs are only shown when the matching
 * global category is enabled for this game — we don't surface config
 * for things the game doesn't sell.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import GameWizard from './GameWizard'
import { CurrencyConfigForm } from './CurrencyConfigForm'
import { AccountConfigForm } from './AccountConfigForm'
import { BoostingConfigForm } from './BoostingConfigForm'

type Tab = 'setup' | 'currency' | 'items' | 'accounts' | 'boosting'

// Mirrors the GameWizard's existing types so this file doesn't have
// to import internal interfaces. The shapes come from
// fetchGameById / fetchGameCategoryRows / fetchGlobalCategoriesForWizard.
type Game = any
type GameCategoryRow = any
type GlobalCategory = any

export default function GameDetailTabs({
  game,
  globalCategories,
  initialGameCategories,
}: {
  game: Game
  globalCategories: GlobalCategory[]
  initialGameCategories: GameCategoryRow[]
}) {
  const [tab, setTab] = useState<Tab>('setup')

  // Which categories are enabled for this game (by global category slug).
  const enabledSlugs = new Set(
    initialGameCategories
      .filter((c) => c.is_enabled)
      .map((c) => c.global_category_slug)
      .filter(Boolean),
  )
  const hasCurrency = enabledSlugs.has('currency')
  const hasItems = enabledSlugs.has('items')
  const hasAccounts = enabledSlugs.has('accounts')
  const hasBoosting = enabledSlugs.has('boosting')

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <Link
          href="/admin/games"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-tertiary transition-colors hover:text-text-primary"
        >
          ← Back to games
        </Link>
        <h1 className="mt-3 text-[26px] font-semibold tracking-tight text-text-primary">
          {game?.name ?? 'Game'}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-text-secondary">
          Configure identity, branding, and per-category settings.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex w-full flex-wrap gap-1 rounded-xl bg-bg-raised p-1">
          <TabsTrigger value="setup" className="data-[state=active]:bg-bg-overlay">
            Setup
          </TabsTrigger>
          {hasCurrency && (
            <TabsTrigger value="currency" className="data-[state=active]:bg-bg-overlay">
              Currency
            </TabsTrigger>
          )}
          {hasItems && (
            <TabsTrigger value="items" className="data-[state=active]:bg-bg-overlay">
              Items
            </TabsTrigger>
          )}
          {hasAccounts && (
            <TabsTrigger value="accounts" className="data-[state=active]:bg-bg-overlay">
              Accounts
            </TabsTrigger>
          )}
          {hasBoosting && (
            <TabsTrigger value="boosting" className="data-[state=active]:bg-bg-overlay">
              Boosting
            </TabsTrigger>
          )}
        </TabsList>

        {/* Setup — runs the existing 4-step wizard (Identity, Branding,
            Categories, Review). Editing here is what flips category
            enablement, which in turn shows/hides the other tabs. */}
        <TabsContent value="setup" className="mt-6">
          <GameWizard
            mode="edit"
            game={game}
            globalCategories={globalCategories}
            initialGameCategories={initialGameCategories}
          />
        </TabsContent>

        {hasCurrency && (
          <TabsContent value="currency" className="mt-6">
            <CategoryEmptyHint enabled={hasCurrency} type="Currency">
              <CurrencyConfigForm gameId={game.id} />
            </CategoryEmptyHint>
          </TabsContent>
        )}

        {hasItems && (
          <TabsContent value="items" className="mt-6">
            <ItemsTabLink gameId={game.id} />
          </TabsContent>
        )}

        {hasAccounts && (
          <TabsContent value="accounts" className="mt-6">
            <CategoryEmptyHint enabled={hasAccounts} type="Accounts">
              <AccountConfigForm gameId={game.id} />
            </CategoryEmptyHint>
          </TabsContent>
        )}

        {hasBoosting && (
          <TabsContent value="boosting" className="mt-6">
            <CategoryEmptyHint enabled={hasBoosting} type="Boosting">
              <BoostingConfigForm gameId={game.id} />
            </CategoryEmptyHint>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function CategoryEmptyHint({
  enabled,
  type,
  children,
}: {
  enabled: boolean
  type: string
  children: React.ReactNode
}) {
  if (!enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-border-default bg-bg-raised/60 p-8 text-center">
        <p className="text-[14px] font-semibold text-text-primary">
          {type} isn't enabled for this game.
        </p>
        <p className="mt-1.5 text-[12.5px] text-text-secondary">
          Enable it in the Setup tab's Categories step, then come back here to configure.
        </p>
      </div>
    )
  }
  return <>{children}</>
}

function ItemsTabLink({ gameId }: { gameId: string }) {
  // Items configuration is handled by the dedicated template builder
  // routes per (game, category). Show a friendly pointer rather than
  // duplicating that surface here.
  return (
    <div className="rounded-2xl border border-border-default bg-bg-raised p-6">
      <h3 className="text-[15px] font-semibold text-text-primary">Item templates</h3>
      <p className="mt-1.5 text-[13px] text-text-secondary">
        Item-listing attributes (rarity, level, dropdowns, conditional sub-fields, …)
        are managed in the dedicated template builder.
      </p>
      <Link
        href={`/admin/games/${gameId}/templates/items`}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-lime px-4 py-2 text-[13px] font-semibold text-text-inverse transition-colors hover:bg-lime-hover"
      >
        Open template builder
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
