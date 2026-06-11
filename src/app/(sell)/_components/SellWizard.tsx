'use client'

/**
 * SellWizard — the seller's listing creator at /sell/new.
 *
 * 4 steps, all client-side after the initial categories fetch:
 *   1. Pick category    (5 global categories; Boosting disabled)
 *   2. Pick game        (only games where that category is enabled)
 *   3. Offer details    (dynamic from attribute_templates; sub-fields
 *                        appear inline as the seller picks values)
 *   4. Publish          (title, images, description, pricing, stock,
 *                        delivery method, fee preview, submit)
 *
 * Layout shell is owned by (sell)/layout.tsx — no navbar, no sidebar.
 * Writes go to the live `listings` table (same shape as the old flow),
 * so the marketplace keeps rendering them without changes.
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowRight, Check, Loader2, Upload, X as IconX, Image as ImageIcon,
  ChevronLeft, Sparkles, Search, DollarSign, Package, Clock, Zap, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import {
  fetchSellGamesForCategory,
  fetchSellTemplate,
  publishListing,
  uploadSellImage,
  type SellGameOption,
} from '@/lib/actions/sell-wizard'
import type {
  GlobalCategory,
  AttributeTemplateFull,
  Attribute,
} from '@/lib/actions/new-schema'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Category',  hint: 'What are you selling?' },
  { id: 2, label: 'Game',      hint: 'Which game is it for?' },
  { id: 3, label: 'Details',   hint: 'Tell us about the offer' },
  { id: 4, label: 'Publish',   hint: 'Title, photos, price' },
] as const

/** Pure visibility check (mirrors sell-wizard.ts/shouldShowAttribute). */
function isVisible(attr: Attribute, values: Record<string, unknown>): boolean {
  const rules = attr.conditional_rules ?? []
  if (rules.length === 0) return true
  for (const r of rules) {
    const cur = values[r.trigger_attribute_id]
    const trig = r.trigger_values ?? []
    let pass = false
    switch (r.operator) {
      case 'equals':     pass = trig.length > 0 && cur === trig[0]; break
      case 'not_equals': pass = trig.length > 0 && cur !== trig[0]; break
      case 'in':         pass = trig.includes(cur as string); break
      case 'not_in':     pass = !trig.includes(cur as string); break
    }
    if (!pass) return false
  }
  return true
}

// ─── Top bar ─────────────────────────────────────────────────────────────────

