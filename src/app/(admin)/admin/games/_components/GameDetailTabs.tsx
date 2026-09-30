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
 *   • Fees         — seller commission per enabled category (fee engine
 *                    PR 5): live rate, scheduled rules, promos, risk band.
 *
 * Currency/Accounts/Boosting tabs are only shown when the matching
 * global category is enabled for this game — we don't surface config
 * for things the game doesn't sell.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ArrowSquareOut, CaretLeft } from '@phosphor-icons/react'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { AdminEmpty, adminBtn } from '../../components/kit'
import { GameTile } from '../../components/GameTile'
import GameWizard from './GameWizard'
import { CurrencyConfigForm } from './CurrencyConfigForm'
import { AccountConfigForm } from './AccountConfigForm'
import { BoostingConfigForm } from './BoostingConfigForm'
import { SeoOverrideForm } from './SeoOverrideForm'
import { FeesTab } from './FeesTab'

type Tab = 'setup' | 'currency' | 'items' | 'accounts' | 'boosting' | 'fees' | 'seo'

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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'setup', label: 'Setup' },
    ...(hasCurrency ? [{ id: 'currency' as Tab, label: 'Currency' }] : []),
    ...(hasItems ? [{ id: 'items' as Tab, label: 'Items' }] : []),
    ...(hasAccounts ? [{ id: 'accounts' as Tab, label: 'Accounts' }] : []),
    ...(hasBoosting ? [{ id: 'boosting' as Tab, label: 'Boosting' }] : []),
    { id: 'fees', label: 'Fees' },
    { id: 'seo', label: 'SEO' },
  ]

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <header>
        <Link
          href="/admin/games"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Games
        </Link>
        <div className="mt-3 flex items-center gap-3.5">
          <GameTile src={game?.image_url} name={game?.name} className="h-12 w-12 text-[16px]" />
          <div className="min-w-0">
            <h1 className="truncate text-[24px] font-bold leading-tight tracking-tight text-text-primary sm:text-[28px]">
              {game?.name ?? 'Game'}
            </h1>
            <p className="mt-0.5 text-[13.5px] text-text-secondary">
              Configure identity, branding, and per-category settings.
            </p>
          </div>
        </div>
      </header>

      <SegmentedTabs<Tab>
        tabs={tabs}
        value={tab}
        onChange={setTab}
        layoutId="game-detail-tabs"
        ariaLabel="Game settings"
      />

      <div role="tabpanel" id={`game-detail-tabs-panel-${tab}`} aria-labelledby={`game-detail-tabs-tab-${tab}`}>
        {/* Setup — runs the existing 4-step wizard (Identity, Branding,
            Categories, Review). Editing here is what flips category
            enablement, which in turn shows/hides the other tabs. */}
        {tab === 'setup' && (
          <GameWizard
            mode="edit"
            game={game}
            globalCategories={globalCategories}
            initialGameCategories={initialGameCategories}
          />
        )}

        {tab === 'currency' && hasCurrency && (
          <CategoryEmptyHint enabled={hasCurrency} type="Currency">
            <CurrencyConfigForm gameId={game.id} />
          </CategoryEmptyHint>
        )}

        {tab === 'items' && hasItems && <ItemsTabLink gameId={game.id} />}

        {tab === 'accounts' && hasAccounts && (
          <CategoryEmptyHint enabled={hasAccounts} type="Accounts">
            <AccountConfigForm gameId={game.id} />
          </CategoryEmptyHint>
        )}

        {tab === 'boosting' && hasBoosting && (
          <CategoryEmptyHint enabled={hasBoosting} type="Boosting">
            <BoostingConfigForm gameId={game.id} />
          </CategoryEmptyHint>
        )}

        {tab === 'fees' && <FeesTab rows={initialGameCategories} gameName={game.name} />}

        {tab === 'seo' && <SeoOverrideForm gameId={game.id} gameName={game.name} />}
      </div>
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
      <AdminEmpty
        icon={ArrowSquareOut}
        title={`${type} Isn't Enabled for This Game`}
        hint="Enable it in the Setup tab's Categories step, then come back here to configure."
      />
    )
  }
  return <>{children}</>
}

function ItemsTabLink({ gameId }: { gameId: string }) {
  // Items configuration is handled by the dedicated template builder
  // routes per (game, category). Show a friendly pointer rather than
  // duplicating that surface here.
  return (
    <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">Item Templates</h2>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
        Item-listing attributes (rarity, level, dropdowns, conditional sub-fields, …)
        are managed in the dedicated template builder.
      </p>
      <Link href={`/admin/games/${gameId}/templates/items`} className={`${adminBtn.primary} mt-4`}>
        Open Template Builder
        <ArrowSquareOut aria-hidden weight="bold" className="h-4 w-4" />
      </Link>
    </section>
  )
}
