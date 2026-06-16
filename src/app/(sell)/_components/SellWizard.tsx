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
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Check, Loader2, Upload, X as IconX, Image as ImageIcon,
  ChevronLeft, Search, DollarSign, Package, Clock, Zap, FileSpreadsheet,
  History, Flame,
  Coins, Backpack, UserSquare2, Trophy, ShoppingBag, Gamepad2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Combobox } from '@/components/ui/combobox'
import { Checkbox } from '@/components/ui/checkbox'
import { NumberField } from '@/components/ui/number-field'
import {
  fetchSellGamesForCategory,
  fetchSellTemplate,
  publishListing,
  updateListingFromWizard,
  fetchPublishPolicy,
  fetchPriceGuidance,
  fetchListingForDuplicate,
  type SellerPublishPolicy,
  type PriceGuidance,
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
  { id: 1, label: 'Category', hint: 'Choose a category' },
  { id: 2, label: 'Game',     hint: 'Choose a game' },
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

// V13 — Currency sellers think in minutes. Tighter preset grid.
const DELIVERY_TIMES_CURRENCY = [
  { value: 'instant', label: 'Instant' },
  { value: '5min',    label: '5 min' },
  { value: '15min',   label: '15 min' },
  { value: '30min',   label: '30 min' },
  { value: '1hr',     label: '1 hour' },
  { value: 'custom',  label: 'Custom' },
]

const RECENT_GAMES_KEY = 'gv_sell_recent_games'
// R16 — sessionStorage key for the wizard snapshot so refresh keeps the
// seller on the same step with the same draft. Lives on sessionStorage so it
// auto-clears when the tab closes (we don't want a stale half-filled draft
// to come back days later).
const WIZARD_SNAPSHOT_KEY = 'gv_sell_wizard_snapshot'

interface WizardSnapshot {
  step: number
  categoryId: string | null
  gameId: string | null
  region: string
  platform: string
  title: string
  description: string
  price: string
  originalPrice: string
  quantity: string
  minQuantity: string
  deliveryMethod: 'manual' | 'instant'
  deliveryTime: string
  images: string[]
  fieldValues: Record<string, unknown>
  agreeSellerRules: boolean
  agreeTos: boolean
}

/**
 * Pure visibility check (mirrors LivePreview / new-schema.ts/isAttributeVisible).
 *
 * V15c — Walks the full ancestor chain so a stale value on a now-hidden
 * parent can't keep a descendant on screen. If the third arg is provided,
 * we look up parent attributes by id; otherwise we fall back to the
 * shallow rule check (preserves call sites that don't have the full list).
 */
function isVisible(
  attr: Attribute,
  values: Record<string, unknown>,
  byId?: Map<string, Attribute>,
  seen: Set<string> = new Set(),
): boolean {
  if (seen.has(attr.id)) return true
  seen.add(attr.id)
  const rules = attr.conditional_rules ?? []
  if (rules.length === 0) return true
  for (const r of rules) {
    if (byId) {
      const parent = byId.get(r.trigger_attribute_id)
      if (parent && !isVisible(parent, values, byId, seen)) return false
    }
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

/**
 * V15c — Collect every descendant attribute id of a parent. Used when
 * the user changes a parent value so we can wipe stale sub-selections
 * (e.g. switching Item Type from Brainrot → Base Skin clears both Rarity
 * and the leaf "Brainrot" selection).
 */
function collectDescendantIds(parentId: string, attrs: Attribute[]): Set<string> {
  const out = new Set<string>()
  let frontier = new Set<string>([parentId])
  let safety = 0
  while (frontier.size > 0 && safety++ < 32) {
    const next = new Set<string>()
    for (const a of attrs) {
      if (out.has(a.id)) continue
      const rules = a.conditional_rules ?? []
      for (const r of rules) {
        if (frontier.has(r.trigger_attribute_id)) {
          out.add(a.id)
          next.add(a.id)
          break
        }
      }
    }
    frontier = next
  }
  return out
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
 * StepBar — three clickable step labels above a progress rail.
 *
 * R13 — Pill chrome dropped. Each step is now a plain text label with a
 * leading number/check badge. Active = lime text. Completed = clickable,
 * subtle hover bg. Future = dimmed. No bordered box around the label.
 */
function StepBar({ step, onJumpToStep }: { step: number; onJumpToStep: (target: number) => void }) {
  const pct = (step / STEPS.length) * 100

  return (
    <nav aria-label="Progress" className="mb-4">
      {/* Step row — plain labels, no pill chrome */}
      <ol className="mb-3 flex items-center justify-between gap-1 sm:gap-2">
        {STEPS.map((s) => {
          const done = step > s.id
          const active = step === s.id
          const clickable = done // can only jump backwards to a completed step
          return (
            <li key={s.id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!clickable && !active}
                onClick={() => clickable && onJumpToStep(s.id)}
                className={cn(
                  // Layout — no border, no background fill by default
                  'group flex w-full items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors sm:gap-2 sm:px-3 sm:text-xs',
                  // State — color only, no enclosing pill
                  active && 'text-lime-text',
                  done && 'cursor-pointer text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary',
                  !active && !done && 'cursor-default text-text-disabled',
                )}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold sm:h-5 sm:w-5 sm:text-[10px]',
                    active && 'bg-lime text-text-inverse',
                    done && 'bg-success text-text-inverse',
                    !active && !done && 'border border-border-default text-text-tertiary',
                  )}
                >
                  {done ? <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={3} /> : s.id}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Rail */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-bg-raised-hover">
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

export default function SellWizard({
  initialCategories,
  duplicateFromId,
  editListingId,
}: {
  initialCategories: GlobalCategory[]
  /** D4 — when set, fetch this listing on mount and pre-fill the wizard. */
  duplicateFromId?: string | null
  /** V14k — when set, the wizard runs in EDIT mode: pre-fills from the
   *  listing (same loader as duplicate), lands on Step 3, and submits
   *  via updateListingFromWizard instead of publishListing. Mutually
   *  exclusive with duplicateFromId (editListingId wins). */
  editListingId?: string | null
}) {
  const router = useRouter()
  // V14p — Query client used to bust the seller-listings cache after an
  // edit-mode save. The /account/listings page reads via react-query with
  // a 1-minute staleTime, so without an explicit invalidate the seller
  // would see the old row until the cache expired.
  const queryClient = useQueryClient()
  // Ref to the wizard card so we can scroll to the top of it whenever the
  // step changes (per R8 user feedback — landing on the prior scroll
  // position of the next page is disorienting).
  const cardRef = useRef<HTMLElement | null>(null)
  const [, startTransition] = useTransition()

  // V14k — Hoisted up so other effects (snapshot persist, rehydrate gate)
  // can reference it.
  const isEditMode = !!editListingId
  // V14o — Edit-mode shows a full-card loader until the prefill resolves
  // AND we've landed on Step 3. Without this gate, the wizard renders
  // Step 1 → Step 2 → Step 3 in rapid succession as data arrives, which
  // looks glitchy. Hidden surface, animated lime spinner, faded copy.
  const [editLoading, setEditLoading] = useState<boolean>(isEditMode)

  const [step, setStep] = useState(1)
  const [categories] = useState<GlobalCategory[]>(initialCategories)
  const [selectedCategory, setSelectedCategory] = useState<GlobalCategory | null>(null)

  // D1 — Publish policy (tier, cap, moderation gate). Fetched on mount;
  // surfaced in Step 3 so the seller sees pending-approval status and cap
  // info before they click Create Offer.
  const [policy, setPolicy] = useState<SellerPublishPolicy | null>(null)

  // D2 — Price guidance for the chosen (game, category). Fetched whenever
  // both are set; surfaced in the Pricing sub-card so the seller sees the
  // going rate before they price too high/low.
  const [priceGuidance, setPriceGuidance] = useState<PriceGuidance | null>(null)

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

  // R12 — uniform top spacing on mount + every step transition.
  //
  // The previous version skipped the very first render to avoid a smooth-scroll
  // jerk, but that left the initial paint at a different scroll position than
  // every subsequent step landed at — the navbar-to-modal gap looked
  // inconsistent. Now we scroll on both:
  //   - first paint: instant (no smooth) — lands the card at the same target
  //     offset before the user sees anything else, so the gap is right from
  //     the start.
  //   - step changes:  smooth scroll to the same target.
  // The offset (-128) leaves a generous gap below the floating homepage navbar.
  const WIZARD_TOP_OFFSET = 128
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!cardRef.current) return
    const top =
      cardRef.current.getBoundingClientRect().top + window.scrollY - WIZARD_TOP_OFFSET
    if (!didMountRef.current) {
      didMountRef.current = true
      // Instant on initial paint so the user doesn't see a scroll animation
      // from a wrong starting position.
      window.scrollTo({ top, behavior: 'auto' })
      return
    }
    window.scrollTo({ top, behavior: 'smooth' })
  }, [step])

  // R16 — Refresh persistence. Snapshot lives in sessionStorage so a hard
  // refresh keeps the seller on the same step with the same fields filled.
  // Cleared on successful publish (see handlePublish below).
  //
  // Two-phase rehydrate:
  //   1. Synchronously restore everything EXCEPT step (deferred so step
  //      never gets ahead of selectedCategory / selectedGame).
  //   2. Once the data needed for the saved step has resolved (category for
  //      step 2; game for step 3), bump step up to the target.
  const pendingGameIdRef = useRef<string | null>(null)
  const pendingStepRef = useRef<number | null>(null)
  const hydratedRef = useRef(false)
  // Rehydrate on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    // V14k — In edit mode, skip the session snapshot. The prefill effect
    // below loads the actual listing and should fully own the form state.
    if (editListingId) { hydratedRef.current = true; return }
    try {
      const raw = sessionStorage.getItem(WIZARD_SNAPSHOT_KEY)
      if (!raw) { hydratedRef.current = true; return }
      const snap = JSON.parse(raw) as WizardSnapshot
      if (snap.categoryId) {
        const cat = categories.find((c) => c.id === snap.categoryId) ?? null
        if (cat) setSelectedCategory(cat)
      }
      pendingGameIdRef.current = snap.gameId ?? null
      pendingStepRef.current =
        typeof snap.step === 'number' && snap.step >= 1 && snap.step <= 3 ? snap.step : null
      setRegion(snap.region ?? '')
      setPlatform(snap.platform ?? '')
      setTitle(snap.title ?? '')
      setDescription(snap.description ?? '')
      setPrice(snap.price ?? '')
      setOriginalPrice(snap.originalPrice ?? '')
      setQuantity(snap.quantity ?? '1')
      setMinQuantity(snap.minQuantity ?? '1')
      setDeliveryMethod(snap.deliveryMethod ?? 'manual')
      setDeliveryTime(snap.deliveryTime ?? '1hr')
      setImages(Array.isArray(snap.images) ? snap.images : [])
      setFieldValues(snap.fieldValues ?? {})
      setAgreeSellerRules(!!snap.agreeSellerRules)
      setAgreeTos(!!snap.agreeTos)
    } catch {}
    hydratedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Resolve the pending gameId once games arrive.
  useEffect(() => {
    if (!pendingGameIdRef.current) return
    if (games.length === 0) return
    const g = games.find((g) => g.game_id === pendingGameIdRef.current) ?? null
    if (g) setSelectedGame(g)
    pendingGameIdRef.current = null
  }, [games])
  // Bump step to the rehydrate target as soon as the data it needs is ready.
  useEffect(() => {
    const target = pendingStepRef.current
    if (target === null) return
    if (target === 1) {
      pendingStepRef.current = null
      return
    }
    if (target === 2 && selectedCategory) {
      setStep(2)
      pendingStepRef.current = null
      return
    }
    if (target === 3 && selectedCategory && selectedGame) {
      setStep(3)
      pendingStepRef.current = null
      // V14o — Reveal the wizard once we've actually arrived at Step 3.
      // The category + game are now resolved, so the details form is
      // ready to render with the prefilled data.
      if (isEditMode) setEditLoading(false)
    }
  }, [selectedCategory, selectedGame, isEditMode])
  // Persist on every relevant state change (after initial hydrate finishes).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hydratedRef.current) return
    // V14k — Don't persist in edit mode; we don't want editing an existing
    // listing to clobber an in-progress /sell/new draft.
    if (isEditMode) return
    const snap: WizardSnapshot = {
      step,
      categoryId: selectedCategory?.id ?? null,
      gameId: selectedGame?.game_id ?? null,
      region,
      platform,
      title,
      description,
      price,
      originalPrice,
      quantity,
      minQuantity,
      deliveryMethod,
      deliveryTime,
      images,
      fieldValues,
      agreeSellerRules,
      agreeTos,
    }
    try { sessionStorage.setItem(WIZARD_SNAPSHOT_KEY, JSON.stringify(snap)) } catch {}
  }, [
    step,
    selectedCategory,
    selectedGame,
    region,
    platform,
    title,
    description,
    price,
    originalPrice,
    quantity,
    minQuantity,
    deliveryMethod,
    deliveryTime,
    images,
    fieldValues,
    agreeSellerRules,
    agreeTos,
  ])

  // R11.c — sync the wizard step with browser history so the back gesture
  // walks step 3 -> step 2 -> step 1 -> previous page instead of leaving
  // the wizard outright on the first back tap.
  //
  // Mechanics:
  //  - On mount, replace the current history entry with { step: 1 } so we
  //    always have a known starting state for popstate.
  //  - When the seller advances (or jumps back via a chip), pushState so
  //    the browser stack grows in lockstep with `step`.
  //  - On popstate, read state.step and call setStep — guarded by a ref so
  //    the resulting step change effect below does NOT push another entry.
  // D1 — Fetch publish policy on mount. Cheap RPC, runs in parallel with
  // the rest of the page; no need to block render on it. We only read it
  // when the seller hits Step 3 / clicks Create Offer.
  useEffect(() => {
    let cancelled = false
    fetchPublishPolicy().then((res) => {
      if (cancelled) return
      if (res.success) setPolicy(res.data)
    })
    return () => { cancelled = true }
  }, [])

  // D4 / V14k — Prefill for duplicate AND edit modes. Same loader, same
  // landing step (3). Edit mode just changes the toast copy and what
  // handlePublish calls on submit.
  const prefillId = editListingId ?? duplicateFromId ?? null
  useEffect(() => {
    if (!prefillId) return
    let cancelled = false
    fetchListingForDuplicate(prefillId).then((res) => {
      if (cancelled) return
      if (!res.success) {
        toast.error(res.error)
        // V14o — Drop the loader on failure so the user isn't stuck on a
        // blank loader screen; they'll see the empty wizard and can back out.
        if (isEditMode) setEditLoading(false)
        return
      }
      const d = res.data
      const cat = categories.find((c) => c.slug === d.category_slug) ?? null
      if (cat) setSelectedCategory(cat)
      pendingGameIdRef.current = d.game_id
      pendingStepRef.current = 3
      setTitle(d.title)
      setDescription(d.description)
      setPrice(String(d.price))
      setOriginalPrice(d.original_price != null ? String(d.original_price) : '')
      setQuantity(String(d.quantity))
      setMinQuantity(String(d.min_quantity))
      setDeliveryMethod(d.delivery_method)
      setDeliveryTime(d.delivery_time ?? '1hr')
      setRegion(d.region ?? '')
      setPlatform(d.platform ?? '')
      setFieldValues(d.template_data ?? {})
      setImages(d.images)
      toast.success(isEditMode ? 'Loaded your listing for editing' : 'Pre-filled from your existing listing')
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillId])

  const popstateGuardRef = useRef(false)
  // Mount: lay down the initial history entry.
  // V14o — Skip the step-history wiring in edit mode. The wizard only ever
  // shows Step 3 in edit mode, so there's nothing to step back through —
  // the browser back gesture should fall through to the previous page
  // (i.e. /account/listings), not bounce the seller to Steps 2/1 which
  // they can't legally edit anyway.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isEditMode) return
    window.history.replaceState({ wizardStep: 1 }, '')
    const onPop = (e: PopStateEvent) => {
      const target = (e.state as { wizardStep?: number } | null)?.wizardStep
      if (typeof target === 'number' && target >= 1 && target <= 3) {
        popstateGuardRef.current = true
        setStep(target)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Step change → push history (unless we got here via popstate). Same edit-mode skip.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isEditMode) return
    if (popstateGuardRef.current) {
      popstateGuardRef.current = false
      return
    }
    const cur = (window.history.state as { wizardStep?: number } | null)?.wizardStep
    if (cur === step) return // initial replaceState already covers step 1
    window.history.pushState({ wizardStep: step }, '')
  }, [step, isEditMode])

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

  // V13 — When the seller picks Currency, pre-seed sensible defaults so
  // they don't have to fix them manually. Currency listings sell in bulk:
  // 100 min order qty is a friendly floor (Robux, V-Bucks, etc.) and
  // stock 1000 prevents the seller from accidentally publishing with
  // qty=1.
  useEffect(() => {
    if (selectedCategory?.slug !== 'currency') return
    // V14 — Enforce min-100 floor on currency. If the seller picked currency
    // after typing a smaller min qty (e.g. switched category), bump it up.
    setMinQuantity((cur) => {
      const n = parseInt(cur, 10)
      return !Number.isFinite(n) || n < 100 ? '100' : cur
    })
    setQuantity((cur) => (cur === '1' || cur === '' ? '1000' : cur))
  }, [selectedCategory])

  // D2 — Fetch price guidance whenever (game, category) is set. Cheap
  // RPC; runs in parallel with template-load. The Pricing card consumes it.
  useEffect(() => {
    if (!selectedCategory || !selectedGame) {
      setPriceGuidance(null)
      return
    }
    let cancelled = false
    fetchPriceGuidance(selectedGame.game_id, selectedCategory.slug).then((res) => {
      if (cancelled) return
      if (res.success) setPriceGuidance(res.data)
    })
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
    // V15c — Build the byId index once so isVisible can walk the full chain.
    const byId = new Map<string, Attribute>()
    for (const a of template.attributes) byId.set(a.id, a)
    function check(list: Attribute[]): boolean {
      for (const a of list) {
        if (!isVisible(a, fieldValues, byId)) continue
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
    // V13 — Currency listings skip Title + Photos requirements (server fills
    // them automatically from the currency record).
    const isCurrency = selectedCategory?.slug === 'currency'
    if (!isCurrency && !title.trim()) return false
    if (!isCurrency && images.length === 0) return false
    const p = parseFloat(price)
    if (!Number.isFinite(p) || p <= 0) return false
    const q = parseInt(quantity, 10)
    if (!Number.isFinite(q) || q < 1) return false
    if (!agreeSellerRules || !agreeTos) return false
    // D1 — block clicking Create Offer when the seller is at their tier's
    // active-listing cap. The server enforces this too, but blocking the
    // button avoids the round-trip + error toast.
    if (policy?.at_listing_limit) return false
    return true
  }, [allRequiredFilled, title, images, price, quantity, agreeSellerRules, agreeTos, policy, selectedCategory])

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
        // V15c — Use the chain-aware visibility check so hidden-ancestor
        // values don't sneak into the publish payload.
        const byId = new Map<string, Attribute>()
        for (const a of template.attributes) byId.set(a.id, a)
        for (const a of template.attributes) {
          if (!isVisible(a, fieldValues, byId)) continue
          const v = fieldValues[a.id]
          if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue
          templateData[a.slug] = v
        }
      }
      const payload = {
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
        status: (asDraft ? 'draft' : 'active') as 'draft' | 'active',
      }
      // V14k — Edit mode UPDATES the existing row; publish/duplicate INSERTs
      // a new one.
      const res = isEditMode && editListingId
        ? await updateListingFromWizard(editListingId, payload)
        : await publishListing(payload)
      if (!res.success) { toast.error(res.error); return }
      const landed = res.data.status
      if (isEditMode) {
        toast.success('Listing updated')
      } else if (asDraft) {
        toast.success('Saved as draft')
      } else if (landed === 'pending_approval') {
        toast.success('Listing submitted — pending review by our team')
      } else {
        toast.success('Listing published!')
      }
      // R16 — clear the refresh-persistence snapshot so a future visit to
      // /sell/new starts fresh instead of restoring this just-published draft.
      try { sessionStorage.removeItem(WIZARD_SNAPSHOT_KEY) } catch {}
      // V14p — Bust react-query caches so the listings page shows fresh data.
      // updateListingFromWizard already revalidates the RSC path, but the
      // /account/listings page is a client component using useQuery, so we
      // also need to invalidate the in-memory cache here.
      queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
      startTransition(() => router.push('/account/listings'))
    } finally {
      setSubmitting(false)
    }
  }

  // V14o — Edit-mode loader screen. While the listing is being fetched and
  // the wizard is being walked to Step 3, show a centered loader instead
  // of the half-built wizard (the seller doesn't need to see Step 1 → 2 → 3
  // flash by — they only care about editing the details).
  if (isEditMode && editLoading) {
    return (
      <main className="mx-auto flex w-full max-w-4xl items-center justify-center px-3 pb-24 pt-24 sm:px-6 sm:pt-28 lg:max-w-5xl lg:pt-32">
        <section
          className="relative flex w-full flex-col items-center gap-4 rounded-3xl border border-border-default bg-bg-raised p-10 shadow-elevated sm:p-14"
          aria-live="polite"
          aria-busy="true"
        >
          {/* Soft lime glow behind the spinner */}
          <div
            aria-hidden
            className="absolute inset-0 -m-8 rounded-3xl bg-lime/5 blur-3xl"
          />
          <div className="relative flex h-14 w-14 items-center justify-center">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full border-2 border-border-subtle"
            />
            <div
              aria-hidden
              className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-lime border-r-lime"
              style={{ animationDuration: '0.9s' }}
            />
            <Loader2 className="h-0 w-0" />
          </div>
          <div className="relative text-center">
            <h1 className="text-[18px] font-bold text-text-primary sm:text-[20px]">
              Loading your listing
            </h1>
            <p className="mt-1 text-[13.5px] text-text-tertiary">
              Pulling in your offer details — one moment.
            </p>
          </div>
        </section>
      </main>
    )
  }

  // R12 — main top padding matches WIZARD_TOP_OFFSET so first paint already
  // shows the right gap before the JS scroll runs; the JS scroll then keeps
  // that gap consistent on every step transition.
  return (
    <main className="mx-auto w-full max-w-4xl px-3 pb-24 pt-24 sm:px-6 sm:pt-28 lg:max-w-5xl lg:pt-32">
      {/* Wizard card — elevated grey surface on bg-bg-base. Per spec §2,
          no lime tint on the wrapper; sub-cards inside go one shade deeper
          (bg-bg-overlay) for visual hierarchy.
          Breadcrumbs removed in R8 — the clickable step chips inside StepBar
          serve as the only step navigation. */}
      <section
        ref={cardRef}
        className="relative isolate overflow-visible rounded-3xl border border-border-default bg-bg-raised p-4 shadow-elevated sm:p-5 lg:p-6"
      >
        <StepBar
          step={step}
          // V14o — In edit mode the seller can't change category/game on
          // an existing row (would orphan template_data + category_id), so
          // disable jumping back to Steps 1/2. Keeps them focused on the
          // editable details on Step 3.
          onJumpToStep={(target) => setStep((s) => (isEditMode ? s : (target < s ? target : s)))}
        />

        {/* Step header.
            Step 1 / 2 just show the hint text.
            Step 3 swaps in the "Sell Game Items" title with a game-logo
            sub-header — the chosen game is now context, not a question. */}
        <div className="mb-3 sm:mb-4">
          {step === 3 && selectedGame ? (
            (() => {
              // V13 — On currency we want the buyer-facing currency name
              // ("Robux") as the title, with the game ("Roblox") as a quiet
              // subtitle below. Other categories keep "Game Category" as
              // a single line.
              const isCurrency = selectedCategory?.slug === 'currency'
              const unit =
                CURRENCY_UNIT_NAMES[selectedGame.game_slug] ?? 'Currency'
              const title = isCurrency
                ? unit
                : `${selectedGame.game_name} ${selectedCategory?.name ?? 'Listing'}`
              const subtitle = isCurrency ? selectedGame.game_name : null
              return (
                <div className="flex items-center justify-center gap-3 text-left sm:gap-4">
                  {selectedGame.game_logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={selectedGame.game_logo_url}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-border-default sm:h-12 sm:w-12"
                    />
                  ) : (
                    <span className="text-3xl">{selectedGame.game_emoji ?? '🎮'}</span>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold leading-tight tracking-tight text-text-primary sm:text-2xl lg:text-[28px]">
                      {title}
                    </h1>
                    {subtitle && (
                      <p className="mt-0.5 text-[12px] font-medium uppercase tracking-[0.14em] text-text-tertiary sm:text-[13px]">
                        for {subtitle}
                      </p>
                    )}
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-lime-tint-border bg-lime-tint-bg text-lime-text sm:h-11 sm:w-11">
                {step === 1 ? (
                  <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
                ) : (
                  <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
                )}
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
                {STEPS[step - 1].hint}
              </h1>
            </div>
          )}
        </div>

        {/* R17 — `initial={false}` skips the entry animation on first mount
            (page load / refresh) so the wizard body appears in its final
            position alongside the navbar instead of fading in a beat later.
            Step-to-step transitions still animate because AnimatePresence
            re-mounts the child when `key={step}` changes. */}
        <AnimatePresence mode="wait" initial={false}>
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
                <PolicyBanner policy={policy} />
                <Step3Details
                  templateLoading={templateLoading}
                  template={template}
                  topLevel={topLevel}
                  childrenOf={childrenOf}
                  values={fieldValues}
                  onChange={(id, v) =>
                    setFieldValues((prev) => {
                      // V15c — Cascade-reset descendants when a parent value
                      // changes so stale sub-selections (e.g. an Antonio
                      // leaf left over from Brainrot → Secret) can't sit
                      // under a now-hidden parent and silently re-appear.
                      const next: Record<string, unknown> = { ...prev, [id]: v }
                      const attrs = template?.attributes ?? []
                      collectDescendantIds(id, attrs).forEach((childId) => {
                        delete next[childId]
                      })
                      return next
                    })
                  }
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
                  priceGuidance={priceGuidance}
                  categorySlug={selectedCategory.slug}
                  gameName={selectedGame.game_name}
                  gameSlug={selectedGame.game_slug}
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

      {/* V13 — Tiny tier/limit status sits just above the footer on Step 3
          so the big lime banner can go. Desktop only; on mobile the sticky
          publish bar already shows the most important info. */}
      {step === 3 && (
        <div className="mt-6 hidden sm:flex sm:justify-end">
          <PolicyStatusFooter policy={policy} />
        </div>
      )}

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
        'sm:relative sm:mt-3 sm:bg-transparent sm:px-0 sm:pt-3 sm:pb-0 sm:backdrop-blur-none',
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
          // D5 — On Step 1 (no Back button), the bottom-left slot becomes
          // the Bulk-upload entry point. Same border / size grammar as the
          // Back button so the footer reads as one row. Lime accent only on
          // hover so it doesn't compete with Continue.
          <Link
            href="/sell/bulk"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border-default bg-bg-raised px-3 text-sm font-medium text-text-secondary transition-colors hover:border-lime-tint-border hover:text-lime-text sm:px-4"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Bulk upload
          </Link>
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
          // R14 — Save draft removed; Create Offer is now the sole primary CTA.
          // Bumped to h-11, taller padding, no leading icon — the button
          // should read as the unambiguous next action, not one of two.
          <button
            type="button"
            onClick={() => handlePublish(false)}
            disabled={!canPublish || submitting}
            className={cn(
              'inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-bold uppercase tracking-wider transition-all sm:h-12 sm:px-8 sm:text-base',
              canPublish && !submitting
                ? 'bg-lime text-text-inverse shadow-lg shadow-elevated hover:bg-lime-hover hover:shadow-glow'
                : 'cursor-not-allowed bg-bg-raised text-text-disabled'
            )}
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (isEditMode ? 'Save Changes' : 'Create Offer')}
          </button>
        )}
      </div>
      </section>
    </main>
  )
}

// ─── Step 1: category picker ────────────────────────────────────────────────

// R12 — Category tile theme per slug: icon + gradient bg + accent ring.
// Each category gets a distinct gradient tint so the grid reads as a
// well-branded chooser rather than 'five generic dark cards'.
const CATEGORY_THEME: Record<
  string,
  {
    Icon: LucideIcon
    iconBg: string    // gradient classes for the icon plate
    ring: string      // hover/active ring accent
    /**
     * R15 — concrete one-line example shown on the tile instead of the DB
     * description. The DB descriptions ran long and got truncated; short
     * concrete examples (e.g. "Robux, V-Bucks, gold") read faster and
     * always fit on one line at this card size.
     */
    example: string
  }
> = {
  currency: {
    Icon: Coins,
    iconBg: 'bg-gradient-to-br from-amber-400/30 via-yellow-500/20 to-orange-500/20',
    ring: 'group-hover:border-amber-400/40',
    example: 'Robux, Gold',
  },
  items: {
    Icon: Backpack,
    iconBg: 'bg-gradient-to-br from-rose-500/30 via-pink-500/20 to-red-500/20',
    ring: 'group-hover:border-rose-400/40',
    example: 'Pets, Skins, Knives',
  },
  accounts: {
    Icon: UserSquare2,
    iconBg: 'bg-gradient-to-br from-sky-400/30 via-blue-500/20 to-indigo-500/20',
    ring: 'group-hover:border-sky-400/40',
    example: 'Ranked, Progression',
  },
  'top-up': {
    Icon: Zap,
    iconBg: 'bg-gradient-to-br from-yellow-300/30 via-amber-400/25 to-yellow-500/20',
    ring: 'group-hover:border-yellow-400/40',
    example: 'Crystals, UC, Crew',
  },
  boosting: {
    Icon: Trophy,
    iconBg: 'bg-gradient-to-br from-violet-400/30 via-purple-500/20 to-fuchsia-500/20',
    ring: 'group-hover:border-violet-400/40',
    example: 'Rank Pushes, Win Boosts',
  },
}

function Step1Category({
  categories, selected, onSelect,
}: {
  categories: GlobalCategory[]
  selected: GlobalCategory | null
  onSelect: (c: GlobalCategory) => void
}) {
  // R14 — Balanced flex-wrap layout: each tile takes a fixed share of the row
  // (~half on mobile, ~third on lg) and the last row centers any orphan cards
  // so the 5-category set reads as 2-2-1 (centered) instead of an
  // off-balance 3-2 grid.
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap justify-center gap-2.5">
      {categories.map((c, i) => {
        const active = selected?.id === c.id
        const disabled = !c.is_active
        const theme = CATEGORY_THEME[c.slug] ?? CATEGORY_THEME.items
        const Icon = theme.Icon
        return (
          <motion.button
            key={c.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(c)}
            // R17 — entry animation dropped on first paint. The page is
            // server-rendered; staggered fade-in made the tiles feel "loaded
            // later" than the navbar.
            initial={false}
            whileHover={!disabled ? { y: -1 } : undefined}
            transition={{ duration: 0.22 }}
            className={cn(
              // Flex basis: full width on mobile, half on sm+, third on lg+.
              // Calc subtracts half the gap (10px / 2 = 5px = 0.3125rem) so
              // the cards land flush without overflowing the row.
              'group relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition-all sm:p-3.5',
              'basis-full sm:basis-[calc(50%-0.3125rem)] lg:basis-[calc(33.333%-0.4167rem)]',
              disabled && 'cursor-not-allowed opacity-50',
              active
                ? 'border-lime bg-lime-tint-bg shadow-[0_0_0_2px_rgba(198,255,61,0.18)]'
                : cn('border-border-subtle bg-bg-overlay hover:border-border-strong hover:bg-bg-raised-hover', theme.ring),
            )}
          >
            {/* Icon plate — smaller than the previous tile design */}
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-default sm:h-11 sm:w-11',
                theme.iconBg,
              )}
            >
              <Icon className="h-5 w-5 text-text-primary sm:h-6 sm:w-6" strokeWidth={1.75} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-text-primary sm:text-base">{c.name}</span>
                {disabled && (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-warning bg-warning-bg px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-warning">
                    Soon
                  </span>
                )}
              </div>
              {/* R15 — concrete examples (see CATEGORY_THEME.example) replace
                  the DB description. Brighter color + no truncation so the
                  helper text is always readable. */}
              <div className="mt-0.5 truncate text-xs text-text-secondary sm:text-[13px]">
                {theme.example}
              </div>
            </div>

            {/* Trailing indicator */}
            {!disabled && (
              <span
                aria-hidden
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors',
                  active
                    ? 'bg-lime text-text-inverse'
                    : 'text-text-tertiary group-hover:text-text-primary',
                )}
              >
                {active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <ArrowRight className="h-3.5 w-3.5" />}
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
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          placeholder={`Search games that sell ${category.name.toLowerCase()}…`}
          className="h-11 w-full rounded-md border border-border-default bg-transparent pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
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
        // R11.b — denser game grid: up to 8 tiles per row on xl screens.
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
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
                  'group relative overflow-hidden rounded-xl border text-left transition-all',
                  active
                    ? 'border-lime shadow-[0_0_0_2px_rgba(198,255,61,0.18)]'
                    : 'border-border-default hover:border-border-strong hover:bg-bg-base'
                )}
              >
                {hasCover ? (
                  // Cover-art games: full-bleed image, name overlaid
                  <div className="relative aspect-square w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.game_cover_url!} alt={g.game_name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <div className="absolute bottom-1.5 left-2 right-2">
                      <div className="truncate text-xs font-semibold text-text-primary">{g.game_name}</div>
                    </div>
                  </div>
                ) : (
                  // Logo-only games: logo on a soft tint, name strip below
                  <div className="flex flex-col">
                    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-lime-tint-bg">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(198,255,61,0.12),transparent_60%)]" />
                      {g.game_logo_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={g.game_logo_url}
                          alt={g.game_name}
                          className="relative h-3/4 w-3/4 object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
                        />
                      ) : (
                        <div className="relative text-3xl">{g.game_emoji ?? '🎮'}</div>
                      )}
                    </div>
                    <div className="border-t border-border-subtle bg-bg-inset px-2 py-1.5">
                      <div className="truncate text-xs font-semibold text-text-primary">{g.game_name}</div>
                    </div>
                  </div>
                )}
                {active && (
                  <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-lime text-text-inverse shadow-lg shadow-glow">
                    <Check className="h-3 w-3" strokeWidth={3} />
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
            {/* Sub-field group — a thin lime left rail signals "this group
                depends on the parent". A tiny uppercase eyebrow above shows
                which parent value triggered it. R10 — replaces the
                'because you chose X' chip. */}
            <div className="mt-4 border-l-2 border-lime-tint-border pl-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                <span className="text-text-secondary">{attribute.name}:</span>{' '}
                <span className="text-lime-text">{labelFor(attribute, currentValue as string)}</span>
              </div>
              <div className="space-y-3">
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

  // R14 — per-field touched state so required attributes show "required" only
  // after the user has interacted and moved on (not on first paint).
  const [touched, setTouched] = useState(false)
  const isEmpty =
    v === undefined ||
    v === null ||
    v === '' ||
    (Array.isArray(v) && v.length === 0)
  const showError = attribute.is_required && touched && isEmpty
  const markTouched = () => setTouched(true)

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
          onBlur={markTouched}
          placeholder={attribute.placeholder ?? ''}
          maxLength={attribute.max_length ?? undefined}
          aria-invalid={showError || undefined}
          aria-required={attribute.is_required || undefined}
          className={inputCls}
        />
      )}

      {attribute.type === 'textarea' && (
        <textarea
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={markTouched}
          placeholder={attribute.placeholder ?? ''}
          maxLength={attribute.max_length ?? undefined}
          rows={3}
          aria-invalid={showError || undefined}
          aria-required={attribute.is_required || undefined}
          className={cn(inputCls, 'h-auto py-2')}
        />
      )}

      {attribute.type === 'number' && (
        <input
          type="number"
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={markTouched}
          placeholder={attribute.placeholder ?? ''}
          min={attribute.min_value ?? undefined}
          max={attribute.max_value ?? undefined}
          aria-invalid={showError || undefined}
          aria-required={attribute.is_required || undefined}
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
        <Combobox
          value={typeof v === 'string' ? v : ''}
          onChange={(val) => { onChange(val); markTouched() }}
          onBlur={markTouched}
          invalid={showError}
          placeholder={attribute.placeholder || 'Choose…'}
          ariaLabel={attribute.name}
          options={(attribute.options ?? []).map((o) => ({
            value: o.value,
            label: o.label,
            icon_url: o.icon_url,
          }))}
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

      {/* Required-field error — beats the hint when both would show. */}
      {showError ? (
        <FieldError className="mt-1.5">This field is required.</FieldError>
      ) : (
        attribute.help_text &&
        !(['select', 'multiselect', 'image_select', 'boolean'] as const).includes(attribute.type as any) && (
          <FieldHint className="mt-1.5">{attribute.help_text}</FieldHint>
        )
      )}
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
  // D2 — Price guidance from recently sold listings for this (game,
  // category). NULL until fetch resolves; when sample_size < 3 we still
  // return a row but the p25/median/p75 fields are null.
  priceGuidance: PriceGuidance | null
  // V13 — Category slug drives the field set. For 'currency' we hide
  // Title + Photos (auto-filled server-side) and rename Description to
  // Instructions.
  categorySlug?: string
  /** V13 — Used to label the currency banner ("Roblox Robux — title and image…"). */
  gameName?: string
  gameSlug?: string
}

// V13 — Display name for each game's primary currency. Mirrors the
// server-side map in `publishListing` so the seller-facing banner shows
// exactly what the buyer will see.
const CURRENCY_UNIT_NAMES: Record<string, string> = {
  roblox: 'Robux',
  fortnite: 'V-Bucks',
  valorant: 'Valorant Points',
  'genshin-impact': 'Genesis Crystals',
  'apex-legends': 'Apex Coins',
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

  // R14 — Touched state for required fields. A field is "touched" once it has
  // received and then lost focus. The error message + red border appear only
  // for touched-and-empty required fields, so the seller isn't yelled at the
  // moment the form first renders.
  const [touched, setTouched] = useState<{
    title?: boolean
    price?: boolean
  }>({})
  const mark = (k: keyof typeof touched) => setTouched((t) => ({ ...t, [k]: true }))

  const titleInvalid = touched.title && !p.title.trim()
  const priceInvalid = touched.price && !(parseFloat(p.price) > 0)

  // V13 — Currency listings skip Title + Photos (auto-filled server-side)
  // and the Description sub-card is re-labelled "Instructions" so buyers
  // understand it's a how-to, not marketing copy.
  const isCurrency = p.categorySlug === 'currency'

  return (
    <div className="space-y-5">
      {/* Title — hidden for currency */}
      {!isCurrency && (
        <SubCard title="Title">
          <FieldRow>
            <input
              value={p.title}
              onChange={(e) => p.setTitle(e.target.value)}
              onBlur={() => mark('title')}
              placeholder="e.g., Mythical Brainrot — Tralalero Tralala — Mutation: Golden"
              maxLength={100}
              aria-invalid={titleInvalid || undefined}
              aria-required
              className={inputCls}
            />
            {titleInvalid ? (
              <FieldError>This field is required.</FieldError>
            ) : (
              <FieldHint>
                Add the most searchable words at the front. Titles have a 100 character limit.
              </FieldHint>
            )}
          </FieldRow>
        </SubCard>
      )}

      {/* V13 — Currency listings have title + image auto-filled on the
          server, so the seller just sees a small confirmation here.
          Label uses the real "Game Currency" pair (e.g. "Roblox Robux"). */}
      {isCurrency && (() => {
        const unit = (p.gameSlug && CURRENCY_UNIT_NAMES[p.gameSlug]) || 'Currency'
        const label = p.gameName ? `${p.gameName} ${unit}` : unit
        return (
          <div className="rounded-2xl border border-lime-tint-border bg-lime-tint-bg/40 px-4 py-3">
            <p className="text-[13px] text-text-secondary">
              <span className="font-semibold text-lime-text">{label}</span>
              {' '}— Title and Image are set automatically. You only need to fill
              Instructions, Price, and Delivery Time.
            </p>
          </div>
        )
      })()}

      {/* Description (or Instructions for currency) */}
      <SubCard title={isCurrency ? 'Instructions' : 'Description'}>
        <FieldRow>
          <textarea
            value={p.description}
            onChange={(e) => p.setDescription(e.target.value)}
            placeholder={
              isCurrency
                ? 'e.g.\n1. Send me your Roblox username at checkout.\n2. Join my Roblox group (link in confirmation email).\n3. Wait for group payout — usually under 10 minutes.'
                : 'What’s included, condition, delivery notes, terms…'
            }
            rows={isCurrency ? 6 : 5}
            maxLength={isCurrency ? 1000 : 2000}
            className={cn(inputCls, 'h-32 resize-none overflow-y-auto py-2 sm:h-36', isCurrency && 'sm:h-44')}
          />
          <FieldHint>
            {isCurrency
              ? 'Step-by-step instructions buyers will see on the offer card. Line breaks allowed.'
              : 'Be specific. Include condition, delivery method, and any terms.'}
          </FieldHint>
        </FieldRow>
      </SubCard>

      {/* Photos — hidden for currency (auto-set to currency icon) */}
      {!isCurrency && (
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
      )}

      {/* Pricing */}
      <SubCard title="Pricing">
        <div className={cn('grid gap-3', !isCurrency && 'sm:grid-cols-2')}>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {isCurrency ? 'Price per unit' : 'Your price'} <span className="text-error">*</span>
            </label>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="number"
                value={p.price}
                onChange={(e) => p.setPrice(e.target.value)}
                onBlur={() => mark('price')}
                // V13 — Currency: 4-decimal precision (e.g. 0.0045 / Robux).
                // Other categories: standard 2-decimal pricing.
                placeholder={isCurrency ? '0.0045' : '0.00'}
                step={isCurrency ? '0.0001' : '0.01'}
                min="0"
                aria-invalid={priceInvalid || undefined}
                aria-required
                className={cn(inputCls, 'pl-9')}
              />
            </div>
            {priceInvalid && (
              <FieldError>This field is required.</FieldError>
            )}
          </div>
          {/* V13 — Original price (discount badge) hidden for currency. */}
          {!isCurrency && (
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
          )}
        </div>

        {/* D2 — Price guidance band from the last 60 days of sold listings
            in this (game, category). Only shown when sample_size >= 3
            (the RPC nulls out the bucket fields otherwise). */}
        <PriceGuidanceCard
          guidance={p.priceGuidance}
          currentPrice={parseFloat(p.price)}
        />

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
              // V13 — Currency sellers commonly hold millions of units (e.g.
              // 22M Robux). Bump the cap to 10M so the field accepts realistic
              // currency stock levels.
              maxValue={10_000_000}
              ariaLabel="Stock"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Min order qty
            </label>
            <NumberField
              value={Number.isFinite(parseInt(p.minQuantity, 10)) ? parseInt(p.minQuantity, 10) : (isCurrency ? 100 : 1)}
              onChange={(v) => p.setMinQuantity(String(v))}
              // V14 — Currency listings require a 100-unit minimum order. Below
              // that, transaction fees eat the seller's margin and buyers tend
              // to misuse the listing as a top-up. Enforced server-side too.
              minValue={isCurrency ? 100 : 1}
              maxValue={Math.max(isCurrency ? 100 : 1, parseInt(p.quantity || '1', 10))}
              ariaLabel="Minimum order quantity"
            />
          </div>
        </div>
        <FieldHint className="mt-3">
          {isCurrency
            ? 'Set stock to what you can actually fulfill. Minimum order for currency listings is 100 units — below that, fees eat your margin.'
            : 'Set stock to what you can actually fulfill. Min order qty is the smallest amount a buyer can purchase.'}
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
            {/* V13 — Currency listings use minute-based presets + custom.
                Other categories keep the existing hour-based grid. */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {(isCurrency ? DELIVERY_TIMES_CURRENCY : DELIVERY_TIMES).map((t) => {
                const isCustom = t.value === 'custom'
                const customActive =
                  isCustom &&
                  !(isCurrency ? DELIVERY_TIMES_CURRENCY : DELIVERY_TIMES)
                    .filter((x) => x.value !== 'custom')
                    .some((x) => x.value === p.deliveryTime)
                const on = isCustom ? customActive : p.deliveryTime === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      if (isCustom) {
                        const raw = prompt('Custom delivery (minutes)', '10')
                        const m = parseInt(raw ?? '', 10)
                        if (Number.isFinite(m) && m > 0) p.setDeliveryTime(`${m}min`)
                      } else {
                        p.setDeliveryTime(t.value)
                      }
                    }}
                    className={cn(
                      'h-10 rounded-xl border text-sm font-medium transition-colors',
                      on
                        ? 'border-lime bg-lime-tint-bg text-lime-text'
                        : 'border-border-default bg-bg-inset text-text-secondary hover:border-border-strong hover:text-text-primary'
                    )}
                  >
                    {isCustom && customActive
                      ? p.deliveryTime.replace('min', ' min')
                      : t.label}
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
 * FieldHint — small surface containing dim text under a control.
 * R14: contained in a soft `bg-bg-inset` box with a subtle border so hints
 * no longer "float". Reverses the R7 "no surface" call after seller feedback
 * that bare grey text read as out-of-place.
 */
function FieldHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'rounded-md border border-border-subtle bg-bg-inset px-2.5 py-1.5 text-[11px] leading-snug text-text-tertiary',
        className,
      )}
    >
      {children}
    </p>
  )
}

/**
 * FieldError — red message shown beneath a touched-but-empty required field.
 * Mirrors FieldHint's shape so the layout doesn't jump when error replaces hint.
 */
function FieldError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        'rounded-md border border-error/40 bg-error-bg px-2.5 py-1.5 text-[11px] leading-snug text-error',
        className,
      )}
    >
      {children}
    </p>
  )
}

// ─── PolicyBanner — D1 moderation/cap status at the top of Step 3 ───────────

/**
 * D1 — Surfaces the seller's tier, moderation status, and active-listing
 * cap at the top of Step 3 so they know what to expect BEFORE they hit
 * Create Offer. Three states:
 *   1. needs_moderation  → amber  "Your first N listings need review."
 *   2. at_listing_limit  → red    "You're at your cap — pause one first."
 *   3. otherwise         → lime   "Auto-publishing as <Tier>."
 */
/**
 * Action-required states (cap reached, needs moderation) keep a small
 * banner so the seller can't miss them. The default "auto-publishing"
 * case is rendered as a tiny status footer beneath the Create Offer
 * button instead (see `<PolicyStatusFooter/>` below).
 */
function PolicyBanner({ policy }: { policy: SellerPublishPolicy | null }) {
  if (!policy) return null

  if (policy.at_listing_limit) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-error/40 bg-error-bg px-3 py-2.5">
        <IconX className="mt-0.5 h-4 w-4 shrink-0 text-error" strokeWidth={3} />
        <div className="min-w-0 flex-1 text-[13px]">
          <span className="font-semibold text-error">
            At your listing cap ({policy.listing_limit}).
          </span>{' '}
          <span className="text-text-secondary">
            Pause one of your existing listings, or level up your tier.
          </span>
        </div>
      </div>
    )
  }

  if (policy.needs_moderation) {
    const remaining = Math.max(
      0,
      policy.pre_moderation_listings - policy.approved_listings,
    )
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-bg px-3 py-2.5">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2.5} />
        <div className="min-w-0 flex-1 text-[13px]">
          <span className="font-semibold text-warning">
            New seller — {remaining} review{remaining === 1 ? '' : 's'} left.
          </span>{' '}
          <span className="text-text-secondary">
            Your first {policy.pre_moderation_listings} listings are reviewed by our team before going live.
          </span>
        </div>
      </div>
    )
  }

  // Default ok state is NOT rendered here — see PolicyStatusFooter below.
  return null
}

