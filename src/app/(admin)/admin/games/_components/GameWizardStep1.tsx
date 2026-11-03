'use client'

/** GameWizard step 1: identity (name, slug, display name, emoji, tier, platform, active). */

import type { Dispatch, SetStateAction } from 'react'
import { cn, slugify } from '@/lib/utils'
import { accountInputCls } from '@/components/account/AccountSurface'
import { Switch } from '@/components/ui/switch'
import { PanelHead } from '../../components/kit'
import {
  GAME_CONTENT_TIERS,
  GAME_ECOSYSTEMS,
  type GameContentTier,
  type GameEcosystem,
} from '@/lib/games/validate-game'

// ─── Field primitives ─────────────────────────────────────────────────────────

function Label({
  children,
  hint,
  required,
  htmlFor,
}: {
  children: React.ReactNode
  hint?: string
  required?: boolean
  htmlFor?: string
}) {
  return (
    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-text-secondary">
        {children}
        {required && <span className="ml-1 text-error">*</span>}
      </label>
      {hint && <span className="text-[12px] text-text-tertiary">{hint}</span>}
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(accountInputCls, props.className)}
    />
  )
}

/** Native select on the step card: the card input look, 40px tall. */
const selectCls = cn(accountInputCls, 'h-10 cursor-pointer py-0 [&>option]:bg-bg-raised')

export function IdentityStep({
  mode,
  name,
  setName,
  slug,
  setSlug,
  setSlugDirty,
  displayName,
  setDisplayName,
  emoji,
  setEmoji,
  sortOrder,
  setSortOrder,
  contentTier,
  setContentTier,
  ecosystem,
  setEcosystem,
  isActive,
  setIsActive,
}: {
  mode: 'create' | 'edit'
  name: string
  setName: (name: string) => void
  slug: string
  setSlug: (slug: string) => void
  setSlugDirty: (dirty: boolean) => void
  displayName: string
  setDisplayName: (displayName: string) => void
  emoji: string
  setEmoji: (emoji: string) => void
  sortOrder: number
  setSortOrder: (sortOrder: number) => void
  contentTier: GameContentTier
  setContentTier: (tier: GameContentTier) => void
  ecosystem: GameEcosystem | ''
  setEcosystem: (ecosystem: GameEcosystem | '') => void
  isActive: boolean
  setIsActive: Dispatch<SetStateAction<boolean>>
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <PanelHead title="Identity" className="mb-0 sm:col-span-2" />
      <div className="sm:col-span-2">
        <Label required htmlFor="gw-name">Name</Label>
        <TextInput
          id="gw-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Steal a Brainrot"
          autoFocus={mode === 'create'}
        />
      </div>

      <div>
        <Label required htmlFor="gw-slug" hint="Lowercase, dashes only — used in URLs">Slug</Label>
        <TextInput
          id="gw-slug"
          value={slug}
          onChange={(e) => { setSlug(slugify(e.target.value)); setSlugDirty(true) }}
          placeholder="steal-a-brainrot"
          className="font-mono"
        />
      </div>

      <div>
        <Label htmlFor="gw-display-name" hint="Short label for the navbar">Display Name</Label>
        <TextInput
          id="gw-display-name"
          value={displayName ?? ''}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Brainrot"
        />
      </div>

      <div>
        <Label htmlFor="gw-emoji" hint="Fallback if no logo">Emoji</Label>
        <TextInput
          id="gw-emoji"
          value={emoji ?? ''}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🎮"
          maxLength={4}
        />
      </div>

      <div>
        <Label htmlFor="gw-sort-order" hint="Lower = shown first">Sort Order</Label>
        <TextInput
          id="gw-sort-order"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value || '99', 10))}
          min={0}
          max={9999}
          className="tabular-nums"
        />
      </div>

      <div>
        <Label htmlFor="gw-content-tier" hint="Listed = marketplace only; data = has a values hub">
          Content Tier
        </Label>
        <select
          id="gw-content-tier"
          className={selectCls}
          value={contentTier}
          onChange={(e) => setContentTier(e.target.value as GameContentTier)}
        >
          {GAME_CONTENT_TIERS.map((t) => (
            <option key={t} value={t}>
              {t === 'listed' ? 'Listed — marketplace only' : 'Data — values/content hub'}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="gw-ecosystem" hint="Drives SEO copy and category defaults">Platform</Label>
        <select
          id="gw-ecosystem"
          className={selectCls}
          value={ecosystem}
          onChange={(e) => setEcosystem(e.target.value as GameEcosystem | '')}
        >
          <option value="">— Not set —</option>
          {GAME_ECOSYSTEMS.map((eco) => (
            <option key={eco} value={eco}>
              {eco}
            </option>
          ))}
        </select>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-md bg-bg-overlay px-3.5 py-3 transition-colors hover:bg-bg-overlay-2 sm:col-span-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-text-primary">Active</span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-text-tertiary">
            Inactive games are hidden from the marketplace.
          </span>
        </span>
        <Switch
          checked={isActive}
          onCheckedChange={() => setIsActive((v) => !v)}
          aria-label="Active"
          className="data-[state=unchecked]:bg-white/[0.12]"
        />
      </label>
    </div>
  )
}
