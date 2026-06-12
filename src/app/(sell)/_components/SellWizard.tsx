'use client'

/**
 * SellWizard — seller listing creator at /sell/new.
 *
 * Visual: matches the homepage (GV design tokens — lime accent on dark
 * elevation surfaces, same Navbar component on top via layout-wrapper).
 * The wizard adds a slim sticky step bar beneath the navbar.
 *
 * 4 steps:
 *   1. Category    (5 global categories; Boosting disabled)
 *   2. Game        (flat tiles, search, Popular / Recent tabs)
 *   3. Details     (dynamic fields; sub-fields nest INSIDE the parent
 *                   card, indented and animated in)
 *   4. Publish     (title, photos, description, pricing, stock, delivery)
 *
 * Writes go to the live `listings` table (publishListing resolves the
 * legacy category_id via metadata->>'type' mapping).
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Check, Loader2, Upload, X as IconX, Image as ImageIcon,
  ChevronLeft, Sparkles, Search, DollarSign, Package, Clock, Zap,
  AlertCircle, ChevronDown, History, Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
  AttributeOption,
} from '@/lib/actions/new-schema'

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Category', hint: 'What are you selling?' },
  { id: 2, label: 'Game',     hint: 'Which game is it for?' },
  { id: 3, label: 'Details',  hint: 'Tell us about the offer' },
] as const

const DELIVERY_TIMES = [
  { value: '20min', label: '20 min' },
  { value: '1hr',   label: '1 hour' },
  { value: '3hr',   label: '3 hours' },
  { value: '6hr',   label: '6 hours' },
  { value: '12hr',  label: '12 hours' },
  { value: '24hr',  label: '1 day' },
]

const RECENT_GAMES_KEY = 'gv_sell_recent_games'

/** Pure visibility check (mirrors LivePreview / new-schema.ts/isAttributeVisible). */
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

/** Build parent → (triggerValue → children[]) index, just like the admin tree. */
function buildChildIndex(attrs: Attribute[]) {
  const childrenOf = new Map<string, Map<string, Attribute[]>>()
  const childIds = new Set<string>()
  for (const a of attrs) {
    if (!a.conditional_rules || a.conditional_rules.length === 0) continue
    childIds.add(a.id)
    const r = a.conditional_rules[0]
    const triggerVal = r.trigger_values[0] ?? ''
    const inner = childrenOf.get(r.trigger_attribute_id) ?? new Map<string, Attribute[]>()
    const list = inner.get(triggerVal) ?? []
    list.push(a)
    inner.set(triggerVal, list)
    childrenOf.set(r.trigger_attribute_id, inner)
  }
  childrenOf.forEach((inner) => {
    inner.forEach((list) => list.sort((a, b) => a.sort_order - b.sort_order))
  })
  const topLevel = attrs.filter((a) => !childIds.has(a.id)).sort((a, b) => a.sort_order - b.sort_order)
  return { topLevel, childrenOf }
}

// ─── Slim step bar (sits below the homepage navbar) ─────────────────────────

/**
 * StepBar — horizontal progress bar with 25% / 50% / 75% / 100% fill
 * across the 4 wizard steps. Step labels sit above the rail with the
 * active label gradient-highlighted; the rail fills with solid lime
 * and animates between steps.
 */