/**
 * V13 — Tiny status line shown just above the footer Create Offer button.
 * Replaces the big lime "Bronze seller — auto-publishing" panel that
 * dominated the top of Step 3. Pulls weight off the banner area when
 * everything is fine.
 */
function PolicyStatusFooter({ policy }: { policy: SellerPublishPolicy | null }) {
  if (!policy) return null
  if (policy.at_listing_limit || policy.needs_moderation) return null // banner handles these

  const tierLabel = policy.tier.charAt(0).toUpperCase() + policy.tier.slice(1)
  const limitCopy = policy.listing_limit
    ? `${policy.active_count}/${policy.listing_limit} active`
    : `${policy.active_count} active`

  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] text-text-tertiary">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      <span>
        Auto-publishing as <span className="font-medium text-text-secondary">{tierLabel}</span>
        <span className="mx-1.5 text-text-disabled">·</span>
        {limitCopy}
      </span>
    </div>
  )
}

// ─── D3 — Buyer-card live preview ──────────────────────────────────────────

/**
 * D3 — Live preview of what the buyer will see in marketplace search. Mirrors
 * the visual structure of `src/components/listing-card.tsx` but operates on
 * raw wizard state (no Listing object required) and renders as a
 * non-interactive `<div>` instead of a `<Link>` — no wishlist button, no
 * navigation. Updates in realtime as the seller fills out the form.
 *
 * We don't reuse ListingCard directly because it expects a full
 * `ListingWithRelations` (seller profile, game record, category record,
 * stable id, etc.) and embeds `<WishlistButton/>` which would call APIs
 * with a placeholder id. The preview here is the same visual shell minus
 * those concerns.
 */
