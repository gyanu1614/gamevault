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
  History, Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { NumberField } from '@/components/ui/number-field'
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

// ─── Step bar (clickable step labels + lime progress rail) ───────────────────

/**
 * StepBar — three clickable step chips above a progress rail.
 *
 * Each chip is a real <button>; the user can click a completed step to jump
 * back to it. The current step's chip is highlighted lime; completed ones
 * use the success tone; future ones look muted.
 *
 * Breadcrumbs are GONE — these chips replace them.
 */
function StepBar({ step, onJumpToStep }: { step: number; onJumpToStep: (target: number) => void }) {
  const pct = (step / STEPS.length) * 100

  return (
    <nav aria-label="Progress" className="mb-6">
      {/* Chip row — bigger than before, each chip clickable when reachable */}
      <ol className="mb-3 flex items-center justify-between gap-2">
        {STEPS.map((s) => {
          const done = step > s.id
          const active = step === s.id
          const clickable = done // can only jump backwards to a completed step
          return (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                disabled={!clickable && !active}
                onClick={() => clickable && onJumpToStep(s.id)}
                className={cn(
                  // Box — R9: slightly smaller; softer lime treatment
                  'group flex w-full items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors sm:text-xs',
                  // State
                  active && 'border-lime-tint-border bg-lime-tint-bg text-lime-text',
                  done && 'border-success/40 bg-success-bg text-success cursor-pointer hover:border-success hover:bg-bg-raised-hover',
                  !active && !done && 'border-border-subtle text-text-disabled cursor-default',
                )}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold',
                    active && 'border-lime bg-lime text-text-inverse',
                    done && 'border-success bg-success text-text-inverse',
                    !active && !done && 'border-border-default text-text-tertiary',
                  )}
                >
                  {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : s.id}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Rail */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-bg-raised-hover">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-lime"
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
  // Ref to the wizard card so we can scroll to the top of it whenever the
  // step changes (per R8 user feedback — landing on the prior scroll
  // position of the next page is disorienting).
  const cardRef = useRef<HTMLElement | null>(null)
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

  // Terms gate (R8 — both must be checked to enable Create Offer)
  const [agreeSellerRules, setAgreeSellerRules] = useState(false)
  const [agreeTos, setAgreeTos] = useState(false)

  // R8 — whenever the step changes, scroll the wizard card to the top of the
  // viewport so the seller doesn't land on the new page mid-scroll.
  useEffect(() => {
    if (!cardRef.current) return
    // Use the top of the breadcrumb-less card; small offset for the floating
    // navbar above. Smooth scrolling so it doesn't feel jarring.
    const top = cardRef.current.getBoundingClientRect().top + window.scrollY - 96
    window.scrollTo({ top, behavior: 'smooth' })
  }, [step])

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

  // canPublish: gates the Create Offer button on step 3. Combines dynamic
  // attribute validity (allRequiredFilled) with the static fields and the
  // two R8 terms checkboxes.
  const canPublish = useMemo(() => {
    if (!allRequiredFilled) return false
    if (!title.trim() || title.length < 5) return false
    if (images.length === 0) return false
    const p = parseFloat(price)
    if (!Number.isFinite(p) || p <= 0) return false
    const q = parseInt(quantity, 10)
    if (!Number.isFinite(q) || q < 1) return false
    if (!agreeSellerRules || !agreeTos) return false
    return true
  }, [allRequiredFilled, title, images, price, quantity, agreeSellerRules, agreeTos])

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
    <main className="mx-auto w-full max-w-4xl px-3 pb-24 pt-8 sm:px-6 sm:pt-10 lg:max-w-5xl lg:pt-12">
      {/* Wizard card — elevated grey surface on bg-bg-base. Per spec §2,
          no lime tint on the wrapper; sub-cards inside go one shade deeper
          (bg-bg-overlay) for visual hierarchy.
          Breadcrumbs removed in R8 — the clickable step chips inside StepBar
          serve as the only step navigation. */}
      <section
        ref={cardRef}
        className="relative isolate overflow-visible rounded-3xl border border-border-default bg-bg-raised p-5 shadow-elevated sm:p-7 lg:p-8"
      >
        <StepBar
          step={step}
          onJumpToStep={(target) => setStep((s) => (target < s ? target : s))}
        />

        {/* Step header.
            Step 1 / 2 just show the hint text.
            Step 3 swaps in the "Sell Game Items" title with a game-logo
            sub-header — the chosen game is now context, not a question. */}
        <div className="mb-5 sm:mb-6">
          {step === 3 && selectedGame ? (
            <div className="text-center">
              <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
                Sell {selectedCategory?.name ?? 'Listing'}
              </h1>
              <div className="mt-2 inline-flex items-center gap-2 text-sm text-text-secondary">
                {selectedGame.game_logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selectedGame.game_logo_url}
                    alt={selectedGame.game_name}
                    className="h-7 w-7 rounded-md object-cover"
                  />
                ) : (
                  <span className="text-base">{selectedGame.game_emoji ?? '🎮'}</span>
                )}
                <span className="font-medium text-text-primary">{selectedGame.game_name}</span>
              </div>
            </div>
          ) : (
            <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
              {STEPS[step - 1].hint}
            </h1>
          )}
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
                onSelect={(g) => {
                  setSelectedGame(g)
                  rememberGame(g.game_id)
                  // R8: auto-advance to Step 3 unless this (game, category)
                  // needs region or platform input first — in that case the
                  // pickers render inline and the user uses Continue.
                  if (!g.requires_region && !g.requires_platform) {
                    setStep(3)
                  }
                }}
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
                <TermsCard
                  agreeSellerRules={agreeSellerRules}
                  setAgreeSellerRules={setAgreeSellerRules}
                  agreeTos={agreeTos}
                  setAgreeTos={setAgreeTos}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      {/* Footer / publish row.
          Desktop (sm+): inline at the bottom of the wizard card with the
            standard mt-8 border-t pt-6 treatment.
          Mobile (< sm): fixed at the bottom of the viewport with a
            backdrop so the seller can hit Publish without scrolling
            all the way to the end. main.pb-24 already leaves space. */}
      <div className={cn(
        // Mobile sticky bar
        'fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-2',
        'border-t border-border-subtle bg-bg-raised/95 px-3 py-3 backdrop-blur',
        // Desktop inline
        'sm:relative sm:mt-8 sm:bg-transparent sm:px-0 sm:pt-6 sm:pb-0 sm:backdrop-blur-none',
      )}>
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
              Create Offer
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
    <div className="mx-auto max-w-2xl space-y-2">
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
              // R8: compressed padding so 5 rows + Continue fit in viewport
              'group relative flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all sm:gap-4 sm:p-4',
              disabled && 'cursor-not-allowed opacity-50',
              active
                ? 'border-lime bg-lime-tint-bg shadow-[0_0_0_3px_rgba(198,255,61,0.18)]'
                : 'border-border-subtle bg-bg-inset hover:border-border-strong hover:bg-bg-inset'
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-default bg-bg-raised-hover text-xl sm:h-11 sm:w-11">
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
  // R8 — when there are no admin-defined extra fields for this (game, category),
  // skip the Offer Details sub-card entirely. The seller starts straight at the
  // Title card. Loading state still renders so the UI doesn't flash.
  if (templateLoading) {
    return (
      <SubCard title="Offer Details">
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin text-lime-text" />
          Loading details…
        </div>
      </SubCard>
    )
  }
  if (!template || topLevel.length === 0) return null

  return (
    <SubCard title="Offer Details">
      <div className="space-y-4">
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
    </SubCard>
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

  // Inside the SubCard wrapper now, top-level fields are flat rows;
  // nested fields get a subtle inset to indicate the parent-child chain.
  const shell = depth === 0
    ? ''
    : 'rounded-xl border border-border-subtle bg-bg-inset p-4'

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
      <label className="mb-1.5 block">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {attribute.name}
          {attribute.is_required && <span className="ml-1 text-error">*</span>}
        </span>
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
        <Select
          value={typeof v === 'string' && v ? v : undefined}
          onValueChange={(val) => onChange(val)}
        >
          <SelectTrigger>
            <SelectValue placeholder={attribute.placeholder || 'Choose…'} />
          </SelectTrigger>
          <SelectContent>
            {(attribute.options ?? []).map((o) => (
              <SelectItem key={o.id} value={o.value}>
                {o.icon_url ? (
                  <span className="inline-flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.icon_url} alt="" className="h-5 w-5 rounded object-cover" />
                    {o.label}
                  </span>
                ) : (
                  o.label
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                    : 'border-border-default bg-bg-inset hover:bg-bg-raised-hover'
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

      {/* Helper text — minimal-hint pattern (no surface, just dim text). */}
      {attribute.help_text && <FieldHint className="mt-1.5">{attribute.help_text}</FieldHint>}
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

/**
 * Step4Publish — the static publish fields, rendered as 5 separate SubCards
 * stacked vertically. Each card has its own labelled title (Title, Description,
 * Photos, Pricing, Stock & Delivery). Sibling spacing between cards comes from
 * the parent's `space-y-5`, so each card breathes equally with the Offer
 * Details card above.
 *
 * Helper text under each input uses the FormDescription pattern:
 *   text-[11px] text-text-tertiary leading-snug, no surface.
 */
function Step4Publish(p: Step4Props) {
  const priceNum = parseFloat(p.price || '0')
  const youReceive = priceNum > 0 ? (priceNum * 0.896).toFixed(2) : null
  const discount = p.originalPrice && priceNum > 0
    ? Math.round(((parseFloat(p.originalPrice) - priceNum) / parseFloat(p.originalPrice)) * 100)
    : 0

  return (
    <div className="space-y-5">
      {/* Title */}
      <SubCard title="Title">
        <FieldRow>
          <input
            value={p.title}
            onChange={(e) => p.setTitle(e.target.value)}
            placeholder="e.g., Mythical Brainrot — Tralalero Tralala — Mutation: Golden"
            maxLength={100}
            className={inputCls}
          />
          <div className="flex justify-between text-[10px] text-text-tertiary">
            <span className={p.title.length >= 5 ? 'text-success' : ''}>
              {p.title.length >= 5 ? '✓ Good length' : `${5 - p.title.length} more chars needed`}
            </span>
            <span>{p.title.length}/100</span>
          </div>
          <FieldHint>
            Add the most searchable words at the front. Titles have a 100 character limit.
          </FieldHint>
        </FieldRow>
      </SubCard>

      {/* Description */}
      <SubCard title="Description">
        <FieldRow>
          <textarea
            value={p.description}
            onChange={(e) => p.setDescription(e.target.value)}
            placeholder="What’s included, condition, delivery notes, terms…"
            rows={4}
            maxLength={2000}
            className={cn(inputCls, 'h-auto py-2')}
          />
          <FieldHint>
            Be specific. Include condition, delivery method, and any terms.
          </FieldHint>
        </FieldRow>
      </SubCard>

      {/* Photos */}
      <SubCard
        title="Photos"
        right={<span className="text-[10px] text-text-tertiary">{p.images.length}/5</span>}
      >
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
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-lime px-1.5 py-0.5 text-[9px] font-bold text-text-inverse">
                  Main
                </span>
              )}
            </div>
          ))}
          {p.images.length < 5 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border-default bg-bg-inset transition-colors hover:border-lime hover:bg-bg-raised-hover">
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
        <FieldHint className="mt-3">
          Images at least 800px square. First photo is your main thumbnail.
        </FieldHint>
      </SubCard>

      {/* Pricing */}
      <SubCard title="Pricing">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Your price <span className="text-error">*</span>
            </label>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
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
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Original price <span className="font-normal normal-case tracking-normal text-text-disabled">(optional)</span>
            </label>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
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
              <FieldHint className="text-success">{discount}% discount badge will show</FieldHint>
            )}
          </div>
        </div>

        <FieldHint className="mt-3">
          Competitive prices rank better. Original price triggers a discount badge.
        </FieldHint>

        {youReceive && (
          <div className="mt-4 rounded-xl border border-border-subtle bg-bg-inset p-3 text-xs">
            <div className="mb-1.5 font-semibold uppercase tracking-wider text-text-tertiary">Fee breakdown</div>
            <div className="space-y-1 text-text-secondary">
              <div className="flex justify-between"><span>Listing price</span><span className="text-text-primary">${priceNum.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Platform fee (6.9%)</span><span className="text-error">−${(priceNum * 0.069).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Payment processing (3.5%)</span><span className="text-error">−${(priceNum * 0.035).toFixed(2)}</span></div>
              <div className="mt-1.5 flex justify-between border-t border-border-subtle pt-1.5 font-semibold">
                <span className="text-text-primary">You receive</span>
                <span className="text-lime-text">${youReceive}</span>
              </div>
            </div>
          </div>
        )}
      </SubCard>

      {/* Stock */}
      <SubCard title="Stock">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <Package className="mr-1 inline h-3.5 w-3.5" /> Available quantity
            </label>
            <NumberField
              value={Number.isFinite(parseInt(p.quantity, 10)) ? parseInt(p.quantity, 10) : 1}
              onChange={(v) => p.setQuantity(String(v))}
              minValue={1}
              maxValue={99_999}
              ariaLabel="Stock"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Min order qty
            </label>
            <NumberField
              value={Number.isFinite(parseInt(p.minQuantity, 10)) ? parseInt(p.minQuantity, 10) : 1}
              onChange={(v) => p.setMinQuantity(String(v))}
              minValue={1}
              maxValue={Math.max(1, parseInt(p.quantity || '1', 10))}
              ariaLabel="Minimum order quantity"
            />
          </div>
        </div>
        <FieldHint className="mt-3">
          Set stock to what you can actually fulfill. Min order qty is the smallest amount a buyer can purchase.
        </FieldHint>
      </SubCard>

      {/* Delivery */}
      <SubCard title="Delivery">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">Delivery method</label>
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
                    'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors sm:p-4',
                    !allowed && 'cursor-not-allowed opacity-40',
                    on && allowed
                      ? 'border-lime bg-lime-tint-bg'
                      : 'border-border-default bg-bg-inset hover:bg-bg-raised-hover'
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', on ? 'text-lime-text' : 'text-text-tertiary')} />
                  <div>
                    <div className="text-sm font-semibold text-text-primary">
                      {m === 'manual' ? 'Manual delivery' : 'Instant delivery'}
                    </div>
                    <div className="text-[11px] leading-snug text-text-secondary">
                      {m === 'manual' ? 'You deliver within your chosen time window.' : 'Codes/credentials sent automatically.'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {p.deliveryMethod === 'manual' && (
          <div className="mt-5 space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">Delivery window</label>
            {/* Bigger pills, spaced out, with higher contrast.
                One per row on mobile (no wrap weirdness) -> grid layout. */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {DELIVERY_TIMES.map((t) => {
                const on = p.deliveryTime === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => p.setDeliveryTime(t.value)}
                    className={cn(
                      'h-10 rounded-xl border text-sm font-medium transition-colors',
                      on
                        ? 'border-lime bg-lime-tint-bg text-lime-text'
                        : 'border-border-default bg-bg-inset text-text-secondary hover:border-border-strong hover:text-text-primary'
                    )}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <FieldHint>
              Faster windows rank higher in search and convert better.
            </FieldHint>
          </div>
        )}
      </SubCard>
    </div>
  )
}

// ─── FieldRow — input + caption + hint vertical stack ───────────────────────

/**
 * FieldRow is the canonical wrapper for "one input with bits below it".
 * Matches the spacing the shadcn FormItem provides (space-y-2) so that when
 * we later swap in react-hook-form via shadcn Form, the visual rhythm
 * doesn't change. Used inside Step3 sub-cards.
 */
function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-2', className)}>{children}</div>
}

// ─── FieldHint — small dim text under a control. No surface. ────────────────

/**
 * FieldHint is the standalone version of shadcn's <FormDescription/>.
 * Same styling — text-[11px] leading-snug text-text-tertiary — so we can
 * use it without wiring up react-hook-form yet. Once Step 3 moves to RHF
 * (Phase D-era), every FieldHint maps 1:1 to <FormDescription/>.
 */
function FieldHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-[11px] leading-snug text-text-tertiary', className)}>{children}</p>
}

// ─── TermsCard — final sub-card on Step 3; gates the Create Offer button ────

/**
 * Two checkboxes the seller must tick to enable Create Offer:
 *   - Seller Rules (community standards / what can be listed)
 *   - Terms of Service (platform-wide ToS)
 *
 * Uses the existing shadcn Checkbox (themed to lime in R8). The Create Offer
 * button is gated on (canPublish && agreeSellerRules && agreeTos) — the
 * parent SellWizard reads these two booleans into its canPublish check.
 */
function TermsCard({
  agreeSellerRules, setAgreeSellerRules, agreeTos, setAgreeTos,
}: {
  agreeSellerRules: boolean; setAgreeSellerRules: (v: boolean) => void
  agreeTos: boolean; setAgreeTos: (v: boolean) => void
}) {
  return (
    <SubCard title="Confirm">
      <ul className="space-y-3">
        <li>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={agreeSellerRules}
              onCheckedChange={(v) => setAgreeSellerRules(v === true)}
              className="mt-0.5"
              aria-label="I agree to the Seller Rules"
            />
            <span className="text-sm text-text-primary">
              I agree to the{' '}
              <a
                href="/seller-rules"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-text underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Seller Rules
              </a>
              .
            </span>
          </label>
        </li>
        <li>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={agreeTos}
              onCheckedChange={(v) => setAgreeTos(v === true)}
              className="mt-0.5"
              aria-label="I agree to the Terms of Service"
            />
            <span className="text-sm text-text-primary">
              I agree to the{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-text underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </a>
              .
            </span>
          </label>
        </li>
      </ul>
    </SubCard>
  )
}

// ─── SubCard — the grey panel each Step 3 section lives in ──────────────────

/**
 * SubCard wraps a labelled section of the Details step.
 * Spec: bg-bg-overlay rounded-2xl border-border-subtle p-5,
 * with a head row (h-9 mb-4) holding the title.
 * Per HANDOFF_SELL_WIZARD_RESTRUCTURE.md §3.
 */
function SubCard({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-overlay p-4 sm:p-5">
      {/* Head row — bigger title (h5-ish: text-base font-bold) with a faint
          horizontal divider beneath that separates the title from the body.
          R9 polish. */}
      <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-3 sm:mb-5 sm:pb-4">
        <h2 className="text-base font-bold text-text-primary">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

// ─── Shared input styles ─────────────────────────────────────────────────────

// Inputs sit on bg-bg-inset (one shade darker than the sub-card bg-bg-overlay)
// so they pop visually inside the panel.
const inputCls =
  // R9 — rounded-md (6px) so inputs read as professional rectangular fields
  // against the rounder outer cards and pill buttons.
  'h-10 w-full rounded-md border border-border-default bg-bg-inset px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg transition-colors'