function StepBar({ step }: { step: number }) {
  const pct = (step / STEPS.length) * 100

  return (
    <nav aria-label="Progress" className="mb-6">
      {/* Labels */}
      <ol className="mb-2.5 grid grid-cols-3 gap-1 text-[10px] sm:text-[11px]">
        {STEPS.map((s) => {
          const done = step > s.id
          const active = step === s.id
          return (
            <li
              key={s.id}
              className={cn(
                'flex items-center gap-1.5 truncate',
                // distribute labels under their progress segment
                'first:justify-start last:justify-end',
                // middle step (Game) sits centered in its column
                s.id === 2 && 'justify-center',
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px] font-semibold transition-colors',
                  done
                    ? 'border-success bg-success-bg text-success'
                    : active
                      ? 'border-lime bg-lime-tint-bg text-lime-text'
                      : 'border-border-default text-text-tertiary'
                )}
              >
                {done ? <Check className="h-2 w-2" /> : s.id}
              </span>
              <span
                className={cn(
                  'truncate font-medium uppercase tracking-wider',
                  active
                    ? 'text-lime-text'
                    : done ? 'text-success' : 'text-text-disabled'
                )}
              >
                {s.label}
              </span>
            </li>
          )
        })}
      </ol>

      {/* Rail */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-bg-raised-hover">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-lime shadow-[0_0_18px_-3px_rgba(198,255,61,0.55)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </nav>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function SellWizard({ initialCategories }: { initialCategories: GlobalCategory[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [step, setStep] = useState(1)
  const [categories] = useState<GlobalCategory[]>(initialCategories)
  const [selectedCategory, setSelectedCategory] = useState<GlobalCategory | null>(null)

  const [games, setGames] = useState<SellGameOption[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [selectedGame, setSelectedGame] = useState<SellGameOption | null>(null)
  const [gameFilter, setGameFilter] = useState('')
  const [recentGameIds, setRecentGameIds] = useState<string[]>([])
  const [gameSortMode, setGameSortMode] = useState<'popular' | 'recent'>('popular')

  const [template, setTemplate] = useState<AttributeTemplateFull | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({})
  const [region, setRegion] = useState<string>('')
  const [platform, setPlatform] = useState<string>('')

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

  // Read recent games from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_GAMES_KEY)
      if (raw) setRecentGameIds(JSON.parse(raw))
    } catch {}
  }, [])

  // Load games when category changes
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

  // Load template
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

  // Force allowed delivery mode
  useEffect(() => {
    if (!selectedGame) return
    if (!selectedGame.delivery_modes.includes('instant') && deliveryMethod !== 'manual') {
      setDeliveryMethod('manual')
    }
    if (selectedGame.delivery_modes.length === 1) {
      setDeliveryMethod(selectedGame.delivery_modes[0] as 'manual' | 'instant')
    }
  }, [selectedGame, deliveryMethod])

  // Track recently used games
  const rememberGame = (gameId: string) => {
    try {
      const next = [gameId, ...recentGameIds.filter((id) => id !== gameId)].slice(0, 12)
      setRecentGameIds(next)
      localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(next))
    } catch {}
  }

  const { topLevel, childrenOf } = useMemo(
    () => buildChildIndex(template?.attributes ?? []),
    [template]
  )

  // Step 3 validity: every visible required field has a value
  const allRequiredFilled = useMemo(() => {
    if (!template) return true
    function check(list: Attribute[]): boolean {
      for (const a of list) {
        if (!isVisible(a, fieldValues)) continue
        if (a.is_required) {
          const v = fieldValues[a.id]
          if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return false
        }
        // recurse into the children of whichever choice is currently selected
        const inner = childrenOf.get(a.id)
        if (inner) {
          const v = fieldValues[a.id]
          if (typeof v === 'string' && v) {
            const kids = inner.get(v) ?? []
            if (!check(kids)) return false
          }
        }
      }
      return true
    }
    return check(topLevel)
  }, [template, fieldValues, topLevel, childrenOf])

  // canGoNext: only meaningful for step 1 → 2 and step 2 → 3.
  // Step 3 is the final step — its "next" is Publish, gated by canPublish below.
  const canGoNext = useMemo(() => {
    if (step === 1) return !!selectedCategory
    if (step === 2) {
      if (!selectedGame) return false
      if (selectedGame.requires_region && !region) return false
      if (selectedGame.requires_platform && !platform) return false
      return true
    }
    return false
  }, [step, selectedCategory, selectedGame, region, platform])

  // canPublish: gates the Publish button on step 3. Combines dynamic
  // attribute validity (allRequiredFilled) with the static fields that
  // used to live on the old Step 4.
  const canPublish = useMemo(() => {
    if (!allRequiredFilled) return false
    if (!title.trim() || title.length < 5) return false
    if (images.length === 0) return false
    const p = parseFloat(price)
    if (!Number.isFinite(p) || p <= 0) return false
    const q = parseInt(quantity, 10)
    if (!Number.isFinite(q) || q < 1) return false
    return true
  }, [allRequiredFilled, title, images, price, quantity])

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

  const handlePublish = async (asDraft: boolean) => {
    if (!selectedGame || !selectedCategory) return
    setSubmitting(true)
    try {
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

  return (
    <main className="mx-auto w-full max-w-4xl px-3 pb-24 pt-4 sm:px-6 sm:pt-6 lg:max-w-5xl">
      {/* Card-style container — gives the wizard its own surface, distinct
          from the page background. Subtle border + gradient glow so it
          reads as an elevated section, not a hard modal. */}
      <section
        className={cn(
          'relative isolate overflow-visible rounded-3xl border border-border-default',
          'bg-bg-raised',
          'p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl',
          'sm:p-6 lg:p-8',
        )}
      >
        {/* Outer glow ring */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px -z-10 rounded-3xl bg-lime-tint-bg"
        />

        <StepBar step={step} />

        <div className="mb-5 sm:mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
            {STEPS[step - 1].hint}
          </h1>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 && (
              <Step1Category
                categories={categories}
                selected={selectedCategory}
                onSelect={(c) => { setSelectedCategory(c); setSelectedGame(null); setTemplate(null); setFieldValues({}) }}
              />
            )}

            {step === 2 && selectedCategory && (
              <Step2Game
                category={selectedCategory}
                games={games}
                loading={gamesLoading}
                selected={selectedGame}
                onSelect={(g) => { setSelectedGame(g); rememberGame(g.game_id) }}
                filter={gameFilter}
                onFilter={setGameFilter}
                recentGameIds={recentGameIds}
                sortMode={gameSortMode}
                onSortMode={setGameSortMode}
                region={region} onRegion={setRegion}
                platform={platform} onPlatform={setPlatform}
              />
            )}

            {/* Step 3 — the combined Details + Publish content.
                Rendered in two stacked blocks: dynamic attribute fields
                (Offer Details) and the static fields (Offer Description).
                R4 wraps these into proper sub-cards; for R2 they're
                stacked with a divider so the page works while the
                visual restructure lands. */}
            {step === 3 && selectedCategory && selectedGame && (
              <div className="space-y-5">
                <Step3Details
                  templateLoading={templateLoading}
                  template={template}
                  topLevel={topLevel}
                  childrenOf={childrenOf}
                  values={fieldValues}
                  onChange={(id, v) => setFieldValues((prev) => ({ ...prev, [id]: v }))}
                />
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
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      <div className="mt-8 flex items-center justify-between gap-2">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={submitting}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border-default bg-bg-raised px-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover disabled:opacity-40 sm:px-4"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          // Spacer keeps the Continue button right-aligned on step 1
          <span aria-hidden />
        )}

        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(3, s + 1))}
            disabled={!canGoNext}
            className={cn(
              'inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all sm:px-5',
              canGoNext
                ? 'bg-lime text-text-inverse shadow-lg shadow-elevated hover:bg-lime-hover hover:shadow-glow'
                : 'cursor-not-allowed bg-bg-raised text-text-disabled'
            )}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => handlePublish(true)}
              disabled={submitting}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border-default bg-bg-raised px-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save draft
            </button>
            <button
              type="button"
              onClick={() => handlePublish(false)}
              disabled={!canPublish || submitting}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all sm:px-5',
                canPublish && !submitting
                  ? 'bg-lime text-text-inverse shadow-lg shadow-elevated hover:bg-lime-hover hover:shadow-glow'
                  : 'cursor-not-allowed bg-bg-raised text-text-disabled'
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Publish
            </button>
          </div>
        )}
      </div>
      </section>
    </main>
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
    <div className="mx-auto max-w-2xl space-y-2.5">
      {categories.map((c, i) => {
        const active = selected?.id === c.id
        const disabled = !c.is_active
        return (
          <motion.button
            key={c.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(c)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.04 }}
            whileHover={!disabled ? { x: 2 } : undefined}
            className={cn(
              'group relative flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all sm:p-5',
              disabled && 'cursor-not-allowed opacity-50',
              active
                ? 'border-lime bg-lime-tint-bg shadow-[0_0_0_3px_rgba(198,255,61,0.18)]'
                : 'border-border-subtle bg-bg-inset hover:border-border-strong hover:bg-bg-inset'
            )}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border-default bg-bg-raised-hover text-2xl">
              {c.icon_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={c.icon_url} alt={c.name} className="h-full w-full rounded-xl object-cover" />
              ) : (
                <span>{c.icon_emoji ?? '📦'}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-base font-semibold text-text-primary">{c.name}</div>
                {disabled && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-warning bg-warning-bg px-2 py-0.5 text-[10px] font-medium text-warning">
                    Coming soon
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-text-tertiary">{c.description ?? ''}</div>
            </div>

            {/* Indicator on the right */}
            <div className="shrink-0">
              {active ? (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-lime text-text-inverse shadow-lg shadow-glow">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full border text-text-tertiary transition-colors',
                    disabled ? 'border-border-subtle' : 'border-border-default group-hover:border-border-strong group-hover:text-text-primary'
                  )}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

// ─── Step 2: game picker ────────────────────────────────────────────────────

function Step2Game({
  category, games, loading, selected, onSelect, filter, onFilter,
  recentGameIds, sortMode, onSortMode,
  region, onRegion, platform, onPlatform,
}: {
  category: GlobalCategory
  games: SellGameOption[]
  loading: boolean
  selected: SellGameOption | null
  onSelect: (g: SellGameOption) => void
  filter: string
  onFilter: (s: string) => void
  recentGameIds: string[]
  sortMode: 'popular' | 'recent'
  onSortMode: (m: 'popular' | 'recent') => void
  region: string
  onRegion: (s: string) => void
  platform: string
  onPlatform: (s: string) => void
}) {
  // Reorder games by tab
  const ordered = useMemo(() => {
    const filtered = games.filter((g) =>
      !filter ||
      g.game_name.toLowerCase().includes(filter.toLowerCase()) ||
      g.game_slug.includes(filter.toLowerCase())
    )
    if (sortMode === 'recent') {
      const rank = new Map<string, number>()
      recentGameIds.forEach((id, idx) => rank.set(id, idx))
      return [...filtered].sort((a, b) => {
        const ra = rank.has(a.game_id) ? rank.get(a.game_id)! : 9999
        const rb = rank.has(b.game_id) ? rank.get(b.game_id)! : 9999
        if (ra !== rb) return ra - rb
        return a.game_sort_order - b.game_sort_order
      })
    }
    return filtered // already sorted by sort_order in the action
  }, [games, filter, sortMode, recentGameIds])

  const hasRecent = recentGameIds.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-border-default bg-bg-raised px-3 backdrop-blur-sm">
        <Search className="h-4 w-4 text-text-tertiary" />
        <input
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          placeholder={`Search games that sell ${category.name.toLowerCase()}…`}
          className="h-11 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
      </div>

      {/* Popular / Recent tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-border-default bg-bg-base p-1">
        <SortTab active={sortMode === 'popular'} onClick={() => onSortMode('popular')} icon={Flame} label="Popular" />
        <SortTab
          active={sortMode === 'recent'}
          onClick={() => onSortMode('recent')}
          icon={History}
          label="Recent"
          disabled={!hasRecent}
          hint={!hasRecent ? 'Use the wizard once to see recent games here' : undefined}
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border-subtle bg-bg-base p-10 text-center text-sm text-text-tertiary">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-lime-text" />
          Loading games…
        </div>
      ) : ordered.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-bg-base p-10 text-center text-sm text-text-tertiary">
          {games.length === 0
            ? `No games have ${category.name} enabled yet. An admin needs to enable it.`
            : `No games match "${filter}".`}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {ordered.map((g, i) => {
            const active = selected?.game_id === g.game_id
            const hasCover = !!g.game_cover_url
            return (
              <motion.button
                key={g.game_id}
                type="button"
                onClick={() => onSelect(g)}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.3) }}
                whileHover={{ y: -2 }}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border text-left transition-all',
                  active
                    ? 'border-lime shadow-[0_0_0_3px_rgba(168,85,247,0.15)]'
                    : 'border-border-default hover:border-border-strong hover:bg-bg-base'
                )}
              >
                {hasCover ? (
                  // Cover-art games: full-bleed image, name overlaid
                  <>
                    <div className="relative aspect-[4/3] w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.game_cover_url!} alt={g.game_name} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <div className="absolute bottom-2 left-2.5 right-2.5">
                        <div className="truncate text-sm font-semibold text-text-primary">{g.game_name}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  // Logo-only games: big logo on a soft gradient, name below
                  <div className="flex flex-col">
                    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-lime-tint-bg">
                      {/* subtle glow behind the logo */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.18),transparent_60%)]" />
                      {g.game_logo_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={g.game_logo_url}
                          alt={g.game_name}
                          className="relative h-3/4 w-3/4 object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
                        />
                      ) : (
                        <div className="relative text-5xl">{g.game_emoji ?? '🎮'}</div>
                      )}
                    </div>
                    <div className="border-t border-border-subtle bg-bg-inset px-3 py-2">
                      <div className="truncate text-sm font-semibold text-text-primary">{g.game_name}</div>
                    </div>
                  </div>
                )}
                {active && (
                  <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-lime text-text-inverse shadow-lg shadow-glow">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>
      )}

      {selected?.requires_region && selected.available_regions.length > 0 && (
        <div className="rounded-2xl border border-border-default bg-bg-raised p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Region</div>
          <PillRow
            options={selected.available_regions.map((r) => ({ value: r.code, label: r.name }))}
            value={region}
            onChange={onRegion}
          />
        </div>
      )}

      {selected?.requires_platform && selected.available_platforms.length > 0 && (
        <div className="rounded-2xl border border-border-default bg-bg-raised p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Platform</div>
          <PillRow
            options={selected.available_platforms.map((p) => ({ value: p, label: p }))}
            value={platform}
            onChange={onPlatform}
          />
        </div>
      )}
    </div>
  )
}

