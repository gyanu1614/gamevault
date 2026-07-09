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
import { PageHeader, AdminPanel } from '../components/kit'
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
    <AdminPanel pad={false}>
      <div className="flex items-start gap-4 p-6">
        {/* Big icon */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border-default bg-bg-overlay text-3xl">
          {iconEmoji || '📦'}
        </div>

        <div className="flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1.5fr_120px_90px_110px]">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-lg border border-border-default bg-bg-base px-3 text-sm text-text-primary focus:border-lime focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Emoji</label>
              <input
                value={iconEmoji}
                onChange={(e) => setIconEmoji(e.target.value)}
                maxLength={4}
                className="h-9 w-full rounded-lg border border-border-default bg-bg-base px-3 text-center text-lg text-text-primary focus:border-lime focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))}
                className="h-9 w-full rounded-lg border border-border-default bg-bg-base px-3 text-sm text-text-primary focus:border-lime focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Slug</label>
              <input
                value={row.slug}
                readOnly
                className="h-9 w-full rounded-lg border border-border-default bg-bg-base px-3 font-mono text-xs text-text-secondary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2 text-sm text-text-primary focus:border-lime focus:outline-none"
            />
          </div>

          {/* SEO collapsible */}
          <div className="rounded-lg border border-border-default bg-bg-base">
            <button
              type="button"
              onClick={() => setSeoOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-text-secondary transition-colors hover:text-text-primary"
            >
              SEO (title & description)
              {seoOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {seoOpen && (
              <div className="space-y-2 border-t border-border-subtle p-3">
                <input
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="SEO title"
                  className="h-9 w-full rounded-lg border border-border-default bg-bg-base px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none"
                />
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={2}
                  placeholder="SEO meta description"
                  className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2 text-sm text-text-primary focus:border-lime focus:outline-none"
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
                    ? 'border-success bg-success-bg text-success'
                    : 'border-warning bg-warning-bg text-warning'
                )}
                aria-pressed={isActive}
                title={isActive ? 'Click to disable' : 'Click to enable'}
              >
                {isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {isActive ? 'Active' : 'Disabled at launch'}
              </button>
              <span className="text-[11px] text-text-tertiary">
                · used by {row.game_count} game{row.game_count === 1 ? '' : 's'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition-colors',
                dirty
                  ? 'bg-lime-pressed text-text-inverse hover:bg-lime'
                  : 'bg-bg-overlay text-text-disabled cursor-not-allowed'
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        </div>
      </div>
    </AdminPanel>
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
        <div className="flex items-center gap-3">
          <Link
            href="/admin/redesign"
            className="inline-flex items-center gap-1.5 text-xs text-text-tertiary transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            Redesign hub
          </Link>
          <span className="text-xs text-text-disabled">·</span>
          <Link
            href="/admin/categories"
            className="inline-flex items-center gap-1.5 text-xs text-text-tertiary transition-colors hover:text-text-primary"
          >
            Classic admin
          </Link>
        </div>
        <PageHeader
          className="mb-0"
          title={
            <span className="inline-flex items-center gap-2">
              Categories
              <span className="inline-flex items-center gap-1 rounded-full border border-lime-tint-border bg-lime-tint-bg px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-lime-text">
                <Sparkles className="h-3 w-3" />
                new
              </span>
            </span>
          }
          description="The 5 global categories every game can opt into. Per-game settings live in the game wizard."
        />
      </header>

      {isLoading ? (
        <div className="rounded-xl border border-border-default bg-bg-raised p-10 text-center text-sm text-text-tertiary">
          Loading…
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-xl border border-border-default bg-bg-raised p-10 text-center text-sm text-text-tertiary">
          No global categories found. Run the Phase A migration first.
        </div>
      ) : (
        <div className="space-y-3">
          {data!.map((row) => (
            <CategoryCard key={row.id} row={row} onSaved={refresh} />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border-default bg-bg-base p-3 text-[11px] text-text-tertiary">
        These rows are fixed at launch. New categories require a schema migration — the classic
        /admin/categories page still manages the old game-scoped table.
      </div>
    </div>
  )
}
