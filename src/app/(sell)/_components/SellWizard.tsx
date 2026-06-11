'use client'

/**
 * SellWizard — seller listing creator at /sell/new.
 *
 * Visual: matches the homepage (violet → purple → cyan gradient accents,
 * glass cards, same Navbar component on top via layout-wrapper).
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
  { id: 4, label: 'Publish',  hint: 'Title, photos, price' },
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

function StepBar({ step }: { step: number }) {
  return (
    <div className="sticky top-[64px] z-30 -mb-px border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="hidden items-center gap-2 sm:flex">
          {STEPS.map((s, i) => {
            const done = step > s.id
            const active = step === s.id
            return (
              <div key={s.id} className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors',
                    done
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : active
                        ? 'border-violet-500/60 bg-violet-500/20 text-violet-100 shadow-[0_0_18px_-3px_rgba(168,85,247,0.6)]'
                        : 'border-white/10 text-gray-500'
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : s.id}
                </span>
                <span
                  className={cn(
                    'text-xs',
                    active
                      ? 'bg-gradient-to-r from-violet-300 via-purple-300 to-cyan-300 bg-clip-text font-semibold text-transparent'
                      : done ? 'text-emerald-300' : 'text-gray-600'
                  )}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <span className="mx-1 text-gray-700">·</span>}
              </div>
            )
          })}
        </div>
        <div className="text-xs text-gray-500 sm:hidden">Step {step} of {STEPS.length}</div>
        <div className="text-[10px] text-gray-600">create listing</div>
      </div>
    </div>
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

  const canGoNext = useMemo(() => {
    if (step === 1) return !!selectedCategory
    if (step === 2) {
      if (!selectedGame) return false
      if (selectedGame.requires_region && !region) return false
      if (selectedGame.requires_platform && !platform) return false
      return true
    }
    if (step === 3) return allRequiredFilled
    return true
  }, [step, selectedCategory, selectedGame, region, platform, allRequiredFilled])

  const canPublish = useMemo(() => {
    if (!title.trim() || title.length < 5) return false
    if (images.length === 0) return false
    const p = parseFloat(price)
    if (!Number.isFinite(p) || p <= 0) return false
    const q = parseInt(quantity, 10)
    if (!Number.isFinite(q) || q < 1) return false
    return true
  }, [title, images, price, quantity])

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
    <>
      <StepBar step={step} />

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">
            Step {step} of {STEPS.length}
          </div>
          <h1 className="mt-1 bg-gradient-to-r from-white via-violet-100 to-cyan-100 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
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

            {step === 3 && selectedCategory && selectedGame && (
              <Step3Details
                templateLoading={templateLoading}
                template={template}
                topLevel={topLevel}
                childrenOf={childrenOf}
                values={fieldValues}
                onChange={(id, v) => setFieldValues((prev) => ({ ...prev, [id]: v }))}
              />
            )}

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
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || submitting}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-gray-200 transition-colors hover:bg-white/[0.08] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={!canGoNext}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-xl px-5 text-sm font-semibold transition-all',
                canGoNext
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30 hover:bg-violet-400 hover:shadow-violet-500/40'
                  : 'cursor-not-allowed bg-white/[0.04] text-gray-600'
              )}
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
                className={cn(
                  'inline-flex h-10 items-center gap-1.5 rounded-xl px-5 text-sm font-semibold transition-all',
                  canPublish && !submitting
                    ? 'bg-gradient-to-r from-violet-500 via-purple-500 to-cyan-500 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40'
                    : 'cursor-not-allowed bg-white/[0.04] text-gray-600'
                )}
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
      {categories.map((c, i) => {
        const active = selected?.id === c.id
        const disabled = !c.is_active
        return (
          <motion.button
            key={c.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(c)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            whileHover={!disabled ? { y: -2 } : undefined}
            className={cn(
              'group relative flex h-32 flex-col items-start justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all',
              disabled && 'cursor-not-allowed opacity-50',
              active
                ? 'border-violet-500/60 bg-gradient-to-br from-violet-500/15 via-purple-500/8 to-cyan-500/5 shadow-[0_0_0_3px_rgba(168,85,247,0.15)]'
                : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] text-3xl">
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
              <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/40">
                <Check className="h-3 w-3" />
              </span>
            )}
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
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 backdrop-blur-sm">
        <Search className="h-4 w-4 text-gray-500" />
        <input
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          placeholder={`Search games that sell ${category.name.toLowerCase()}…`}
          className="h-11 flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
        />
      </div>

      {/* Popular / Recent tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
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
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-gray-500">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-violet-300" />
          Loading games…
        </div>
      ) : ordered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-gray-500">
          {games.length === 0
            ? `No games have ${category.name} enabled yet. An admin needs to enable it.`
            : `No games match "${filter}".`}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {ordered.map((g, i) => {
            const active = selected?.game_id === g.game_id
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
                    ? 'border-violet-500/60 shadow-[0_0_0_3px_rgba(168,85,247,0.15)]'
                    : 'border-white/10 hover:border-white/20'
                )}
              >
                <div className="relative aspect-[5/3] w-full overflow-hidden bg-gradient-to-br from-violet-500/[0.08] via-purple-500/[0.04] to-black/40">
                  {g.game_cover_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={g.game_cover_url} alt={g.game_name} className="h-full w-full object-cover" />
                  ) : g.game_logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={g.game_logo_url} alt={g.game_name} className="h-full w-full object-contain p-5" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">
                      {g.game_emoji ?? '🎮'}
                    </div>
                  )}
                  {/* Dark bottom gradient for legibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />
                  <div className="absolute bottom-1.5 left-2 right-2">
                    <div className="truncate text-xs font-semibold text-white">{g.game_name}</div>
                  </div>
                </div>
                {active && (
                  <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/40">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>
      )}

      {selected?.requires_region && selected.available_regions.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Region</div>
          <PillRow
            options={selected.available_regions.map((r) => ({ value: r.code, label: r.name }))}
            value={region}
            onChange={onRegion}
          />
        </div>
      )}

      {selected?.requires_platform && selected.available_platforms.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Platform</div>
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
          ? 'bg-violet-500/15 text-violet-100'
          : 'text-gray-400 hover:text-white',
        disabled && 'cursor-not-allowed opacity-40 hover:text-gray-400'
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
                ? 'border-violet-500/40 bg-violet-500/15 text-violet-100'
                : 'border-white/10 bg-white/[0.04] text-gray-300 hover:text-white'
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
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-gray-500">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-violet-300" />
        Loading details…
      </div>
    )
  }

  if (!template || topLevel.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-400" />
          <div>
            <div className="text-sm font-semibold text-white">No extra details needed</div>
            <p className="mt-1 text-xs text-gray-400">
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
    ? 'rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm'
    : 'rounded-xl border border-white/[0.06] bg-white/[0.02] p-4'

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
            <div className="mt-4 space-y-2 border-l border-violet-500/30 pl-4">
              <div className="-mt-1 mb-1 inline-flex items-center gap-1 rounded-full bg-violet-500/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
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
        <span className="text-sm font-semibold text-white">
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
                    ? 'border-violet-500/40 bg-violet-500/15 text-violet-100'
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
            <p className="col-span-full text-xs text-gray-500">No choices yet.</p>
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
          'flex h-10 w-full items-center justify-between rounded-xl border bg-white/[0.04] px-3 text-left text-sm transition-colors',
          open
            ? 'border-violet-500/50 ring-2 ring-violet-500/15'
            : 'border-white/10 hover:border-white/20'
        )}
      >
        <span className={cn('truncate', selected ? 'text-white' : 'text-gray-500')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0c0c12]/95 shadow-2xl backdrop-blur-xl"
          >
            {searchable && (
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
                <Search className="h-3.5 w-3.5 text-gray-500" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search…"
                  autoFocus
                  className="h-7 flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
                />
              </div>
            )}
            <ul className="max-h-72 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-xs text-gray-500">No matches.</li>
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
                          ? 'bg-violet-500/15 text-white'
                          : 'text-gray-200 hover:bg-white/[0.05]'
                      )}
                    >
                      {o.icon_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={o.icon_url} alt="" className="h-5 w-5 rounded object-cover" />
                      )}
                      <span className="flex-1 truncate">{o.label}</span>
                      {on && <Check className="h-3.5 w-3.5 text-violet-300" />}
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">Title</label>
        <input
          value={p.title}
          onChange={(e) => p.setTitle(e.target.value)}
          placeholder="e.g., Mythical Brainrot — Tralalero Tralala — Mutation: Golden"
          maxLength={100}
          className={inputCls}
        />
        <div className="mt-1 flex justify-between text-[10px] text-gray-500">
          <span className={p.title.length >= 5 ? 'text-emerald-400' : ''}>
            {p.title.length >= 5 ? '✓ Good length' : `${5 - p.title.length} more chars needed`}
          </span>
          <span>{p.title.length}/100</span>
        </div>

        <label className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wider text-gray-400">Description</label>
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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
      </div>

      {/* Pricing */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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
                className={cn(inputCls, 'pl-9')}
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
                className={cn(inputCls, 'pl-9')}
              />
            </div>
            {discount > 0 && (
              <div className="mt-1 text-[10px] text-emerald-400">{discount}% discount badge will show</div>
            )}
          </div>
        </div>

        {youReceive && (
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.05] via-purple-500/[0.03] to-transparent p-3 text-xs">
            <div className="mb-1.5 font-semibold uppercase tracking-wider text-gray-500">Fee breakdown</div>
            <div className="space-y-1 text-gray-400">
              <div className="flex justify-between"><span>Listing price</span><span className="text-white">${priceNum.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Platform fee (6.9%)</span><span className="text-rose-300">−${(priceNum * 0.069).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Payment processing (3.5%)</span><span className="text-rose-300">−${(priceNum * 0.035).toFixed(2)}</span></div>
              <div className="mt-1.5 flex justify-between border-t border-white/[0.06] pt-1.5 font-semibold">
                <span className="text-white">You receive</span>
                <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
                  ${youReceive}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stock + delivery */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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
              className={inputCls}
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
              className={inputCls}
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
  'h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-colors'