function SortTab({
  active, onClick, icon: Icon, label, disabled, hint,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  disabled?: boolean
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
        active
          ? 'bg-lime-tint-bg text-lime-text'
          : 'text-text-secondary hover:text-text-primary',
        disabled && 'cursor-not-allowed opacity-40 hover:text-text-secondary'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function PillRow<T extends { value: string; label: string }>({
  options, value, onChange,
}: {
  options: T[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
              on
                ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                : 'border-border-default bg-bg-raised text-text-secondary hover:text-text-primary'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Step 3: dynamic details (with nested sub-fields) ────────────────────────

function Step3Details({
  templateLoading, template, topLevel, childrenOf, values, onChange,
}: {
  templateLoading: boolean
  template: AttributeTemplateFull | null
  topLevel: Attribute[]
  childrenOf: Map<string, Map<string, Attribute[]>>
  values: Record<string, unknown>
  onChange: (id: string, value: unknown) => void
}) {
  if (templateLoading) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-base p-10 text-center text-sm text-text-tertiary">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-lime-text" />
        Loading details…
      </div>
    )
  }

  if (!template || topLevel.length === 0) {
    return (
      <div className="rounded-2xl border border-border-default bg-bg-raised p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-warning" />
          <div>
            <div className="text-sm font-semibold text-text-primary">No extra details needed</div>
            <p className="mt-1 text-xs text-text-secondary">
              An admin hasn’t set up extra fields for this game and category yet.
              You can still publish — continue to the next step.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {topLevel.map((a) => (
        <FieldCard
          key={a.id}
          attribute={a}
          values={values}
          onChange={onChange}
          childrenOf={childrenOf}
          depth={0}
        />
      ))}
    </div>
  )
}

/**
 * FieldCard — renders a single attribute and, if it has children that are
 * revealed by the current value, recursively renders those children
 * indented INSIDE this card.
 */
function FieldCard({
  attribute, values, onChange, childrenOf, depth,
}: {
  attribute: Attribute
  values: Record<string, unknown>
  onChange: (id: string, value: unknown) => void
  childrenOf: Map<string, Map<string, Attribute[]>>
  depth: number
}) {
  if (!isVisible(attribute, values)) return null

  const inner = childrenOf.get(attribute.id)
  const currentValue = values[attribute.id]
  const revealedKids = inner && typeof currentValue === 'string' && currentValue
    ? inner.get(currentValue) ?? []
    : []

  // Top-level fields get a glass card; nested ones get just a separator
  const shell = depth === 0
    ? 'rounded-2xl border border-border-default bg-bg-raised p-5 backdrop-blur-sm'
    : 'rounded-xl border border-border-subtle bg-bg-base p-4'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={shell}
    >
      <FieldInput
        attribute={attribute}
        value={currentValue}
        onChange={(v) => {
          // If the user changes the parent value, drop any descendant values
          // so we don't leave stale data attached to a hidden branch.
          if (inner) {
            const nextValues = { ...values, [attribute.id]: v }
            // Clear any kids that were revealed by the OLD value
            const oldKids = typeof currentValue === 'string' ? inner.get(currentValue) ?? [] : []
            for (const kid of oldKids) {
              delete (nextValues as any)[kid.id]
              // recursively walk further descendants
              walkAndClear(kid, childrenOf, nextValues)
            }
            // Apply: we use onChange repeatedly so the reducer in the parent
            // stays simple. The bulk delete is rare and the list is short.
            Object.entries(nextValues).forEach(([k, val]) => onChange(k, val))
          } else {
            onChange(attribute.id, v)
          }
        }}
      />

      {/* Nested sub-fields (animated) */}
      <AnimatePresence initial={false}>
        {revealedKids.length > 0 && (
          <motion.div
            key="nested"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-2 border-l border-lime-tint-border pl-4">
              <div className="-mt-1 mb-1 inline-flex items-center gap-1 rounded-full bg-lime-tint-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-lime-text">
                <Sparkles className="h-2.5 w-2.5" />
                because you chose {labelFor(attribute, currentValue as string)}
              </div>
              {revealedKids.map((kid) => (
                <FieldCard
                  key={kid.id}
                  attribute={kid}
                  values={values}
                  onChange={onChange}
                  childrenOf={childrenOf}
                  depth={depth + 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function walkAndClear(
  attr: Attribute,
  childrenOf: Map<string, Map<string, Attribute[]>>,
  out: Record<string, unknown>,
) {
  const inner = childrenOf.get(attr.id)
  if (!inner) return
  inner.forEach((kids) => {
    kids.forEach((k) => {
      delete out[k.id]
      walkAndClear(k, childrenOf, out)
    })
  })
}

function labelFor(attr: Attribute, value: string): string {
  if (attr.type === 'boolean') return value === 'true' ? 'Yes' : 'No'
  const opt = attr.options?.find((o) => o.value === value)
  return opt?.label ?? value
}

// ─── FieldInput: renders the right control for the attribute type ──────────

function FieldInput({
  attribute, value, onChange,
}: {
  attribute: Attribute
  value: unknown
  onChange: (v: unknown) => void
}) {
  const v = value as any

  return (
    <div>
      <label className="mb-2 block">
        <span className="text-sm font-semibold text-text-primary">
          {attribute.name}
          {attribute.is_required && <span className="ml-1 text-error">*</span>}
        </span>
        {attribute.help_text && (
          <span className="ml-2 text-xs text-text-tertiary">{attribute.help_text}</span>
        )}
      </label>

      {attribute.type === 'text' && (
        <input
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={attribute.placeholder ?? ''}
          maxLength={attribute.max_length ?? undefined}
          className={inputCls}
        />
      )}

      {attribute.type === 'textarea' && (
        <textarea
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={attribute.placeholder ?? ''}
          maxLength={attribute.max_length ?? undefined}
          rows={3}
          className={cn(inputCls, 'h-auto py-2')}
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
          className={inputCls}
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
                    ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                    : 'border-border-default bg-bg-raised text-text-secondary hover:text-text-primary'
                )}
              >
                {opt === 'true' ? 'Yes' : 'No'}
              </button>
            )
          })}
        </div>
      )}

      {attribute.type === 'select' && (
        <Dropdown
          options={attribute.options ?? []}
          value={typeof v === 'string' ? v : ''}
          onChange={(val) => onChange(val)}
          placeholder={attribute.placeholder || 'Choose…'}
        />
      )}

      {attribute.type === 'multiselect' && (
        <PillRow
          options={(attribute.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
          value={Array.isArray(v) && v.length === 1 ? (v as string[])[0] : ''}
          onChange={(val) => {
            const arr = Array.isArray(v) ? (v as string[]) : []
            if (arr.includes(val)) onChange(arr.filter((x) => x !== val))
            else onChange([...arr, val])
          }}
        />
      )}

      {attribute.type === 'image_select' && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {(attribute.options ?? []).length === 0 ? (
            <p className="col-span-full text-xs text-text-tertiary">No choices yet.</p>
          ) : attribute.options!.map((o) => {
            const on = v === o.value
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange(on ? '' : o.value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors',
                  on
                    ? 'border-lime bg-lime-tint-bg'
                    : 'border-border-default bg-bg-raised hover:bg-bg-raised-hover'
                )}
              >
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-bg-raised-hover">
                  {o.icon_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={o.icon_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-text-disabled" />
                  )}
                </div>
                <span className="line-clamp-1 text-[11px] text-text-primary">{o.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Dropdown (the proper one) ──────────────────────────────────────────────

function Dropdown({
  options, value, onChange, placeholder,
}: {
  options: AttributeOption[]
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement | null>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    if (!filter) return options
    const f = filter.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(f))
  }, [options, filter])

  const selected = options.find((o) => o.value === value) ?? null
  const searchable = options.length > 6

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-xl border bg-bg-raised px-3 text-left text-sm transition-colors',
          open
            ? 'border-lime ring-2 ring-lime-tint-bg'
            : 'border-border-default hover:border-border-strong'
        )}
      >
        <span className={cn('truncate', selected ? 'text-text-primary' : 'text-text-tertiary')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-text-tertiary transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border-default bg-[#0c0c12]/95 shadow-2xl backdrop-blur-xl"
          >
            {searchable && (
              <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
                <Search className="h-3.5 w-3.5 text-text-tertiary" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search…"
                  autoFocus
                  className="h-7 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
              </div>
            )}
            <ul className="max-h-72 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-xs text-text-tertiary">No matches.</li>
              ) : filtered.map((o) => {
                const on = o.value === value
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => { onChange(o.value); setOpen(false); setFilter('') }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                        on
                          ? 'bg-lime-tint-bg text-text-primary'
                          : 'text-text-primary hover:bg-bg-raised-hover'
                      )}
                    >
                      {o.icon_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={o.icon_url} alt="" className="h-5 w-5 rounded object-cover" />
                      )}
                      <span className="flex-1 truncate">{o.label}</span>
                      {on && <Check className="h-3.5 w-3.5 text-lime-text" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Step 4: publish ────────────────────────────────────────────────────────

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

function Step4Publish(p: Step4Props) {
  const priceNum = parseFloat(p.price || '0')
  const youReceive = priceNum > 0 ? (priceNum * 0.896).toFixed(2) : null
  const discount = p.originalPrice && priceNum > 0
    ? Math.round(((parseFloat(p.originalPrice) - priceNum) / parseFloat(p.originalPrice)) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Title + description */}
      <div className="rounded-2xl border border-border-default bg-bg-raised p-5">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Title</label>
        <input
          value={p.title}
          onChange={(e) => p.setTitle(e.target.value)}
          placeholder="e.g., Mythical Brainrot — Tralalero Tralala — Mutation: Golden"
          maxLength={100}
          className={inputCls}
        />
        <div className="mt-1 flex justify-between text-[10px] text-text-tertiary">
          <span className={p.title.length >= 5 ? 'text-success' : ''}>
            {p.title.length >= 5 ? '✓ Good length' : `${5 - p.title.length} more chars needed`}
          </span>
          <span>{p.title.length}/100</span>
        </div>

        <label className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Description</label>
        <textarea
          value={p.description}
          onChange={(e) => p.setDescription(e.target.value)}
          placeholder="What’s included, condition, delivery notes, terms…"
          rows={4}
          maxLength={2000}
          className={cn(inputCls, 'h-auto py-2')}
        />
      </div>

      {/* Images */}
      <div className="rounded-2xl border border-border-default bg-bg-raised p-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Photos <span className="text-error">*</span>
          </div>
          <span className="text-[10px] text-text-tertiary">{p.images.length}/5</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {p.images.map((src, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-border-default">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => p.onRemoveImage(i)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-error text-text-primary opacity-0 transition-opacity group-hover:opacity-100"
              >
                <IconX className="h-3 w-3" />
              </button>
              {i === 0 && (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-lime px-1.5 py-0.5 text-[9px] font-bold text-text-primary">
                  Main
                </span>
              )}
            </div>
          ))}
          {p.images.length < 5 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/15 bg-bg-base hover:border-lime-tint-border hover:bg-lime-tint-bg">
              {p.imageUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-lime-text" />
              ) : (
                <>
                  <Upload className="h-5 w-5 text-text-tertiary" />
                  <span className="text-[10px] text-text-tertiary">Upload</span>
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
      </div>

      {/* Pricing */}
      <div className="rounded-2xl border border-border-default bg-bg-raised p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Your price <span className="text-error">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="number"
                value={p.price}
                onChange={(e) => p.setPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className={cn(inputCls, 'pl-9')}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Original price <span className="text-text-disabled">(optional)</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="number"
                value={p.originalPrice}
                onChange={(e) => p.setOriginalPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className={cn(inputCls, 'pl-9')}
              />
            </div>
            {discount > 0 && (
              <div className="mt-1 text-[10px] text-success">{discount}% discount badge will show</div>
            )}
          </div>
        </div>

        {youReceive && (
          <div className="mt-4 rounded-xl border border-border-subtle bg-lime-tint-bg p-3 text-xs">
            <div className="mb-1.5 font-semibold uppercase tracking-wider text-text-tertiary">Fee breakdown</div>
            <div className="space-y-1 text-text-secondary">
              <div className="flex justify-between"><span>Listing price</span><span className="text-text-primary">${priceNum.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Platform fee (6.9%)</span><span className="text-error">−${(priceNum * 0.069).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Payment processing (3.5%)</span><span className="text-error">−${(priceNum * 0.035).toFixed(2)}</span></div>
              <div className="mt-1.5 flex justify-between border-t border-border-subtle pt-1.5 font-semibold">
                <span className="text-text-primary">You receive</span>
                <span className="text-lime-text">
                  ${youReceive}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stock + delivery */}
      <div className="rounded-2xl border border-border-default bg-bg-raised p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <Package className="mr-1 inline h-3.5 w-3.5" /> Stock
            </label>
            <input
              type="number"
              value={p.quantity}
              onChange={(e) => p.setQuantity(e.target.value)}
              min={1}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Min order qty
            </label>
            <input
              type="number"
              value={p.minQuantity}
              onChange={(e) => p.setMinQuantity(e.target.value)}
              min={1}
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Delivery method</label>
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
                      ? 'border-lime bg-lime-tint-bg'
                      : 'border-border-default bg-bg-raised hover:bg-bg-raised-hover'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', on ? 'text-lime-text' : 'text-text-tertiary')} />
                  <div>
                    <div className="text-sm font-semibold text-text-primary">
                      {m === 'manual' ? 'Manual delivery' : 'Instant delivery'}
                    </div>
                    <div className="text-[11px] text-text-tertiary">
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
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Delivery window</label>
            <PillRow
              options={DELIVERY_TIMES.map((t) => ({ value: t.value, label: t.label }))}
              value={p.deliveryTime}
              onChange={p.setDeliveryTime}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared input styles ─────────────────────────────────────────────────────

const inputCls =
  'h-10 w-full rounded-xl border border-border-default bg-bg-raised px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg transition-colors'