function TopBar({ step, onExit }: { step: number; onExit: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight text-white">
          GameVault
        </Link>
        <div className="hidden items-center gap-1 sm:flex">
          {STEPS.map((s, i) => {
            const done = step > s.id
            const active = step === s.id
            return (
              <div key={s.id} className="flex items-center gap-1">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors',
                    done
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : active
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                        : 'border-white/10 text-gray-500'
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : s.id}
                </span>
                <span
                  className={cn(
                    'text-[11px]',
                    active ? 'font-semibold text-white' : done ? 'text-emerald-300' : 'text-gray-600'
                  )}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <span className="mx-1.5 text-gray-700">·</span>}
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-gray-300 transition-colors hover:bg-white/[0.08]"
        >
          Save & exit
        </button>
      </div>
    </header>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function SellWizard({ initialCategories }: { initialCategories: GlobalCategory[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // ── Step + selection state ─────────────────────────────────────────────
  const [step, setStep] = useState(1)
  const [categories] = useState<GlobalCategory[]>(initialCategories)
  const [selectedCategory, setSelectedCategory] = useState<GlobalCategory | null>(null)

  const [games, setGames] = useState<SellGameOption[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [selectedGame, setSelectedGame] = useState<SellGameOption | null>(null)
  const [gameFilter, setGameFilter] = useState('')

  const [template, setTemplate] = useState<AttributeTemplateFull | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({})
  const [region, setRegion] = useState<string>('')
  const [platform, setPlatform] = useState<string>('')

  // ── Publish step state ─────────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<string>('')
  const [originalPrice, setOriginalPrice] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('1')
  const [minQuantity, setMinQuantity] = useState<string>('1')
  const [deliveryMethod, setDeliveryMethod] = useState<'manual' | 'instant'>('manual')
  const [deliveryTime, setDeliveryTime] = useState<string>('1hr')
  const [images, setImages] = useState<string[]>([])
  const [imageUploading, setImageUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Effects ────────────────────────────────────────────────────────────

  // Load games when category changes (step 1 -> 2 transition)
  useEffect(() => {
    if (!selectedCategory) return
    let cancelled = false
    setGamesLoading(true)
    fetchSellGamesForCategory(selectedCategory.slug)
      .then((res) => {
        if (cancelled) return
        if (res.success) setGames(res.data)
        else toast.error(res.error)
      })
      .finally(() => { if (!cancelled) setGamesLoading(false) })
    return () => { cancelled = true }
  }, [selectedCategory])

  // Load template when game + category locked in
  useEffect(() => {
    if (!selectedCategory || !selectedGame) return
    let cancelled = false
    setTemplateLoading(true)
    fetchSellTemplate(selectedGame.game_id, selectedCategory.slug)
      .then((res) => {
        if (cancelled) return
        if (res.success) setTemplate(res.data)
        else toast.error(res.error)
      })
      .finally(() => { if (!cancelled) setTemplateLoading(false) })
    return () => { cancelled = true }
  }, [selectedCategory, selectedGame])

  // Force manual delivery when only manual is allowed
  useEffect(() => {
    if (!selectedGame) return
    if (!selectedGame.delivery_modes.includes('instant') && deliveryMethod !== 'manual') {
      setDeliveryMethod('manual')
    }
    if (selectedGame.delivery_modes.length === 1) {
      setDeliveryMethod(selectedGame.delivery_modes[0] as 'manual' | 'instant')
    }
  }, [selectedGame, deliveryMethod])

  // ── Computed visible attributes ────────────────────────────────────────
  const visibleAttributes = useMemo(() => {
    if (!template) return []
    return template.attributes.filter((a) => isVisible(a, fieldValues))
  }, [template, fieldValues])

  // ── Step nav ───────────────────────────────────────────────────────────
  const canGoNext = useMemo(() => {
    if (step === 1) return !!selectedCategory
    if (step === 2) {
      if (!selectedGame) return false
      if (selectedGame.requires_region && !region) return false
      if (selectedGame.requires_platform && !platform) return false
      return true
    }
    if (step === 3) {
      // All visible required attributes must have a value
      for (const a of visibleAttributes) {
        if (a.is_required) {
          const v = fieldValues[a.id]
          if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return false
        }
      }
      return true
    }
    return true
  }, [step, selectedCategory, selectedGame, region, platform, visibleAttributes, fieldValues])

  const canPublish = useMemo(() => {
    if (!title.trim() || title.length < 5) return false
    if (images.length === 0) return false
    const p = parseFloat(price)
    if (!Number.isFinite(p) || p <= 0) return false
    const q = parseInt(quantity, 10)
    if (!Number.isFinite(q) || q < 1) return false
    return true
  }, [title, images, price, quantity])

  // ── Image upload ───────────────────────────────────────────────────────
  const handleImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (images.length + files.length > 5) { toast.error('Maximum 5 images'); return }
    setImageUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await uploadSellImage(fd)
        if (!res.success) { toast.error(res.error); continue }
        uploaded.push(res.data.url)
      }
      if (uploaded.length > 0) setImages((prev) => [...prev, ...uploaded])
    } finally {
      setImageUploading(false)
    }
  }

  // ── Publish ────────────────────────────────────────────────────────────
  const handlePublish = async (asDraft: boolean) => {
    if (!selectedGame || !selectedCategory) return
    setSubmitting(true)
    try {
      // Convert fieldValues from {attrId: value} -> {attrSlug: value}
      // so listing detail pages can read by field name.
      const templateData: Record<string, unknown> = {}
      if (template) {
        for (const a of template.attributes) {
          if (!isVisible(a, fieldValues)) continue
          const v = fieldValues[a.id]
          if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue
          templateData[a.slug] = v
        }
      }

      const res = await publishListing({
        game_id: selectedGame.game_id,
        category_slug: selectedCategory.slug,
        title: title.trim(),
        description,
        price: parseFloat(price),
        original_price: originalPrice ? parseFloat(originalPrice) : null,
        quantity: parseInt(quantity, 10),
        min_quantity: parseInt(minQuantity, 10) || 1,
        delivery_method: deliveryMethod,
        delivery_time: deliveryTime,
        images,
        template_data: templateData,
        region: region || null,
        platform: platform || null,
        status: asDraft ? 'draft' : 'active',
      })
      if (!res.success) { toast.error(res.error); return }
      toast.success(asDraft ? 'Saved as draft' : 'Listing published!')
      startTransition(() => router.push('/account/listings'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <TopBar step={step} onExit={() => router.push('/account/listings')} />

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
        {/* Step header */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">
            Step {step} of {STEPS.length}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {STEPS[step - 1].hint}
          </h1>
        </div>

        {/* ── Step 1: category ── */}
        {step === 1 && (
          <Step1Category
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        )}

        {/* ── Step 2: game ── */}
        {step === 2 && selectedCategory && (
          <Step2Game
            category={selectedCategory}
            games={games}
            loading={gamesLoading}
            selected={selectedGame}
            onSelect={setSelectedGame}
            filter={gameFilter}
            onFilter={setGameFilter}
            region={region} onRegion={setRegion}
            platform={platform} onPlatform={setPlatform}
          />
        )}

        {/* ── Step 3: dynamic details ── */}
        {step === 3 && selectedCategory && selectedGame && (
          <Step3Details
            templateLoading={templateLoading}
            template={template}
            visibleAttributes={visibleAttributes}
            values={fieldValues}
            onChange={(id, v) => setFieldValues((prev) => ({ ...prev, [id]: v }))}
          />
        )}

        {/* ── Step 4: publish ── */}
        {step === 4 && selectedGame && (
          <Step4Publish
            title={title} setTitle={setTitle}
            description={description} setDescription={setDescription}
            price={price} setPrice={setPrice}
            originalPrice={originalPrice} setOriginalPrice={setOriginalPrice}
            quantity={quantity} setQuantity={setQuantity}
            minQuantity={minQuantity} setMinQuantity={setMinQuantity}
            deliveryMethod={deliveryMethod} setDeliveryMethod={setDeliveryMethod}
            deliveryTime={deliveryTime} setDeliveryTime={setDeliveryTime}
            allowedDeliveryModes={selectedGame.delivery_modes}
            images={images}
            onUpload={handleImages}
            onRemoveImage={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
            imageUploading={imageUploading}
          />
        )}

        {/* ── Footer nav ── */}
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || submitting}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-gray-200 transition-colors hover:bg-white/[0.08] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={!canGoNext}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-40"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePublish(true)}
                disabled={submitting}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-gray-200 transition-colors hover:bg-white/[0.08] disabled:opacity-40"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save draft
              </button>
              <button
                type="button"
                onClick={() => handlePublish(false)}
                disabled={!canPublish || submitting}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-lime-400 px-4 text-sm font-semibold text-black transition-colors hover:bg-lime-300 disabled:opacity-40"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Publish
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}

// ─── Step 1: category picker ────────────────────────────────────────────────

function Step1Category({
  categories, selected, onSelect,
}: {
  categories: GlobalCategory[]
  selected: GlobalCategory | null
  onSelect: (c: GlobalCategory) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((c) => {
        const active = selected?.id === c.id
        const disabled = !c.is_active
        return (
          <button
            key={c.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(c)}
            className={cn(
              'group relative flex h-32 flex-col items-start justify-between rounded-2xl border p-4 text-left transition-all',
              disabled && 'cursor-not-allowed opacity-50',
              active
                ? 'border-violet-500/60 bg-violet-500/[0.08] shadow-[0_0_0_3px_rgba(168,85,247,0.15)]'
                : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] text-3xl">
              {c.icon_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={c.icon_url} alt={c.name} className="h-full w-full rounded-xl object-cover" />
              ) : (
                <span>{c.icon_emoji ?? '📦'}</span>
              )}
            </div>
            <div>
              <div className="text-base font-semibold text-white">{c.name}</div>
              <div className="line-clamp-2 text-xs text-gray-500">{c.description ?? ''}</div>
            </div>
            {disabled && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-medium text-amber-300">
                Coming soon
              </span>
            )}
            {active && (
              <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-white">
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Step 2: game picker ────────────────────────────────────────────────────

function Step2Game({
  category, games, loading, selected, onSelect, filter, onFilter,
  region, onRegion, platform, onPlatform,
}: {
  category: GlobalCategory
  games: SellGameOption[]
  loading: boolean
  selected: SellGameOption | null
  onSelect: (g: SellGameOption) => void
  filter: string
  onFilter: (s: string) => void
  region: string
  onRegion: (s: string) => void
  platform: string
  onPlatform: (s: string) => void
}) {
  const filtered = games.filter((g) =>
    !filter ||
    g.game_name.toLowerCase().includes(filter.toLowerCase()) ||
    g.game_slug.includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3">
        <Search className="h-4 w-4 text-gray-500" />
        <input
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          placeholder={`Search games that sell ${category.name.toLowerCase()}…`}
          className="h-11 flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-gray-500">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-violet-300" />
          Loading games…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-gray-500">
          {games.length === 0
            ? `No games have ${category.name} enabled yet. An admin needs to enable it in the game wizard.`
            : `No games match "${filter}".`}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((g) => {
            const active = selected?.game_id === g.game_id
            return (
              <button
                key={g.game_id}
                type="button"
                onClick={() => onSelect(g)}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border text-left transition-all',
                  active
                    ? 'border-violet-500/60 shadow-[0_0_0_3px_rgba(168,85,247,0.15)]'
                    : 'border-white/10 hover:border-white/20'
                )}
              >
                <div className="aspect-[3/4] w-full bg-gradient-to-br from-violet-500/10 to-black/40">
                  {g.game_cover_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={g.game_cover_url} alt={g.game_name} className="h-full w-full object-cover" />
                  ) : g.game_logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={g.game_logo_url} alt={g.game_name} className="h-full w-full object-contain p-8" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl">
                      {g.game_emoji ?? '🎮'}
                    </div>
                  )}
                </div>
                <div className="border-t border-white/[0.06] bg-black/40 px-3 py-2">
                  <div className="truncate text-sm font-medium text-white">{g.game_name}</div>
                  <div className="font-mono text-[10px] text-gray-500">{g.game_slug}</div>
                </div>
                {active && (
                  <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Region / platform pickers, if the (game, category) requires them */}
      {selected?.requires_region && selected.available_regions.length > 0 && (
        <GlassCard intensity="light" rounded="2xl">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Region</div>
          <div className="flex flex-wrap gap-1.5">
            {selected.available_regions.map((r) => {
              const on = region === r.code
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => onRegion(r.code)}
                  className={cn(
                    'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                    on
                      ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                      : 'border-white/10 bg-white/[0.04] text-gray-300 hover:text-white'
                  )}
                >
                  {r.name}
                </button>
              )
            })}
          </div>
        </GlassCard>
      )}

      {selected?.requires_platform && selected.available_platforms.length > 0 && (
        <GlassCard intensity="light" rounded="2xl">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Platform</div>
          <div className="flex flex-wrap gap-1.5">
            {selected.available_platforms.map((p) => {
              const on = platform === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPlatform(p)}
                  className={cn(
                    'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                    on
                      ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                      : 'border-white/10 bg-white/[0.04] text-gray-300 hover:text-white'
                  )}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </GlassCard>
      )}
    </div>
  )
}

// ─── Step 3: dynamic details ────────────────────────────────────────────────

function Step3Details({
  templateLoading, template, visibleAttributes, values, onChange,
}: {
  templateLoading: boolean
  template: AttributeTemplateFull | null
  visibleAttributes: Attribute[]
  values: Record<string, unknown>
  onChange: (id: string, value: unknown) => void
}) {
  if (templateLoading) {
    return (
      <GlassCard intensity="light" rounded="2xl" className="p-10 text-center text-sm text-gray-500">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-violet-300" />
        Loading details…
      </GlassCard>
    )
  }

  if (!template || visibleAttributes.length === 0) {
    return (
      <GlassCard intensity="light" rounded="2xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-400" />
          <div>
            <div className="text-sm font-semibold text-white">No extra details needed</div>
            <p className="mt-1 text-xs text-gray-400">
              An admin hasn’t set up extra fields for this game and category combination yet.
              You can still publish — just continue to the next step.
            </p>
          </div>
        </div>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-3">
      {visibleAttributes.map((a) => (
        <FieldRenderer key={a.id} attribute={a} value={values[a.id]} onChange={(v) => onChange(a.id, v)} />
      ))}
    </div>
  )
}

function FieldRenderer({
  attribute, value, onChange,
}: {
  attribute: Attribute
  value: unknown
  onChange: (v: unknown) => void
}) {
  const v = value as any

  return (
    <GlassCard intensity="light" rounded="2xl">
      <label className="mb-2 block">
        <span className="text-sm font-medium text-white">
          {attribute.name}
          {attribute.is_required && <span className="ml-1 text-rose-400">*</span>}
        </span>
        {attribute.help_text && (
          <span className="ml-2 text-xs text-gray-500">{attribute.help_text}</span>
        )}
      </label>

      {attribute.type === 'text' && (
        <input
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={attribute.placeholder ?? ''}
          maxLength={attribute.max_length ?? undefined}
          className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
        />
      )}

      {attribute.type === 'textarea' && (
        <textarea
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={attribute.placeholder ?? ''}
          maxLength={attribute.max_length ?? undefined}
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
        />
      )}

      {attribute.type === 'number' && (
        <input
          type="number"
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={attribute.placeholder ?? ''}
          min={attribute.min_value ?? undefined}
          max={attribute.max_value ?? undefined}
          className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
        />
      )}

      {attribute.type === 'boolean' && (
        <div className="flex gap-2">
          {['true', 'false'].map((opt) => {
            const on = v === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={cn(
                  'h-10 flex-1 rounded-xl border text-sm font-medium transition-colors',
                  on
                    ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                    : 'border-white/10 bg-white/[0.04] text-gray-300 hover:text-white'
                )}
              >
                {opt === 'true' ? 'Yes' : 'No'}
              </button>
            )
          })}
        </div>
      )}

      {attribute.type === 'select' && (
        <div className="flex flex-wrap gap-1.5">
          {attribute.options?.map((o) => {
            const on = v === o.value
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange(on ? '' : o.value)}
                className={cn(
                  'h-9 rounded-full border px-3 text-xs font-medium transition-colors',
                  on
                    ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                    : 'border-white/10 bg-white/[0.04] text-gray-300 hover:text-white'
                )}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}

      {attribute.type === 'multiselect' && (
        <div className="flex flex-wrap gap-1.5">
          {attribute.options?.map((o) => {
            const arr = Array.isArray(v) ? (v as string[]) : []
            const on = arr.includes(o.value)
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange(on ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
                className={cn(
                  'h-9 rounded-full border px-3 text-xs font-medium transition-colors',
                  on
                    ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                    : 'border-white/10 bg-white/[0.04] text-gray-300 hover:text-white'
                )}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}

      {attribute.type === 'image_select' && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {attribute.options?.length === 0 ? (
            <p className="col-span-full text-xs text-gray-500">No options yet.</p>
          ) : attribute.options?.map((o) => {
            const on = v === o.value
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange(on ? '' : o.value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors',
                  on
                    ? 'border-violet-500/60 bg-violet-500/[0.08]'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                )}
              >
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-white/[0.05]">
                  {o.icon_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={o.icon_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-gray-600" />
                  )}
                </div>
                <span className="line-clamp-1 text-[11px] text-gray-200">{o.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}

// ─── Step 4: publish ─────────────────────────────────────────────────────────

interface Step4Props {
  title: string; setTitle: (s: string) => void
  description: string; setDescription: (s: string) => void
  price: string; setPrice: (s: string) => void
  originalPrice: string; setOriginalPrice: (s: string) => void
  quantity: string; setQuantity: (s: string) => void
  minQuantity: string; setMinQuantity: (s: string) => void
  deliveryMethod: 'manual' | 'instant'; setDeliveryMethod: (m: 'manual' | 'instant') => void
  deliveryTime: string; setDeliveryTime: (s: string) => void
  allowedDeliveryModes: string[]
  images: string[]
  onUpload: (files: FileList | null) => void
  onRemoveImage: (i: number) => void
  imageUploading: boolean
}

const DELIVERY_TIMES = [
  { value: '20min', label: '20 min' },
  { value: '1hr',   label: '1 hour' },
  { value: '3hr',   label: '3 hours' },
  { value: '6hr',   label: '6 hours' },
  { value: '12hr',  label: '12 hours' },
  { value: '24hr',  label: '1 day' },
]

function Step4Publish(p: Step4Props) {
  const priceNum = parseFloat(p.price || '0')
  const youReceive = priceNum > 0 ? (priceNum * 0.896).toFixed(2) : null
  const discount = p.originalPrice && priceNum > 0
    ? Math.round(((parseFloat(p.originalPrice) - priceNum) / parseFloat(p.originalPrice)) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Title + description */}
      <GlassCard intensity="light" rounded="2xl">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">Title</label>
        <input
          value={p.title}
          onChange={(e) => p.setTitle(e.target.value)}
          placeholder="e.g., Mythical Brainrot — Tralalero Tralala — Mutation: Golden"
          maxLength={100}
          className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
        />
        <div className="mt-1 flex justify-between text-[10px] text-gray-500">
          <span className={p.title.length >= 5 ? 'text-emerald-400' : ''}>
            {p.title.length >= 5 ? '✓ Good length' : `${5 - p.title.length} more chars needed`}
          </span>
          <span>{p.title.length}/100</span>
        </div>

        <label className="mt-4 mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">Description</label>
        <textarea
          value={p.description}
          onChange={(e) => p.setDescription(e.target.value)}
          placeholder="What’s included, condition, delivery notes, terms…"
          rows={4}
          maxLength={2000}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
        />
      </GlassCard>

      {/* Images */}
      <GlassCard intensity="light" rounded="2xl">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Photos <span className="text-rose-400">*</span>
          </div>
          <span className="text-[10px] text-gray-500">{p.images.length}/5</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {p.images.map((src, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => p.onRemoveImage(i)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <IconX className="h-3 w-3" />
              </button>
              {i === 0 && (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-violet-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  Main
                </span>
              )}
            </div>
          ))}
          {p.images.length < 5 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] hover:border-violet-500/40 hover:bg-violet-500/[0.05]">
              {p.imageUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
              ) : (
                <>
                  <Upload className="h-5 w-5 text-gray-500" />
                  <span className="text-[10px] text-gray-500">Upload</span>
                </>
              )}
              <input
                type="file"
                multiple
                accept="image/*"
                disabled={p.imageUploading}
                onChange={(e) => { p.onUpload(e.target.files); e.currentTarget.value = '' }}
                className="hidden"
              />
            </label>
          )}
        </div>
      </GlassCard>

      {/* Pricing */}
      <GlassCard intensity="light" rounded="2xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Your price <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="number"
                value={p.price}
                onChange={(e) => p.setPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Original price <span className="text-gray-600">(optional)</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="number"
                value={p.originalPrice}
                onChange={(e) => p.setOriginalPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
              />
            </div>
            {discount > 0 && (
              <div className="mt-1 text-[10px] text-emerald-400">{discount}% discount badge will show</div>
            )}
          </div>
        </div>

        {youReceive && (
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
            <div className="mb-1.5 font-semibold uppercase tracking-wider text-gray-500">Fee breakdown</div>
            <div className="space-y-1 text-gray-400">
              <div className="flex justify-between"><span>Listing price</span><span className="text-white">${priceNum.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Platform fee (6.9%)</span><span className="text-rose-300">−${(priceNum * 0.069).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Payment processing (3.5%)</span><span className="text-rose-300">−${(priceNum * 0.035).toFixed(2)}</span></div>
              <div className="mt-1.5 flex justify-between border-t border-white/[0.06] pt-1.5 font-semibold">
                <span className="text-white">You receive</span>
                <span className="text-emerald-400">${youReceive}</span>
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Stock + delivery */}
      <GlassCard intensity="light" rounded="2xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              <Package className="mr-1 inline h-3.5 w-3.5" /> Stock
            </label>
            <input
              type="number"
              value={p.quantity}
              onChange={(e) => p.setQuantity(e.target.value)}
              min={1}
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Min order qty
            </label>
            <input
              type="number"
              value={p.minQuantity}
              onChange={(e) => p.setMinQuantity(e.target.value)}
              min={1}
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">Delivery method</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['manual', 'instant'] as const).map((m) => {
              const allowed = p.allowedDeliveryModes.includes(m)
              const on = p.deliveryMethod === m
              const Icon = m === 'manual' ? Clock : Zap
              return (
                <button
                  key={m}
                  type="button"
                  disabled={!allowed}
                  onClick={() => p.setDeliveryMethod(m)}
                  className={cn(
                    'flex items-start gap-2 rounded-xl border p-3 text-left transition-colors',
                    !allowed && 'cursor-not-allowed opacity-40',
                    on && allowed
                      ? 'border-violet-500/60 bg-violet-500/[0.08]'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', on ? 'text-violet-300' : 'text-gray-500')} />
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {m === 'manual' ? 'Manual delivery' : 'Instant delivery'}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {m === 'manual' ? 'You deliver within your chosen time window.' : 'Codes/credentials sent automatically.'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {p.deliveryMethod === 'manual' && (
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">Delivery window</label>
            <div className="flex flex-wrap gap-1.5">
              {DELIVERY_TIMES.map((t) => {
                const on = p.deliveryTime === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => p.setDeliveryTime(t.value)}
                    className={cn(
                      'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                      on
                        ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                        : 'border-white/10 bg-white/[0.04] text-gray-300 hover:text-white'
                    )}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
