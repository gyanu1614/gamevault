'use client'

/**
 * GameWizard — shared client component for /admin/games/new and
 * /admin/games/[id]/edit. Single source of truth for the redesigned
 * add/edit flow. Flat admin kit (../../components/kit): solid fills,
 * no outlines, Phosphor icons, Title Case labels.
 *
 * Steps:
 *   1. Identity   — name, slug, display_name, emoji, sort_order,
 *                  content_tier, ecosystem
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
import Link from '@/components/navigation/AppLink'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, CaretLeft, Check, CircleNotch, Clock, FloppyDisk,
  Globe, ImageSquare, Info, Lightning, Monitor, SlidersHorizontal, Trash, UploadSimple,
} from '@phosphor-icons/react'
import { cn, slugify } from '@/lib/utils'
import { accountInputCls } from '@/components/account/AccountSurface'
import { Switch } from '@/components/ui/switch'
import { PanelHead, adminBtn, adminBtnSm } from '../../components/kit'
import { useFilePicker } from '../../components/useFilePicker'
import { ImageCropDialog, type PixelRect } from '../../components/ImageCropDialog'
import { HeroBackgroundField } from './HeroBackgroundField'
import { MAX_IMAGE_UPLOAD_BYTES, imageTooLargeMessage, readFileAsDataUrl, uploadErrorMessage } from '@/lib/uploads/image-upload'
import {
  saveGameIdentity,
  upsertGameCategory,
  uploadGameLogoV2,
  deleteGameLogoV2,
  uploadGameCoverV2,
  deleteGameCoverV2,
  uploadGameBlogCtaImage,
  type GameDetail,
  type GameCategoryRow,
} from '@/lib/actions/admin-game-wizard'
import {
  GAME_CONTENT_TIERS,
  GAME_ECOSYSTEMS,
  type GameContentTier,
  type GameEcosystem,
} from '@/lib/games/validate-game'

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

const STEPS = [
  { id: 1, label: 'Identity',    description: 'Name, slug, display' },
  { id: 2, label: 'Branding',    description: 'Logo + cover' },
  { id: 3, label: 'Categories',  description: 'Currency, Items, Accounts, Top Up, Boosting' },
  { id: 4, label: 'Review',      description: 'Confirm and save' },
] as const

// ─── Step indicator ───────────────────────────────────────────────────────────

function Stepper({
  current,
  completed,
  onJump,
}: {
  current: number
  completed: Set<number>
  /**
   * V17n — When provided, the stepper renders each step as a clickable
   * button. Used in edit mode so admins can hop straight to any step
   * since all data is already loaded. In create mode the parent leaves
   * this undefined, keeping the linear "Save and continue" flow.
   */
  onJump?: (id: number) => void
}) {
  // Flat stepper: one progress segment per step (done = success, current =
  // lime, ahead = neutral) over a numbered circle + label. Four equal
  // columns at every width; below sm the label sits under the circle so
  // "Categories" fits a 375px screen without truncating or scrolling.
  return (
    <nav aria-label="Setup Steps">
      <ol className="grid grid-cols-4 gap-3">
        {STEPS.map((s) => {
          const done = completed.has(s.id) || current > s.id
          const active = current === s.id
          const clickable = !!onJump
          const Item = clickable ? 'button' : 'div'
          return (
            <li key={s.id} className="min-w-0">
              <Item
                type={clickable ? 'button' : undefined}
                onClick={clickable ? () => onJump!(s.id) : undefined}
                className={cn(
                  'flex w-full min-w-0 flex-col gap-2.5 rounded-md text-left',
                  clickable &&
                    '-m-1.5 w-[calc(100%+12px)] cursor-pointer p-1.5 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring',
                )}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  aria-hidden
                  className={cn(
                    'h-1 w-full rounded-full transition-colors',
                    done ? 'bg-success' : active ? 'bg-lime' : 'bg-white/[0.08]',
                  )}
                />
                <span className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2.5">
                  <span
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold tabular-nums transition-colors sm:h-7 sm:w-7 sm:text-[12px]',
                      done
                        ? 'bg-success-bg text-success'
                        : active
                          ? 'bg-lime text-text-inverse'
                          : 'bg-white/[0.06] text-text-tertiary',
                    )}
                  >
                    {done ? <Check aria-hidden weight="bold" className="h-3.5 w-3.5" /> : s.id}
                  </span>
                  <span className="block w-full min-w-0">
                    <span
                      className={cn(
                        'block truncate text-[12px] font-semibold sm:text-[13px]',
                        active ? 'text-text-primary' : done ? 'text-text-secondary' : 'text-text-tertiary',
                      )}
                    >
                      {s.label}
                    </span>
                    <span className="hidden truncate text-[11.5px] text-text-tertiary md:block">{s.description}</span>
                  </span>
                </span>
              </Item>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

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
  // Phase 1 · Step 1 — two-tier catalogue. `listed` is the default: a new game
  // is marketplace-only until someone actually builds a values hub for it.
  const [contentTier, setContentTier] = useState<GameContentTier>(
    (game?.content_tier as GameContentTier) ?? 'listed',
  )
  const [ecosystem, setEcosystem] = useState<GameEcosystem | ''>(
    (game?.ecosystem as GameEcosystem) ?? '',
  )
  const [isActive, setIsActive] = useState<boolean>(game?.is_active ?? true)
  const [slugDirty, setSlugDirty] = useState(mode === 'edit') // don't auto-rewrite slug for existing games

  // Branding state
  const [logoUrl, setLogoUrl] = useState<string | null>(game?.image_url ?? null)
  const [coverUrl, setCoverUrl] = useState<string | null>(game?.cover_url ?? null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [blogCtaUrl, setBlogCtaUrl] = useState<string | null>(
    game?.blog_cta_image_url ?? null,
  )
  const [isUploadingBlogCta, setIsUploadingBlogCta] = useState(false)
  const [pendingBlogCta, setPendingBlogCta] = useState<File | null>(null)
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
      ? '/admin/games/new'
      : (game ? `/admin/games/${game.id}/edit` : null)
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
      content_tier: contentTier,
      ecosystem: ecosystem || null,
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
    const tooLarge = imageTooLargeMessage(file, 2_097_152, 'Logo')
    if (tooLarge) { toast.error(tooLarge); return }
    setIsUploading(true)
    try {
      const base64 = await readFileAsDataUrl(file)
      const res = await uploadGameLogoV2(gameId, {
        name: file.name,
        type: file.type,
        size: file.size,
        base64,
      })
      if (!res.success) { toast.error(res.error); return }
      setLogoUrl(res.data.url)
      toast.success('Logo uploaded')
    } catch (error) {
      toast.error(uploadErrorMessage(error))
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
    // The server allows 4 MB, but a file only gets through a server action
    // (base64, ×4/3) up to MAX_IMAGE_UPLOAD_BYTES.
    const tooLarge = imageTooLargeMessage(file, MAX_IMAGE_UPLOAD_BYTES, 'Cover')
    if (tooLarge) { toast.error(tooLarge); return }
    setIsUploadingCover(true)
    try {
      const base64 = await readFileAsDataUrl(file)
      const res = await uploadGameCoverV2(gameId, {
        name: file.name, type: file.type, size: file.size, base64,
      })
      if (!res.success) { toast.error(res.error); return }
      setCoverUrl(res.data.url)
      toast.success('Cover uploaded')
    } catch (error) {
      toast.error(uploadErrorMessage(error))
    } finally {
      setIsUploadingCover(false)
    }
  }

  // Pick → crop dialog (4:1 box) → upload the source with the chosen area;
  // the server cuts it and saves one AVIF under 100 KB.
  const handleBlogCtaFile = (file: File) => {
    if (!gameId) { toast.error('Save identity step first'); return }
    const tooLarge = imageTooLargeMessage(file, MAX_IMAGE_UPLOAD_BYTES, 'Banner')
    if (tooLarge) { toast.error(tooLarge); return }
    setPendingBlogCta(file)
  }

  const handleBlogCtaCropped = async (rect: PixelRect) => {
    const file = pendingBlogCta
    if (!gameId || !file) return
    setIsUploadingBlogCta(true)
    try {
      const base64 = await readFileAsDataUrl(file)
      const res = await uploadGameBlogCtaImage(gameId, {
        name: file.name, type: file.type, size: file.size, base64,
      }, rect)
      if (!res.success) { toast.error(res.error); return }
      setBlogCtaUrl(res.data.url)
      setPendingBlogCta(null)
      toast.success('Blog banner uploaded')
    } catch (error) {
      toast.error(uploadErrorMessage(error))
    } finally {
      setIsUploadingBlogCta(false)
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
      startTransition(() => router.push('/admin/games'))
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

  // Real buttons open these pickers (keyboard-reachable; a <label> around a
  // display:none input isn't). Each clears itself so re-picking a file works.
  const logoPicker = useFilePicker(handleLogoFile, 'image/png,image/jpeg,image/jpg,image/svg+xml,image/webp')
  const coverPicker = useFilePicker(handleCoverFile, 'image/png,image/jpeg,image/jpg,image/webp')
  const blogCtaPicker = useFilePicker(handleBlogCtaFile, 'image/png,image/jpeg,image/jpg,image/webp,image/avif')

  return (
    // V17l — Wizard now uses the full admin content width (same as the
    // games list) so the page geometry doesn't jump when you click Edit
    // or New. Was max-w-4xl which made forms feel cramped + visually
    // off-center against the list.
    <div className="space-y-5">
      {/* ── Header ── */}
      <header className="space-y-5">
        {/* In edit mode the wizard sits inside GameDetailTabs' Setup tab, which
            already has the back link and the game's h1. */}
        {mode === 'create' && (
        <div className="min-w-0">
          <Link
            href="/admin/games"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
            Back to Games
          </Link>
          <h1 className="mt-2 break-words text-[24px] font-bold leading-tight tracking-tight text-text-primary sm:text-[28px]">
            {mode === 'create' ? 'New Game' : `Edit ${game?.name ?? 'game'}`}
          </h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-text-secondary">
            {mode === 'create'
              ? 'Fill in identity, upload branding, choose which categories the game supports.'
              : 'Update game details and per-category settings.'}
          </p>
        </div>
        )}
        <Stepper
          current={step}
          completed={completed}
          // V17n — Clickable steps in edit mode. The game already exists,
          // every step is safe to land on. In create mode we keep the
          // linear flow so admins can't skip past required setup.
          onJump={mode === 'edit' ? (id) => setStep(id) : undefined}
        />
      </header>

      {/* ── Step body ── */}
      <section className="rounded-lg bg-bg-raised">
        <div className="p-4 sm:p-6">
          {step === 1 && (
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
          )}

          {step === 2 && (
            <div className="space-y-5">
              <PanelHead title="Branding" className="mb-0" />
              <div>
                <div className="text-[13.5px] font-semibold text-text-primary">Logo</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-tertiary">Square PNG/WebP, 256×256 recommended. Max 2 MB.</p>
              </div>

              <div className="flex items-center gap-4 sm:gap-5">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-overlay">
                  {logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <ImageSquare aria-hidden weight="bold" className="h-8 w-8 text-text-disabled" />
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                  <button type="button" onClick={logoPicker.open} disabled={isUploading} className={adminBtn.secondary}>
                    {isUploading
                      ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                      : <UploadSimple aria-hidden weight="bold" className="h-4 w-4" />}
                    {isUploading ? 'Uploading…' : logoUrl ? 'Replace Logo' : 'Upload Logo'}
                  </button>
                  {logoPicker.input}
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleDeleteLogo}
                      disabled={isUploading}
                      className={adminBtn.danger}
                    >
                      <Trash aria-hidden weight="bold" className="h-4 w-4" />
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/[0.06]" />

              <div>
                <div className="text-[13.5px] font-semibold text-text-primary">Cover Art</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-tertiary">Portrait JPG/PNG/WebP, 600×800 recommended. Used on the Popular Games shelf. Max 2.5 MB.</p>
              </div>

              <div className="flex items-center gap-4 sm:gap-5">
                <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-overlay">
                  {coverUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
                  ) : (
                    <ImageSquare aria-hidden weight="bold" className="h-8 w-8 text-text-disabled" />
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                  <button type="button" onClick={coverPicker.open} disabled={isUploadingCover} className={adminBtn.secondary}>
                    {isUploadingCover
                      ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                      : <UploadSimple aria-hidden weight="bold" className="h-4 w-4" />}
                    {isUploadingCover ? 'Uploading…' : coverUrl ? 'Replace Cover' : 'Upload Cover'}
                  </button>
                  {coverPicker.input}
                  {coverUrl && (
                    <button
                      type="button"
                      onClick={handleDeleteCover}
                      disabled={isUploadingCover}
                      className={adminBtn.danger}
                    >
                      <Trash aria-hidden weight="bold" className="h-4 w-4" />
                      Remove Cover
                    </button>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/[0.06]" />

              {/* Blog CTA banner — separate from cover art on purpose: this one
                  is wide and has copy sitting on top of it. */}
              <div>
                <div className="text-[13.5px] font-semibold text-text-primary">Blog CTA Banner</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-tertiary">
                  Wide JPG/PNG/WebP/AVIF, <strong className="font-semibold text-text-secondary">1600 px wide or more</strong>; you choose a 4:1 area after picking, and it is saved as a small AVIF.
                  The game&rsquo;s one CTA image: sits behind every Buy / Sell band for this game
                  (values, calculators, guides, the sell page). Keep the focal point off-centre-left
                  — the copy covers the left third under a dark scrim. Max 2.5 MB.
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
                <div className="flex h-24 w-full max-w-[384px] items-center justify-center overflow-hidden rounded-md bg-bg-overlay">
                  {blogCtaUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={blogCtaUrl} alt="Blog CTA banner" className="h-full w-full object-cover" />
                  ) : (
                    <ImageSquare aria-hidden weight="bold" className="h-8 w-8 text-text-disabled" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={blogCtaPicker.open}
                  disabled={isUploadingBlogCta}
                  className={cn(adminBtn.secondary, 'shrink-0')}
                >
                  {isUploadingBlogCta
                    ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                    : <UploadSimple aria-hidden weight="bold" className="h-4 w-4" />}
                  {isUploadingBlogCta ? 'Uploading…' : blogCtaUrl ? 'Replace Banner' : 'Upload Banner'}
                </button>
                {blogCtaPicker.input}
              </div>
              <ImageCropDialog
                file={pendingBlogCta}
                aspect={4}
                title="Choose the Banner Area"
                hint="A 4:1 band behind every Buy / Sell banner for this game. Keep the subject right of centre: the copy covers the left third."
                minWidth={1200}
                busy={isUploadingBlogCta}
                onCancel={() => setPendingBlogCta(null)}
                onConfirm={handleBlogCtaCropped}
              />

              <div className="h-px bg-white/[0.06]" />

              {/* Hero background — the game's ONE hero image on every page of
                  the game (GameHeroBackdrop). Saves on its own, like the
                  uploads above. */}
              <HeroBackgroundField
                gameId={gameId}
                gameSlug={slug}
                initialRow={
                  game
                    ? {
                        hero_bg_url: game.hero_bg_url ?? null,
                        hero_bg_srcset: game.hero_bg_srcset ?? null,
                        hero_bg_blur: game.hero_bg_blur ?? null,
                        hero_bg_focal_y: game.hero_bg_focal_y ?? null,
                        hero_bg_updated_at: game.hero_bg_updated_at ?? null,
                      }
                    : null
                }
              />
            </div>
          )}

          {step === 3 && (
            <div>
              <PanelHead
                title="Categories"
                subtitle="Toggle which categories this game supports. Boosting is disabled at launch."
                aside={
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-semibold tabular-nums text-text-secondary">
                    {enabledCount} of {categories.length} enabled
                  </span>
                }
              />

              <div className="space-y-2">
                {categories.map((c) => {
                  const disabledGlobally = !c.is_active
                  return (
                    <div
                      key={c.global_category_id}
                      className={cn(
                        'rounded-md transition-colors',
                        c.is_enabled ? 'bg-white/[0.07]' : 'bg-white/[0.03]',
                        disabledGlobally && 'opacity-60'
                      )}
                    >
                      {/* The whole row is the on/off control: lighter fill + check when on. */}
                      <button
                        type="button"
                        onClick={() => updateCategory(c.global_category_id, { is_enabled: !c.is_enabled })}
                        disabled={disabledGlobally}
                        className={cn(
                          'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors sm:px-4',
                          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring',
                          c.is_enabled ? 'rounded-t-md' : 'rounded-md',
                          disabledGlobally ? 'cursor-not-allowed' : 'hover:bg-white/[0.03]'
                        )}
                        aria-pressed={c.is_enabled}
                        title={disabledGlobally ? 'This category is disabled at launch' : ''}
                      >
                        <span
                          aria-hidden
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/[0.05] text-[18px] leading-none"
                        >
                          {c.icon_emoji ?? '•'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-text-primary">{c.name}</span>
                          <span className="block truncate text-[12px] text-text-tertiary">
                            {disabledGlobally ? 'Disabled at launch' : `Slug: ${c.slug}`}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className={cn(
                            'grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors',
                            c.is_enabled ? 'bg-success text-text-inverse' : 'bg-white/[0.08] text-transparent'
                          )}
                        >
                          <Check weight="bold" className="h-3.5 w-3.5" />
                        </span>
                      </button>

                      {/* Per-category settings — only show when enabled */}
                      {c.is_enabled && (
                        <div className="divide-y divide-white/[0.06] border-t border-white/[0.06] px-3.5 sm:px-4">
                          {/* Delivery modes */}
                          <div className="py-3">
                            <div className="mb-2 text-[12px] font-medium text-text-tertiary">Delivery Modes</div>
                            <div className="flex flex-wrap gap-1.5">
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
                                    aria-pressed={on}
                                    className={cn(
                                      'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors',
                                      on
                                        ? 'bg-white/[0.14] text-text-primary'
                                        : 'bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary'
                                    )}
                                  >
                                    {mode === 'manual'
                                      ? <Clock aria-hidden weight="bold" className="h-3.5 w-3.5" />
                                      : <Lightning aria-hidden weight={on ? 'fill' : 'bold'} className="h-3.5 w-3.5" />}
                                    {mode === 'manual' ? 'Manual' : 'Instant'}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Region toggle */}
                          <label className="flex cursor-pointer items-center gap-3 py-3">
                            <Globe aria-hidden weight="bold" className="h-4 w-4 shrink-0 text-text-tertiary" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium text-text-primary">Requires Region</span>
                              <span className="block text-[12px] text-text-tertiary">Buyer must pick a region</span>
                            </span>
                            <Switch
                              checked={c.requires_region}
                              onCheckedChange={() => updateCategory(c.global_category_id, { requires_region: !c.requires_region })}
                              aria-label={`${c.name}: requires region`}
                              className="data-[state=unchecked]:bg-white/[0.12]"
                            />
                          </label>

                          {/* Platform toggle */}
                          <label className="flex cursor-pointer items-center gap-3 py-3">
                            <Monitor aria-hidden weight="bold" className="h-4 w-4 shrink-0 text-text-tertiary" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium text-text-primary">Requires Platform</span>
                              <span className="block text-[12px] text-text-tertiary">E.g. PC / PlayStation / Xbox</span>
                            </span>
                            <Switch
                              checked={c.requires_platform}
                              onCheckedChange={() => updateCategory(c.global_category_id, { requires_platform: !c.requires_platform })}
                              aria-label={`${c.name}: requires platform`}
                              className="data-[state=unchecked]:bg-white/[0.12]"
                            />
                          </label>

                          <div className="py-3">
                            {gameId && (
                              <Link
                                href={`/admin/games/${gameId}/templates/${c.slug}`}
                                className={adminBtnSm.secondary}
                              >
                                <SlidersHorizontal aria-hidden weight="bold" className="h-3.5 w-3.5" />
                                Edit Attribute Template
                              </Link>
                            )}
                            {!gameId && (
                              <p className="text-[12px] leading-relaxed text-text-tertiary">
                                Save identity step first, then come back here to edit this category&apos;s attribute template.
                              </p>
                            )}
                          </div>
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
              <PanelHead title="Review" className="mb-0" />
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ReviewRow label="Name" value={name} />
                <ReviewRow label="Slug" value={slug} mono />
                <ReviewRow label="Display Name" value={displayName || '—'} />
                <ReviewRow label="Emoji" value={emoji || '—'} />
                <ReviewRow label="Sort Order" value={String(sortOrder)} />
                <ReviewRow label="Content Tier" value={contentTier} />
                <ReviewRow label="Platform" value={ecosystem || '— not set —'} />
                <ReviewRow label="Status" value={isActive ? 'Active' : 'Paused'} />
                <ReviewRow label="Logo" value={logoUrl ? 'Uploaded' : 'Emoji fallback'} />
                <ReviewRow label="Cover Art" value={coverUrl ? 'Uploaded' : 'None yet'} />
                <ReviewRow label="Categories Enabled" value={`${enabledCount} of ${categories.length}`} />
              </dl>

              <div className="flex gap-2.5 rounded-md bg-info-bg px-3.5 py-2.5 text-[13px] leading-relaxed text-text-secondary">
                <Info aria-hidden weight="bold" className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                <p>
                  Identity and logo are saved as you go. Hitting <span className="font-semibold text-text-primary">Save Game</span> persists the
                  per-category toggles and returns to the games list.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || isSaving}
            className={adminBtn.secondary}
          >
            <ArrowLeft aria-hidden weight="bold" className="h-4 w-4" />
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
                className={adminBtn.primary}
              >
                {isSaving
                  ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                  : <ArrowRight aria-hidden weight="bold" className="h-4 w-4" />}
                {step === 1 ? 'Save and Continue' : 'Continue'}
              </button>
            )}
            {step === 4 && (
              <button
                type="button"
                onClick={handleFinalSave}
                disabled={isSaving || pending}
                className={adminBtn.primary}
              >
                {isSaving || pending
                  ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                  : <FloppyDisk aria-hidden weight="bold" className="h-4 w-4" />}
                Save Game
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-bg-overlay px-3.5 py-2.5">
      <dt className="shrink-0 text-[12.5px] text-text-tertiary">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right text-[13.5px] font-medium text-text-primary',
          mono && 'font-mono text-[12.5px]'
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}