function BuyerCardPreview({
  title, price, originalPrice, images, deliveryTime, deliveryMethod,
  quantity, game, category,
}: {
  title: string
  price: string
  originalPrice: string
  images: string[]
  deliveryTime: string
  deliveryMethod: 'manual' | 'instant'
  quantity: string
  game: SellGameOption
  category: GlobalCategory
}) {
  const primaryImage = images[0] || null
  const priceNum = parseFloat(price)
  const origPriceNum = parseFloat(originalPrice)
  const qtyNum = parseInt(quantity, 10)
  const hasPriceDrop = Number.isFinite(origPriceNum) && origPriceNum > priceNum && priceNum > 0
  const discountPct = hasPriceDrop
    ? Math.round(((origPriceNum - priceNum) / origPriceNum) * 100)
    : 0
  const isLowStock = Number.isFinite(qtyNum) && qtyNum > 0 && qtyNum <= 5

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-inset p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          Buyer preview
        </div>
        <div className="text-[10px] text-text-tertiary">Updates live</div>
      </div>

      {/* The card itself — pointer-events-none on the whole thing so nothing
          here is clickable, but we keep hover styles for visual fidelity. */}
      <div className="pointer-events-none mx-auto w-full max-w-xs">
        <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-white/[0.04] backdrop-blur-sm">
          {/* Image area */}
          <div className="relative aspect-[4/3] overflow-hidden bg-bg-overlay">
            {primaryImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={primaryImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl text-text-disabled">
                {game.game_emoji ?? '🎮'}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Game chip */}
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-md">
              {game.game_emoji && <span className="text-xs">{game.game_emoji}</span>}
              <span className="text-[10px] font-medium leading-none text-white/80">{game.game_name}</span>
            </div>

            {/* Stock badge */}
            {isLowStock && (
              <div className="absolute right-2.5 top-2.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-1 text-[10px] font-semibold leading-none text-amber-400 backdrop-blur-md">
                {qtyNum} left
              </div>
            )}

            {/* Price */}
            <div className="absolute bottom-2.5 left-2.5 flex flex-col items-start gap-0.5">
              {hasPriceDrop && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] leading-none text-white/50 line-through">
                    ${origPriceNum.toFixed(2)}
                  </span>
                  <span className="rounded bg-green-500/90 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    -{discountPct}%
                  </span>
                </div>
              )}
              <span className="font-mono text-xl font-bold text-white drop-shadow-md">
                {Number.isFinite(priceNum) && priceNum > 0 ? `$${priceNum.toFixed(2)}` : '$—'}
              </span>
            </div>

            {/* Delivery time */}
            {deliveryTime && (
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 backdrop-blur-md">
                {deliveryMethod === 'instant' ? (
                  <Zap className="h-3 w-3 text-lime-text" />
                ) : (
                  <Clock className="h-3 w-3 text-white/60" />
                )}
                <span className="text-[10px] leading-none text-white/70">{deliveryTime}</span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-lime-text/80">
              {category.name}
            </div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {title || 'Your offer title appears here'}
            </h3>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── D2 — Price guidance band ──────────────────────────────────────────────

/**
 * Shows a horizontal band representing the p25–p75 range of recent sold
 * prices for this (game, category), with a marker for the seller's current
 * price so they immediately see whether they're above / below market.
 *
 * Hidden until we have a meaningful sample (>= 3 sales in 60 days). When
 * the seller is way above p75 we tag the marker red; below p25 yellow;
 * inside the band lime.
 */
function PriceGuidanceCard({
  guidance, currentPrice,
}: {
  guidance: PriceGuidance | null
  currentPrice: number
}) {
  if (!guidance || guidance.sample_size < 3 || guidance.p25 == null || guidance.p75 == null || guidance.median == null) {
    return null
  }

  const { p25, median, p75, sample_size } = guidance
  // Pad each end so the marker has room when the seller types something
  // wildly off-band; clamp to [0, ∞).
  const span = p75 - p25
  const padded_min = Math.max(0, p25 - span * 0.5)
  const padded_max = p75 + span * 0.5
  const range = Math.max(0.01, padded_max - padded_min)

  const hasValidPrice = Number.isFinite(currentPrice) && currentPrice > 0
  const pricePct = hasValidPrice
    ? Math.min(100, Math.max(0, ((currentPrice - padded_min) / range) * 100))
    : null

  const p25Pct    = ((p25    - padded_min) / range) * 100
  const medianPct = ((median - padded_min) / range) * 100
  const p75Pct    = ((p75    - padded_min) / range) * 100

  const tone: 'good' | 'high' | 'low' | null = hasValidPrice
    ? currentPrice > p75 ? 'high'
    : currentPrice < p25 ? 'low'
    : 'good'
    : null

  const toneCopy =
    tone === 'high' ? `Above market — most sold for $${p25.toFixed(2)}–$${p75.toFixed(2)}.`
    : tone === 'low' ? `Below market — most sold for $${p25.toFixed(2)}–$${p75.toFixed(2)}.`
    : tone === 'good' ? `In the typical range. Median $${median.toFixed(2)}.`
    : `Most recent sales went for $${p25.toFixed(2)}–$${p75.toFixed(2)} (median $${median.toFixed(2)}).`

  const toneClass =
    tone === 'high' ? 'text-error'
    : tone === 'low' ? 'text-warning'
    : tone === 'good' ? 'text-lime-text'
    : 'text-text-secondary'

  return (
    <div className="mt-3 rounded-xl border border-border-subtle bg-bg-inset p-3">
      <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        <span>Recent sales</span>
        <span>{sample_size} sold · last 60 days</span>
      </div>

      {/* Band */}
      <div className="relative h-2 w-full rounded-full bg-bg-raised-hover">
        <div
          className="absolute inset-y-0 rounded-full bg-lime/40"
          style={{ left: `${p25Pct}%`, width: `${Math.max(0, p75Pct - p25Pct)}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-lime-text"
          style={{ left: `${medianPct}%` }}
          aria-hidden
        />
        {pricePct !== null && (
          <div
            className={cn(
              'absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full',
              tone === 'high' && 'bg-error',
              tone === 'low'  && 'bg-warning',
              tone === 'good' && 'bg-lime',
            )}
            style={{ left: `${pricePct}%` }}
            aria-hidden
          />
        )}
      </div>

      {/* Labels */}
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-text-tertiary">
        <span>${p25.toFixed(2)}</span>
        <span>median ${median.toFixed(2)}</span>
        <span>${p75.toFixed(2)}</span>
      </div>

      <p className={cn('mt-2 text-[11px] leading-snug', toneClass)}>{toneCopy}</p>
    </div>
  )
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
      <div className="mb-7 flex items-center justify-between border-b border-border-subtle pb-1.5 sm:mb-8 sm:pb-2">
        <h2 className="text-base font-bold text-text-primary">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

// ─── Shared input styles ─────────────────────────────────────────────────────

// R14 — reverted to rounded-md from R12's rounded-none after seller feedback
// that the sharp corners felt severe. Still transparent over the sub-card
// surface; border defines the field. Focused border turns lime.
const inputCls =
  'h-10 w-full rounded-md border border-border-default bg-transparent px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg transition-colors aria-[invalid=true]:border-error aria-[invalid=true]:focus:ring-error-bg'
