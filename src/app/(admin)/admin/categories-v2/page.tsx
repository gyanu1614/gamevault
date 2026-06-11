'use client'

/**
 * /admin/categories-v2 — Phase B settings page for the 5 global categories.
 *
 * With global categories fixed at launch (Currency / Items / Accounts /
 * Top Up / Boosting), this page is intentionally simple: one card per
 * category, edit name/description/emoji/SEO inline, save.
 *
 * Lives alongside the classic /admin/categories page (which still manages
 * the legacy game-scoped categories table). No write paths overlap.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Sparkles, Save, Loader2, Eye, EyeOff, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import {
  fetchAdminGlobalCategories,
  saveGlobalCategory,
  type GlobalCategoryAdminRow,
} from '@/lib/actions/admin-global-categories'

// ─── Editable card per category ───────────────────────────────────────────────

function CategoryCard({ row, onSaved }: { row: GlobalCategoryAdminRow; onSaved: () => void }) {
  const [name, setName] = useState(row.name)
  const [description, setDescription] = useState(row.description ?? '')
  const [iconEmoji, setIconEmoji] = useState(row.icon_emoji ?? '')
  const [sortOrder, setSortOrder] = useState(row.sort_order)
  const [isActive, setIsActive] = useState(row.is_active)
  const [seoTitle, setSeoTitle] = useState(row.seo_title ?? '')
  const [seoDescription, setSeoDescription] = useState(row.seo_description ?? '')
  const [seoOpen, setSeoOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const dirty =
    name !== row.name ||
    (description || '') !== (row.description ?? '') ||
    (iconEmoji || '') !== (row.icon_emoji ?? '') ||
    sortOrder !== row.sort_order ||
    isActive !== row.is_active ||
    (seoTitle || '') !== (row.seo_title ?? '') ||
    (seoDescription || '') !== (row.seo_description ?? '')

  const handleSave = async () => {
    setSaving(true)
    const res = await saveGlobalCategory({
      id: row.id,
      name,
      description,
      icon_emoji: iconEmoji,
      sort_order: sortOrder,
      is_active: isActive,
      seo_title: seoTitle,
      seo_description: seoDescription,
    })
    setSaving(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success(`Saved ${name}`)
    onSaved()
  }

  return (
    <GlassCard intensity="light" rounded="2xl" className="p-0">
      <div className="flex items-start gap-4 p-6">
        {/* Big icon */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-3xl">
          {iconEmoji || '📦'}
        </div>

        <div className="flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1.5fr_120px_90px_110px]">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">Emoji</label>
              <input
                value={iconEmoji}
                onChange={(e) => setIconEmoji(e.target.value)}
                maxLength={4}
                className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-center text-lg text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))}
                className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">Slug</label>
              <input
                value={row.slug}
                readOnly
                className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 font-mono text-xs text-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
            />
          </div>

          {/* SEO collapsible */}
          <div className="rounded-lg border border-white/10 bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setSeoOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400 transition-colors hover:text-white"
            >
              SEO (title & description)
              {seoOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {seoOpen && (
              <div className="space-y-2 border-t border-white/[0.06] p-3">
                <input
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="SEO title"
                  className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
                />
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={2}
                  placeholder="SEO meta description"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
                />
              </div>
            )}
          </div>

          {/* Footer row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/[0.08] text-amber-300'
                )}
                aria-pressed={isActive}
                title={isActive ? 'Click to disable' : 'Click to enable'}
              >
                {isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {isActive ? 'Active' : 'Disabled at launch'}
              </button>
              <span className="text-[11px] text-gray-500">
                · used by {row.game_count} game{row.game_count === 1 ? '' : 's'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors',
                dirty
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'bg-white/[0.04] text-gray-600 cursor-not-allowed'
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCategoriesV2Page() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<GlobalCategoryAdminRow[]>({
    queryKey: ['admin-global-categories'],
    queryFn: fetchAdminGlobalCategories,
    staleTime: 30_000,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-global-categories'] })

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="space-y-2">
        <Link
          href="/admin/categories"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to classic categories admin
        </Link>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Categories</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                <Sparkles className="h-3 w-3" />
                new
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              The 5 global categories every game can opt into. Per-game settings live in the game wizard.
            </p>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-gray-500">
          Loading…
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-gray-500">
          No global categories found. Run the Phase A migration first.
        </div>
      ) : (
        <div className="space-y-3">
          {data!.map((row) => (
            <CategoryCard key={row.id} row={row} onSaved={refresh} />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11px] text-gray-500">
        These rows are fixed at launch. New categories require a schema migration — the classic
        /admin/categories page still manages the old game-scoped table.
      </div>
    </div>
  )
}
