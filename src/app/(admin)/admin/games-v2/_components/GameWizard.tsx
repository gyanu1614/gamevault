'use client'

/**
 * GameWizard — shared client component for /admin/games-v2/new and
 * /admin/games-v2/[id]/edit. Single source of truth for the redesigned
 * add/edit flow. Apple-feel using existing glass-* primitives.
 *
 * Steps:
 *   1. Identity   — name, slug, display_name, emoji, sort_order
 *   2. Branding   — logo upload (existing uploadGameIcon endpoint)
 *   3. Categories — toggle each of the 5 global categories; per-pair
 *      settings (region/platform/delivery modes) appear when enabled
 *   4. Review     — summary + Save
 *
 * Writes flow through the new admin-game-wizard.ts actions for both
 * games and game_categories. Logo upload reuses the existing
 * uploadGameIcon action from admin-games.ts (no changes there).
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Check, Loader2, Upload, Image as ImageIcon,
  Trash2, AlertCircle, Globe2, Monitor, Zap, Clock, Sparkles, Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import {
  saveGameIdentity,
  upsertGameCategory,
  uploadGameLogoV2,
  deleteGameLogoV2,
  uploadGameCoverV2,
  deleteGameCoverV2,
  type GameDetail,
  type GameCategoryRow,
} from '@/lib/actions/admin-game-wizard'

// ─── Types passed in by the server-rendered route wrapper ────────────────────

export interface GlobalCategoryLite {
  id: string
  slug: string
  name: string
  icon_emoji: string | null
  is_active: boolean
  sort_order: number
}

export interface GameWizardProps {
  mode: 'create' | 'edit'
  game: GameDetail | null            // null in create mode
  globalCategories: GlobalCategoryLite[]
  initialGameCategories: GameCategoryRow[]   // empty in create mode
}

// ─── Defaults applied when toggling a category ON for the first time ─────────

function defaultsForCategory(slug: string): {
  delivery_modes: string[]
  requires_region: boolean
  requires_platform: boolean
} {
  switch (slug) {
    case 'currency':
    case 'items':
      // In-game currency/items must be transferred manually.
      return { delivery_modes: ['manual'], requires_region: false, requires_platform: false }
    case 'accounts':
      return { delivery_modes: ['manual', 'instant'], requires_region: false, requires_platform: false }
    case 'top-up':
      // Top-ups are region-sensitive (UC, Diamonds, Crystals all vary by region)
      return { delivery_modes: ['manual', 'instant'], requires_region: true, requires_platform: false }
    case 'boosting':
      return { delivery_modes: ['manual'], requires_region: false, requires_platform: false }
    default:
      return { delivery_modes: ['manual'], requires_region: false, requires_platform: false }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const STEPS = [
  { id: 1, label: 'Identity',    description: 'Name, slug, display' },
  { id: 2, label: 'Branding',    description: 'Logo + cover' },
  { id: 3, label: 'Categories',  description: 'Currency, Items, Accounts, Top Up, Boosting' },
  { id: 4, label: 'Review',      description: 'Confirm and save' },
] as const

// ─── Step indicator ───────────────────────────────────────────────────────────

function Stepper({ current, completed }: { current: number; completed: Set<number> }) {
  return (
    <ol className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done = completed.has(s.id) || current > s.id
        const active = current === s.id
        return (
          <li key={s.id} className="flex items-center">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                  done
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : active
                      ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                      : 'border-white/10 bg-white/[0.03] text-gray-500'
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : s.id}
              </span>
              <div className="hidden sm:block">
                <div className={cn('text-xs font-semibold', active ? 'text-white' : done ? 'text-emerald-300' : 'text-gray-500')}>
                  {s.label}
                </div>
                <div className="text-[10px] text-gray-600">{s.description}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-4 h-px w-10 bg-white/10 sm:w-16">
                <div className={cn('h-px transition-all', done ? 'w-full bg-emerald-500/50' : 'w-0')} />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ─── Field primitives ─────────────────────────────────────────────────────────

function Label({ children, hint, required }: { children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <label className="text-xs font-medium text-gray-300">
        {children}
        {required && <span className="ml-1 text-rose-400">*</span>}
      </label>
      {hint && <span className="text-[10px] text-gray-600">{hint}</span>}
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-gray-600',
        'focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-colors',
        props.className
      )}
    />
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface CategoryDraft {
  global_category_id: string
  slug: string
  name: string
  icon_emoji: string | null
  is_active: boolean
  is_enabled: boolean
  requires_region: boolean
  requires_platform: boolean
  available_regions: Array<{ code: string; name: string; currency?: string }>
  available_platforms: string[]
  delivery_modes: string[]
  // remember the original db row id, for upsert efficiency / debugging
  existing_id?: string
}

export default function GameWizard({ mode, game, globalCategories, initialGameCategories }: GameWizardProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Step state — persisted in URL so refresh doesn't lose progress
  const initialStep = Math.min(4, Math.max(1, parseInt(params?.get('step') ?? '1', 10) || 1))
  const [step, setStep] = useState<number>(initialStep)
  const [completed, setCompleted] = useState<Set<number>>(new Set())

  // Identity state
  const [name, setName] = useState(game?.name ?? '')
  const [slug, setSlug] = useState(game?.slug ?? '')
  const [displayName, setDisplayName] = useState(game?.display_name ?? '')
  const [emoji, setEmoji] = useState(game?.emoji ?? '🎮')
  const [sortOrder, setSortOrder] = useState<number>(game?.sort_order ?? 99)
  const [isActive, setIsActive] = useState<boolean>(game?.is_active ?? true)
  const [slugDirty, setSlugDirty] = useState(mode === 'edit') // don't auto-rewrite slug for existing games

  // Branding state
  const [logoUrl, setLogoUrl] = useState<string | null>(game?.image_url ?? null)
  const [coverUrl, setCoverUrl] = useState<string | null>(game?.cover_url ?? null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  // gameId only exists after step 1 saves (for create mode). In edit mode, it's the route param.
  const [gameId, setGameId] = useState<string | null>(game?.id ?? null)

  // Categories state — driven by globalCategories list
  const [categories, setCategories] = useState<CategoryDraft[]>(() => {
    return globalCategories.map((gc) => {
      const existing = initialGameCategories.find((r) => r.global_category_id === gc.id)
      if (existing) {
        return {
          global_category_id: gc.id,
          slug: gc.slug,
          name: gc.name,
          icon_emoji: gc.icon_emoji,
          is_active: gc.is_active,
          is_enabled: existing.is_enabled,
          requires_region: existing.requires_region,
          requires_platform: existing.requires_platform,
          available_regions: existing.available_regions ?? [],
          available_platforms: existing.available_platforms ?? [],
          delivery_modes: existing.delivery_modes ?? ['manual'],
          existing_id: existing.id,
        }
      }
      const d = defaultsForCategory(gc.slug)
      return {
        global_category_id: gc.id,
        slug: gc.slug,
        name: gc.name,
        icon_emoji: gc.icon_emoji,
        is_active: gc.is_active,
        is_enabled: false,
        requires_region: d.requires_region,
        requires_platform: d.requires_platform,
        available_regions: [],
        available_platforms: [],
        delivery_modes: d.delivery_modes,
      }
    })
  })

  // Keep ?step= in sync with the URL on the current route only — never
  // switch routes mid-wizard. In create mode we stay on /new; in edit mode
  // we stay on /[id]/edit.
  useEffect(() => {
    const sp = new URLSearchParams(params?.toString() ?? '')
    sp.set('step', String(step))
    const base = mode === 'create'
      ? '/admin/games-v2/new'
      : (game ? `/admin/games-v2/${game.id}/edit` : null)
    if (base) router.replace(`${base}?${sp.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Auto-slug from name in create mode until the user edits the slug field
  useEffect(() => {
    if (!slugDirty) setSlug(slugify(name))
  }, [name, slugDirty])

  // ── Step 1: save identity ──────────────────────────────────────────────────
  const handleSaveIdentity = async (advance: boolean): Promise<boolean> => {
    if (!name.trim()) { toast.error('Name is required'); return false }
    if (!slug.trim()) { toast.error('Slug is required'); return false }
    setIsSaving(true)
    const result = await saveGameIdentity({
      id: gameId ?? undefined,
      name,
      slug,
      display_name: displayName || null,
      emoji,
      sort_order: sortOrder,
      is_active: isActive,
    })
    setIsSaving(false)
    if (!result.success) {
      toast.error(result.error)
      return false
    }
    setGameId(result.data.id)
    setCompleted((prev) => new Set(Array.from(prev).concat(1)))
    if (advance) setStep(2)
    return true
  }

  // ── Step 2: logo upload ────────────────────────────────────────────────────
  const handleLogoFile = async (file: File) => {
    if (!gameId) { toast.error('Save identity step first'); return }
    if (file.size > 2_097_152) { toast.error('Logo must be 2 MB or smaller'); return }
    setIsUploading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const res = await uploadGameLogoV2(gameId, {
        name: file.name,
        type: file.type,
        size: file.size,
        base64,
      })
      if (!res.success) { toast.error(res.error); return }
      setLogoUrl(res.data.url)
      toast.success('Logo uploaded')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteLogo = async () => {
    if (!gameId) return
    setIsUploading(true)
    try {
      const res = await deleteGameLogoV2(gameId)
      if (!res.success) { toast.error(res.error); return }
      setLogoUrl(null)
      toast.success('Logo removed')
    } finally {
      setIsUploading(false)
    }
  }

  // ── Step 2: cover upload ───────────────────────────────────────────────────
  const handleCoverFile = async (file: File) => {
    if (!gameId) { toast.error('Save identity step first'); return }
    if (file.size > 4_194_304) { toast.error('Cover must be 4 MB or smaller'); return }
    setIsUploadingCover(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const res = await uploadGameCoverV2(gameId, {
        name: file.name, type: file.type, size: file.size, base64,
      })
      if (!res.success) { toast.error(res.error); return }
      setCoverUrl(res.data.url)
      toast.success('Cover uploaded')
    } finally {
      setIsUploadingCover(false)
    }
  }

  const handleDeleteCover = async () => {
    if (!gameId) return
    setIsUploadingCover(true)
    try {
      const res = await deleteGameCoverV2(gameId)
      if (!res.success) { toast.error(res.error); return }
      setCoverUrl(null)
      toast.success('Cover removed')
    } finally {
      setIsUploadingCover(false)
    }
  }

  // ── Step 3: per-category mutations ─────────────────────────────────────────
  const updateCategory = (gcId: string, patch: Partial<CategoryDraft>) => {
    setCategories((prev) => prev.map((c) => (c.global_category_id === gcId ? { ...c, ...patch } : c)))
  }

  const persistCategory = async (draft: CategoryDraft) => {
    if (!gameId) return false
    const res = await upsertGameCategory({
      game_id: gameId,
      global_category_id: draft.global_category_id,
      is_enabled: draft.is_enabled,
      requires_region: draft.requires_region,
      available_regions: draft.available_regions,
      requires_platform: draft.requires_platform,
      available_platforms: draft.available_platforms,
      delivery_modes: draft.delivery_modes,
    })
    if (!res.success) {
      toast.error(`${draft.name}: ${res.error}`)
      return false
    }
    return true
  }

  // ── Step 4: persist everything still pending, then go to list ──────────────
  const handleFinalSave = async () => {
    if (!gameId) {
      // Should never happen — step 1 is required first — but guard anyway.
      const ok = await handleSaveIdentity(false)
      if (!ok) return
    }
    setIsSaving(true)
    let allOk = true
    for (const c of categories) {
      const ok = await persistCategory(c)
      if (!ok) allOk = false
    }
    setIsSaving(false)
    if (allOk) {
      toast.success(mode === 'create' ? 'Game created' : 'Game updated')
      startTransition(() => router.push('/admin/games-v2'))
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  const canGoNext = useMemo(() => {
    if (step === 1) return !!name.trim() && !!slug.trim()
    if (step === 2) return !!gameId      // need an id; logo is optional
    if (step === 3) return !!gameId
    return true
  }, [step, name, slug, gameId])

  const enabledCount = categories.filter((c) => c.is_enabled).length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── Header ── */}
      <header className="space-y-3">
        <Link
          href="/admin/games-v2"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to games
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {mode === 'create' ? 'New game' : `Edit ${game?.name ?? 'game'}`}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                <Sparkles className="h-3 w-3" />
                wizard
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              {mode === 'create'
                ? 'Fill in identity, upload branding, choose which categories the game supports.'
                : 'Update game details and per-category settings.'}
            </p>
          </div>
          <Stepper current={step} completed={completed} />
        </div>
      </header>

      {/* ── Step body ── */}
      <GlassCard intensity="light" rounded="2xl" className="p-0">
        <div className="p-6">
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label required>Name</Label>
                <TextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Steal a Brainrot"
                  autoFocus={mode === 'create'}
                />
              </div>

              <div>
                <Label required hint="lowercase, dashes only — used in URLs">Slug</Label>
                <TextInput
                  value={slug}
                  onChange={(e) => { setSlug(slugify(e.target.value)); setSlugDirty(true) }}
                  placeholder="steal-a-brainrot"
                />
              </div>

              <div>
                <Label hint="short label for navbar">Display name</Label>
                <TextInput
                  value={displayName ?? ''}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Brainrot"
                />
              </div>

              <div>
                <Label hint="fallback if no logo">Emoji</Label>
                <TextInput
                  value={emoji ?? ''}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="🎮"
                  maxLength={4}
                />
              </div>

              <div>
                <Label hint="lower = shown first">Sort order</Label>
                <TextInput
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value || '99', 10))}
                  min={0}
                  max={9999}
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-white">Active</div>
                  <div className="text-xs text-gray-500">Inactive games are hidden from the marketplace.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive((v) => !v)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    isActive ? 'bg-emerald-500/70' : 'bg-white/10'
                  )}
                  aria-pressed={isActive}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      isActive ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <div className="text-sm font-medium text-white">Logo</div>
                <p className="text-xs text-gray-500">Square PNG/WebP, 256×256 recommended. Max 2 MB.</p>
              </div>

              <div className="flex items-center gap-5">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  {logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logoUrl} alt="Logo" className="h-full w-full rounded-2xl object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-600" />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className={cn(
                    'inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-white/90',
                    isUploading && 'pointer-events-none opacity-60'
                  )}>
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {logoUrl ? 'Replace logo' : 'Upload logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.currentTarget.value = '' }}
                      disabled={isUploading}
                    />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleDeleteLogo}
                      disabled={isUploading}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/[0.1] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove logo
                    </button>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/[0.06]" />

              <div>
                <div className="text-sm font-medium text-white">Cover art</div>
                <p className="text-xs text-gray-500">Portrait JPG/PNG/WebP, 600×800 recommended. Used on the Popular Games shelf. Max 4 MB.</p>
              </div>

              <div className="flex items-center gap-5">
                <div className="flex h-32 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  {coverUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-600" />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className={cn(
                    'inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-white/90',
                    isUploadingCover && 'pointer-events-none opacity-60'
                  )}>
                    {isUploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {coverUrl ? 'Replace cover' : 'Upload cover'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverFile(f); e.currentTarget.value = '' }}
                      disabled={isUploadingCover}
                    />
                  </label>
                  {coverUrl && (
                    <button
                      type="button"
                      onClick={handleDeleteCover}
                      disabled={isUploadingCover}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/[0.1] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove cover
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Categories</div>
                  <p className="text-xs text-gray-500">Toggle which categories this game supports. Boosting is disabled at launch.</p>
                </div>
                <div className="text-xs text-gray-500">{enabledCount} of {categories.length} enabled</div>
              </div>

              <div className="space-y-2">
                {categories.map((c) => {
                  const disabledGlobally = !c.is_active
                  return (
                    <div
                      key={c.global_category_id}
                      className={cn(
                        'rounded-xl border bg-white/[0.02] transition-colors',
                        c.is_enabled
                          ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                          : 'border-white/10',
                        disabledGlobally && 'opacity-70'
                      )}
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl" aria-hidden>{c.icon_emoji ?? '•'}</span>
                          <div>
                            <div className="text-sm font-medium text-white">{c.name}</div>
                            <div className="text-[11px] text-gray-500">
                              {disabledGlobally ? 'Disabled at launch' : `Slug: ${c.slug}`}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateCategory(c.global_category_id, { is_enabled: !c.is_enabled })}
                          disabled={disabledGlobally}
                          className={cn(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                            c.is_enabled ? 'bg-emerald-500/70' : 'bg-white/10',
                            disabledGlobally && 'cursor-not-allowed opacity-50'
                          )}
                          aria-pressed={c.is_enabled}
                          title={disabledGlobally ? 'This category is disabled at launch' : ''}
                        >
                          <span
                            className={cn(
                              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                              c.is_enabled ? 'translate-x-6' : 'translate-x-1'
                            )}
                          />
                        </button>
                      </div>

                      {/* Per-category settings — only show when enabled */}
                      {c.is_enabled && (
                        <div className="space-y-3 border-t border-white/[0.06] px-4 py-3">
                          {/* Delivery modes */}
                          <div>
                            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Delivery modes</div>
                            <div className="flex gap-2">
                              {(['manual', 'instant'] as const).map((mode) => {
                                const on = c.delivery_modes.includes(mode)
                                return (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => {
                                      const next = on
                                        ? c.delivery_modes.filter((m) => m !== mode)
                                        : [...c.delivery_modes, mode]
                                      // Always require at least one mode
                                      if (next.length === 0) {
                                        toast.error('At least one delivery mode is required')
                                        return
                                      }
                                      updateCategory(c.global_category_id, { delivery_modes: next })
                                    }}
                                    className={cn(
                                      'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
                                      on
                                        ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                                        : 'border-white/10 bg-white/[0.02] text-gray-400 hover:text-white'
                                    )}
                                  >
                                    {mode === 'manual' ? <Clock className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                                    {mode === 'manual' ? 'Manual' : 'Instant'}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Region toggle */}
                          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                            <div className="flex items-center gap-2 text-xs">
                              <Globe2 className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-gray-300">Requires region</span>
                              <span className="text-gray-600">— buyer must pick a region</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateCategory(c.global_category_id, { requires_region: !c.requires_region })}
                              className={cn(
                                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                                c.requires_region ? 'bg-violet-500/70' : 'bg-white/10'
                              )}
                              aria-pressed={c.requires_region}
                            >
                              <span
                                className={cn(
                                  'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                                  c.requires_region ? 'translate-x-5' : 'translate-x-1'
                                )}
                              />
                            </button>
                          </div>

                          {/* Platform toggle */}
                          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                            <div className="flex items-center gap-2 text-xs">
                              <Monitor className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-gray-300">Requires platform</span>
                              <span className="text-gray-600">— e.g. PC / PlayStation / Xbox</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateCategory(c.global_category_id, { requires_platform: !c.requires_platform })}
                              className={cn(
                                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                                c.requires_platform ? 'bg-violet-500/70' : 'bg-white/10'
                              )}
                              aria-pressed={c.requires_platform}
                            >
                              <span
                                className={cn(
                                  'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                                  c.requires_platform ? 'translate-x-5' : 'translate-x-1'
                                )}
                              />
                            </button>
                          </div>

                          {gameId && (
                            <Link
                              href={`/admin/games-v2/${gameId}/templates/${c.slug}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 text-[11px] font-semibold text-violet-300 transition-colors hover:bg-violet-500/15"
                            >
                              <Sparkles className="h-3 w-3" />
                              Edit attribute template
                            </Link>
                          )}
                          {!gameId && (
                            <p className="text-[10px] text-gray-600">
                              Save identity step first, then come back here to edit this category's attribute template.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="text-sm font-medium text-white">Review</div>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ReviewRow label="Name" value={name} />
                <ReviewRow label="Slug" value={slug} mono />
                <ReviewRow label="Display name" value={displayName || '—'} />
                <ReviewRow label="Emoji" value={emoji || '—'} />
                <ReviewRow label="Sort order" value={String(sortOrder)} />
                <ReviewRow label="Status" value={isActive ? 'Active' : 'Paused'} />
                <ReviewRow label="Logo" value={logoUrl ? 'Uploaded' : 'Emoji fallback'} />
                <ReviewRow label="Cover art" value={coverUrl ? 'Uploaded' : 'None yet'} />
                <ReviewRow label="Categories enabled" value={`${enabledCount} of ${categories.length}`} />
              </dl>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11px] text-gray-500">
                Identity and logo are saved as you go. Hitting <span className="font-semibold text-gray-300">Save game</span> persists the
                per-category toggles and returns to the games list.
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-6 py-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || isSaving}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-gray-200 transition-colors hover:bg-white/[0.08] disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="flex items-center gap-2">
            {step < 4 && (
              <button
                type="button"
                onClick={async () => {
                  if (step === 1) {
                    const ok = await handleSaveIdentity(true)
                    if (!ok) return
                  } else {
                    setCompleted((p) => new Set(Array.from(p).concat(step)))
                    setStep((s) => Math.min(4, s + 1))
                  }
                }}
                disabled={!canGoNext || isSaving}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {step === 1 ? 'Save and continue' : 'Continue'}
              </button>
            )}
            {step === 4 && (
              <button
                type="button"
                onClick={handleFinalSave}
                disabled={isSaving || pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                {isSaving || pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save game
              </button>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className={cn('text-sm text-white', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  )
}
