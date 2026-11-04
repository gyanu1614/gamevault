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
 *
 * This file keeps the state, the saves and the step navigation. Each step's
 * form is its own file (GameWizardStep1–4, GameWizardStepper, GameWizardFooter);
 * the per-category draft shape and defaults are in game-wizard-model.ts.
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from '@/components/navigation/AppLink'
import { toast } from 'sonner'
import { CaretLeft } from '@phosphor-icons/react'
import { slugify } from '@/lib/utils'
import { useFilePicker } from '../../components/useFilePicker'
import type { PixelRect } from '../../components/ImageCropDialog'
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
import type { GameContentTier, GameEcosystem } from '@/lib/games/validate-game'
import { initialCategoryDrafts, type CategoryDraft, type GlobalCategoryLite } from './game-wizard-model'
import { Stepper } from './GameWizardStepper'
import { IdentityStep } from './GameWizardStep1'
import { BrandingStep } from './GameWizardStep2'
import { CategoriesStep } from './GameWizardStep3'
import { ReviewStep } from './GameWizardStep4'
import { WizardFooter } from './GameWizardFooter'

// ─── Types passed in by the server-rendered route wrapper ────────────────────

export type { GlobalCategoryLite }

export interface GameWizardProps {
  mode: 'create' | 'edit'
  game: GameDetail | null            // null in create mode
  globalCategories: GlobalCategoryLite[]
  initialGameCategories: GameCategoryRow[]   // empty in create mode
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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
  const [categories, setCategories] = useState<CategoryDraft[]>(() =>
    initialCategoryDrafts(globalCategories, initialGameCategories),
  )

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
            <IdentityStep
              mode={mode}
              name={name}
              setName={setName}
              slug={slug}
              setSlug={setSlug}
              setSlugDirty={setSlugDirty}
              displayName={displayName}
              setDisplayName={setDisplayName}
              emoji={emoji}
              setEmoji={setEmoji}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              contentTier={contentTier}
              setContentTier={setContentTier}
              ecosystem={ecosystem}
              setEcosystem={setEcosystem}
              isActive={isActive}
              setIsActive={setIsActive}
            />
          )}

          {step === 2 && (
            <BrandingStep
              game={game}
              gameId={gameId}
              name={name}
              slug={slug}
              logoUrl={logoUrl}
              coverUrl={coverUrl}
              blogCtaUrl={blogCtaUrl}
              isUploading={isUploading}
              isUploadingCover={isUploadingCover}
              isUploadingBlogCta={isUploadingBlogCta}
              pendingBlogCta={pendingBlogCta}
              setPendingBlogCta={setPendingBlogCta}
              logoPicker={logoPicker}
              coverPicker={coverPicker}
              blogCtaPicker={blogCtaPicker}
              handleDeleteLogo={handleDeleteLogo}
              handleDeleteCover={handleDeleteCover}
              handleBlogCtaCropped={handleBlogCtaCropped}
            />
          )}

          {step === 3 && (
            <CategoriesStep
              categories={categories}
              enabledCount={enabledCount}
              gameId={gameId}
              updateCategory={updateCategory}
            />
          )}

          {step === 4 && (
            <ReviewStep
              name={name}
              slug={slug}
              displayName={displayName}
              emoji={emoji}
              sortOrder={sortOrder}
              contentTier={contentTier}
              ecosystem={ecosystem}
              isActive={isActive}
              logoUrl={logoUrl}
              coverUrl={coverUrl}
              enabledCount={enabledCount}
              categories={categories}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <WizardFooter
          step={step}
          setStep={setStep}
          setCompleted={setCompleted}
          isSaving={isSaving}
          pending={pending}
          canGoNext={canGoNext}
          handleSaveIdentity={handleSaveIdentity}
          handleFinalSave={handleFinalSave}
        />
      </section>
    </div>
  )
}
