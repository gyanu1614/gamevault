'use client'

/**
 * /account/listings — seller offer tables ("Offers" in the sidebar).
 *
 * V33 — Offers-table revamp (replaces the V4 card grid). One shared
 * table framework renders all four offer sections via ?type=
 * (currency | items | accounts | top-up — the sidebar sub-items drive
 * the param):
 *
 *   header (title + Add New Offer) → filter row (Game / Status / Bulk
 *   Actions / search / sort) → results card (table) → pagination.
 *
 * Columns: Offer (logo + title + game), Offer ID (sequential
 * offer_number chip w/ copy — falls back to a short UUID prefix until
 * the add-offer-number migration runs), Delivery Time, Price (inline
 * PriceField — grey tick clean, lime tick dirty→save), Status, Stock,
 * Min Quantity, Delivery Method, Updated, ⋮ actions.
 *
 * Status display mapping (UI only, no schema change): active→Active,
 * paused→Paused, draft→Draft, archived+sold→Closed, suspended→
 * Suspended (admin), pending_approval→Under Review; store Offline Mode
 * overrides Active with an amber Offline chip.
 *
 * Design: rectangular geometry (rounded-lg card / rounded-md inner),
 * grey hovers, no green fills — only the green tick. Approved via
 * /dev/offers-preview.
 *
 * Data + mutations preserved from the old page: useSellerListings
 * (update / bulkUpdate / bulkDelete), RestrictionBanner + publish
 * gating, getMyStorePaused offline badge.
 */

import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Archive, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Clock, Copy, ExternalLink, LayoutGrid,
  Link2, Loader2, MoreVertical, Package, Pause, Pencil, Play, Plus,
  Search, Trash2, X,
} from 'lucide-react'

import { useAuth } from '@/hooks/use-auth'
import { useSellerListings } from '@/hooks/use-seller-listings'
import type { Listing } from '@/lib/api/seller-compatible'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'
import { canSellerPublish, type SellerStatus } from '@/lib/utils/seller-status'
import { getMyStorePaused } from '@/lib/actions/seller-presence'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import RestrictionBanner from '@/components/seller/RestrictionBanner'
import { SellerOnlyGate } from '@/components/seller/SellerOnlyGate'

import { Checkbox } from '@/components/ui/checkbox'
import { PriceField } from '@/components/ui/price-field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Offer sections ──────────────────────────────────────────────────────────

import { classifyOfferType, type OfferType } from '@/lib/utils/offer-type'

const OFFER_META: Record<OfferType, { title: string }> = {
  currency: { title: 'Currency Offers' },
  items: { title: 'Item Offers' },
  accounts: { title: 'Account Offers' },
  'top-up': { title: 'Top Up Offers' },
}

// ─── Status chips ────────────────────────────────────────────────────────────

type ChipKey = 'active' | 'paused' | 'draft' | 'closed' | 'suspended' | 'pending' | 'offline' | 'changes'

const STATUS_CHIP: Record<ChipKey, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'border-[rgba(198,255,61,0.22)] bg-[rgba(198,255,61,0.10)] text-lime-text' },
  offline: { label: 'Offline', cls: 'border-amber-400/25 bg-amber-400/10 text-amber-300' },
  paused: { label: 'Paused', cls: 'border-amber-400/25 bg-amber-400/10 text-amber-300' },
  draft: { label: 'Draft', cls: 'border-white/[0.12] bg-white/[0.05] text-text-secondary' },
  pending: { label: 'Under Review', cls: 'border-sky-400/25 bg-sky-400/10 text-sky-300' },
  changes: { label: 'Changes Requested', cls: 'border-amber-400/25 bg-amber-400/10 text-amber-300' },
  closed: { label: 'Closed', cls: 'border-white/[0.08] bg-white/[0.03] text-text-tertiary' },
  suspended: { label: 'Suspended', cls: 'border-red-500/25 bg-red-500/10 text-red-300' },
}

/** DB status → display chip (Closed = archived + sold; Offline Mode
 *  overrides Active). */
function chipKeyFor(status: string, storePaused: boolean): ChipKey {
  if (status === 'active') return storePaused ? 'offline' : 'active'
  if (status === 'paused') return 'paused'
  if (status === 'draft') return 'draft'
  if (status === 'pending_approval') return 'pending'
  if (status === 'changes_requested') return 'changes'
  if (status === 'suspended') return 'suspended'
  return 'closed' // archived, sold, rejected, anything legacy
}

function StatusChip({ k }: { k: ChipKey }) {
  const c = STATUS_CHIP[k]
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-md border px-2 py-[3px] text-[12px] font-bold', c.cls)}>
      {c.label}
    </span>
  )
}

type FilterStatus = 'all' | 'active' | 'paused' | 'draft' | 'closed' | 'pending_approval' | 'changes_requested'

const FILTER_STATUSES: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' },
  { value: 'pending_approval', label: 'Under Review' },
  { value: 'changes_requested', label: 'Changes Requested' },
]

function matchesStatusFilter(status: string, f: FilterStatus): boolean {
  const closed = status === 'archived' || status === 'sold'
  // Default view is the working set — Closed offers only show when the
  // Closed filter is explicitly picked.
  if (f === 'all') return !closed
  if (f === 'closed') return closed
  return status === f
}

// ─── Formatters ──────────────────────────────────────────────────────────────

/** Compact stock: 1580 → 1.5K, 99e9 → 99B (capitalized per design). */
function fmtCompact(n: number): string {
  const fmt = (v: number, suffix: string) => {
    const r = Math.round(v * 10) / 10
    return `${r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)}${suffix}`
  }
  if (n >= 1e9) return fmt(n / 1e9, 'B')
  if (n >= 1e6) return fmt(n / 1e6, 'M')
  if (n >= 1e3) return fmt(n / 1e3, 'K')
  return String(n)
}

function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return '—'
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  const months = Math.round(days / 30)
  return `${months} ${months === 1 ? 'month' : 'months'} ago`
}

function methodLabel(method: string | null | undefined): string {
  const m = (method || 'manual').toLowerCase()
  if (m === 'instant') return 'Instant'
  if (m === 'manual') return 'Manual'
  // Future per-game methods (in-game / gifting / …) display Title Cased.
  return m.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function escapeRegExp(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Currency rows: sellers often prefix titles with the game name the row
 *  already shows underneath ("Fortnite 800 V-Bucks"). Show just the
 *  bundle name ("800 V-Bucks"). Display-only — the stored title is
 *  untouched. */
function displayTitle(l: Listing, type: OfferType): string {
  if (type !== 'currency' || !l.game?.name) return l.title
  const stripped = l.title
    .replace(new RegExp(`^\\s*${escapeRegExp(l.game.name)}\\s*[-–—:|]?\\s*`, 'i'), '')
    .trim()
  return stripped || l.title
}

/** Public listing URL (mirrors the marketplace route shape). */
function publicPath(l: Listing): string {
  return `/${l.game?.slug ?? ''}/${l.category?.slug ?? ''}/${(l.slug && l.slug.trim()) || l.id}`
}

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'stock', label: 'Stock' },
] as const
type SortKey = (typeof SORTS)[number]['value']

/** Bulk delivery-time presets — union of the wizard's grids. */
const DELIVERY_TIME_OPTIONS = ['instant', '5min', '15min', '30min', '1hr', '3hr', '6hr', '12hr', '24hr']

// ─── Dense rectangular menu recipe (matches /dev/offers-preview) ────────────

const MENU_CLS =
  // Platform-card material, opaque enough to read over the table: border-2
  // plate + top sheen (before:) + deep drop shadow + heavy blur.
  "relative overflow-hidden rounded-lg border-2 border-border-default bg-[rgba(17,18,26,0.96)] p-1.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.75)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-10 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent)] before:content-['']"
const ITEM_CLS =
  'h-9 cursor-pointer gap-2.5 rounded-[5px] px-2.5 text-[13px] font-semibold text-text-secondary focus:text-text-primary'
const LABEL_CLS =
  'px-2.5 pb-1 pt-1.5 text-[12px] font-extrabold uppercase tracking-[0.08em] text-text-tertiary'

// ─── Small building blocks ───────────────────────────────────────────────────

const FilterTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean
    /** Show a small ✕ instead of the chevron; clicking it runs onClear
     *  AND still opens the menu (no stopPropagation — Radix's trigger
     *  fires as usual). Clicking anywhere else keeps the selection. */
    clearable?: boolean
    onClear?: () => void
  }
>(({ children, active = false, disabled = false, clearable = false, onClear, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    disabled={disabled}
    {...props}
    className={cn(
      // Bundle platform-card surface: blackened plate + top sheen, hover
      // lift + border-strong. Active (filter applied) holds the lifted
      // plate — no lime.
      'relative flex h-[42px] min-w-[132px] items-center justify-between gap-2.5 overflow-hidden whitespace-nowrap rounded-md border-2 px-4 text-[13.5px] font-semibold backdrop-blur-md transition-all duration-200',
      active
        ? 'border-border-strong bg-[rgba(26,26,35,0.70)] text-text-primary'
        : 'border-border-default bg-[rgba(20,20,27,0.56)] text-text-secondary',
      disabled
        ? 'cursor-not-allowed opacity-50'
        : 'hover:-translate-y-0.5 hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)] hover:text-text-primary hover:shadow-[0_12px_24px_-12px_rgba(0,0,0,0.6)]',
      className,
    )}
  >
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent)]"
    />
    {/* Children clip inside their own box so the ✕/chevron never gets
        pushed out of the trigger at narrow widths. */}
    <span className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">{children}</span>
    {clearable ? (
      <span
        role="button"
        tabIndex={-1}
        aria-label="Clear filter"
        onPointerDown={() => onClear?.()}
        // ≥36px touch target — negative margins keep the trigger's visual
        // size; the 14px X stays centered.
        className="-my-2 -mr-2.5 flex h-9 w-9 flex-none items-center justify-center rounded text-text-tertiary transition-colors hover:bg-white/[0.10] hover:text-text-primary"
      >
        <X className="h-3.5 w-3.5" />
      </span>
    ) : (
      <ChevronDown className="h-3.5 w-3.5 flex-none text-text-tertiary" />
    )}
  </button>
))
FilterTrigger.displayName = 'FilterTrigger'

/** #33404-style chip. Falls back to a short UUID prefix until the
 *  offer_number migration has run. */
function OfferIdChip({ listing }: { listing: Listing }) {
  const display = listing.offer_number != null ? `#${listing.offer_number}` : `#${listing.id.slice(0, 8).toUpperCase()}`
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(display)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <span className="inline-flex h-9 items-stretch overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.03]">
      <span className="flex items-center px-2.5 text-[12.5px] font-semibold tabular-nums text-text-secondary">
        {display}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy offer ID ${display}`}
        className="flex w-9 items-center justify-center border-l border-white/[0.08] text-text-tertiary transition-colors hover:bg-white/[0.05] hover:text-text-primary"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-lime-text" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ListingsPage() {
  return (
    <SellerOnlyGate>
      <OffersContent />
    </SellerOnlyGate>
  )
}

function OffersContent() {
  const router = useRouter()
  const { user } = useAuth()
  const searchParams = useSearchParams()

  const type: OfferType = (() => {
    const t = (searchParams.get('type') || '').toLowerCase()
    return t in OFFER_META ? (t as OfferType) : 'currency'
  })()

  const { listings, isLoading, error, updateListing, deleteListing, bulkUpdate, bulkDelete } = useSellerListings()

  // Restriction + Offline Mode (carried over from the old page).
  const sellerStatus = (((user?.profile as Record<string, unknown> | undefined)?.seller_status as SellerStatus) || 'active')
  const isRestricted = !canSellerPublish(sellerStatus)
  const [storePaused, setStorePaused] = useState(false)
  useEffect(() => {
    let active = true
    getMyStorePaused().then((v) => { if (active) setStorePaused(v) })
    return () => { active = false }
  }, [])

  // ── Filters / sort / pagination state ──
  const [gameId, setGameId] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [perPage, setPerPage] = useState(15)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Section rows + the games represented in them (for the Game filter).
  const typed = useMemo(
    () => listings.filter((l) => classifyOfferType(l.category?.metadata?.type, l.category?.slug) === type),
    [listings, type],
  )
  const games = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; image?: string | null }>()
    for (const l of typed) {
      if (l.game && !seen.has(l.game.id)) {
        seen.set(l.game.id, { id: l.game.id, name: l.game.name, image: l.game.image_url })
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [typed])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = typed.filter(
      (l) =>
        (gameId === 'all' || l.game_id === gameId) &&
        matchesStatusFilter(l.status, statusFilter) &&
        (q === '' ||
          l.title.toLowerCase().includes(q) ||
          (l.offer_number != null && `#${l.offer_number}`.includes(q))),
    )
    const by: Record<SortKey, (a: Listing, b: Listing) => number> = {
      newest: (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      oldest: (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
      'price-desc': (a, b) => b.price - a.price,
      'price-asc': (a, b) => a.price - b.price,
      stock: (a, b) => (b.is_unlimited ? Infinity : b.quantity ?? 0) - (a.is_unlimited ? Infinity : a.quantity ?? 0),
    }
    return [...rows].sort(by[sort])
  }, [typed, gameId, statusFilter, search, sort])

  const pageCount = Math.max(1, Math.ceil(visible.length / perPage))
  const safePage = Math.min(page, pageCount)
  const paged = visible.slice((safePage - 1) * perPage, safePage * perPage)

  // Reset page + selection when the view changes underneath them.
  useEffect(() => { setPage(1) }, [type, gameId, statusFilter, search, perPage, sort])
  useEffect(() => { setSelected(new Set()); setGameId('all'); setSearch('') }, [type])

  const allSelected = paged.length > 0 && paged.every((l) => selected.has(l.id))
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(paged.map((l) => l.id)))
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // ── Mutations ──
  const [archiveTarget, setArchiveTarget] = useState<Listing | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeliveryOpen, setBulkDeliveryOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const savePrice = async (l: Listing, next: number) => {
    await updateListing({ id: l.id, updates: { price: next }, silent: true })
    toast.success('Price updated')
  }
  const setStatus = async (l: Listing, status: 'active' | 'paused') => {
    if (status === 'active' && isRestricted) {
      toast.error('Your account is restricted — offers can’t be activated right now.')
      return
    }
    await updateListing({ id: l.id, updates: { status }, silent: true })
    toast.success(status === 'active' ? 'Offer activated' : 'Offer paused')
  }
  const archive = async () => {
    if (!archiveTarget) return
    setBusy(true)
    try {
      await updateListing({ id: archiveTarget.id, updates: { status: 'archived' }, silent: true })
      toast.success('Offer archived')
      setArchiveTarget(null)
    } finally {
      setBusy(false)
    }
  }
  const isFkViolation = (e: unknown) => {
    const err = e as { code?: string; message?: string } | null
    return err?.code === '23503' || /foreign key/i.test(err?.message ?? '')
  }
  const removeOne = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await deleteListing({ id: deleteTarget.id, silent: true })
      toast.success('Offer deleted')
      setDeleteTarget(null)
    } catch (e) {
      if (isFkViolation(e)) {
        // Order rows reference this listing — it must stay for history.
        await updateListing({ id: deleteTarget.id, updates: { status: 'archived' }, silent: true })
        toast.info('This offer has order history, so it can’t be permanently deleted — it was archived instead.')
        setDeleteTarget(null)
      } else {
        toast.error((e as Error)?.message || 'Failed to delete offer')
      }
    } finally {
      setBusy(false)
    }
  }
  const copyUrl = (l: Listing) => {
    void navigator.clipboard?.writeText(`${window.location.origin}${publicPath(l)}`)
    toast.success('Public link copied')
  }
  const ids = () => Array.from(selected)
  const bulkStatus = async (status: 'active' | 'paused') => {
    if (status === 'active' && isRestricted) {
      toast.error('Your account is restricted — offers can’t be activated right now.')
      return
    }
    await bulkUpdate({ ids: ids(), updates: { status } })
    setSelected(new Set())
  }
  const bulkDelivery = async (value: string) => {
    setBusy(true)
    try {
      await bulkUpdate({ ids: ids(), updates: { delivery_time: value } })
      setSelected(new Set())
      setBulkDeliveryOpen(false)
    } finally {
      setBusy(false)
    }
  }
  const bulkRemove = async () => {
    setBusy(true)
    try {
      await bulkDelete(ids())
      setSelected(new Set())
      setBulkDeleteOpen(false)
    } catch {
      // Hook already toasts (incl. the friendly order-history message).
    } finally {
      setBusy(false)
    }
  }

  const gameName = gameId === 'all' ? null : games.find((g) => g.id === gameId)
  const rangeStart = visible.length === 0 ? 0 : (safePage - 1) * perPage + 1
  const rangeEnd = Math.min(safePage * perPage, visible.length)

  /** Row ⋮ actions — one menu shared by the md+ table and the below-md
   *  card list (only the trigger sizing differs). */
  const renderActionsMenu = (l: Listing, triggerClassName: string) => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Actions for ${l.title}`} className={triggerClassName}>
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn('w-60', MENU_CLS)}>
        <DropdownMenuLabel className={LABEL_CLS}>Offer Actions</DropdownMenuLabel>
        <DropdownMenuItem
          className={cn(ITEM_CLS, l.status === 'changes_requested' && 'text-amber-300 focus:text-amber-200')}
          onClick={() => router.push(`/sell/edit/${l.id}`)}
        >
          <Pencil className="h-4 w-4" />
          {l.status === 'changes_requested' ? 'Edit & Resubmit' : 'Edit Offer'}
        </DropdownMenuItem>
        {l.status === 'active' && (
          <DropdownMenuItem className={ITEM_CLS} onClick={() => void setStatus(l, 'paused')}>
            <Pause className="h-4 w-4" /> Pause Offer
          </DropdownMenuItem>
        )}
        {l.status === 'paused' && (
          <DropdownMenuItem className={ITEM_CLS} onClick={() => void setStatus(l, 'active')}>
            <Play className="h-4 w-4" /> Activate Offer
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={ITEM_CLS} onClick={() => window.open(publicPath(l), '_blank')}>
          <ExternalLink className="h-4 w-4" /> View Public Offer
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM_CLS} onClick={() => copyUrl(l)}>
          <Link2 className="h-4 w-4" /> Copy Public URL
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={cn(ITEM_CLS, 'text-red-400 focus:text-red-300')}
          onClick={() => setArchiveTarget(l)}
        >
          <Archive className="h-4 w-4" /> Archive Offer
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(ITEM_CLS, 'text-red-400 focus:text-red-300')}
          onClick={() => setDeleteTarget(l)}
        >
          <Trash2 className="h-4 w-4" /> Delete Offer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    // Navbar clearance comes from the account layout (pt-14 — V21/P7.ak);
    // this wrapper only adds internal rhythm.
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-2 sm:px-6 lg:px-10 xl:px-14">
      {isRestricted && (
        <div className="mb-6">
          <RestrictionBanner status={sellerStatus} />
        </div>
      )}

      {/* ── Header — standard account title block (V21/P7.al). ── */}
      <AccountPageHeader
        icon="offers"
        title={OFFER_META[type].title}
        actions={
          <Link
            href="/sell/new"
            className="flex h-10 items-center gap-2 rounded-md bg-lime px-4 text-[13.5px] font-bold text-text-inverse shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-colors hover:bg-lime-hover"
          >
            <Plus className="h-4 w-4" strokeWidth={2.75} />
            Add New Offer
          </Link>
        }
      />

      {/* ── Filter row ── */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {/* Below sm the three triggers share one row (grid); at sm+ the
            wrapper dissolves (contents) into the original flex-wrap row. */}
        <div className="grid w-full grid-cols-3 gap-2.5 sm:contents">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FilterTrigger
              active={gameId !== 'all'}
              clearable={gameId !== 'all'}
              onClear={() => setGameId('all')}
              className="min-w-0 px-3 sm:min-w-[132px] sm:px-4"
            >
              {gameName ? (
                <>
                  {gameName.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={gameName.image} alt="" className="h-[18px] w-[18px] rounded object-cover" />
                  ) : null}
                  {gameName.name}
                </>
              ) : (
                'Game'
              )}
            </FilterTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={cn('w-60', MENU_CLS)}>
            <DropdownMenuItem onClick={() => setGameId('all')} className={ITEM_CLS}>
              <LayoutGrid className="h-5 w-5 p-[3px] text-text-tertiary" />
              <span className="flex-1 truncate">All Games</span>
              {gameId === 'all' && <Check className="h-4 w-4 text-lime-text" />}
            </DropdownMenuItem>
            {games.map((g) => (
              <DropdownMenuItem key={g.id} onClick={() => setGameId(g.id)} className={ITEM_CLS}>
                {g.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={g.image} alt="" className="h-5 w-5 rounded object-cover ring-1 ring-white/10" />
                ) : (
                  <span className="h-5 w-5" />
                )}
                <span className="flex-1 truncate">{g.name}</span>
                {gameId === g.id && <Check className="h-4 w-4 text-lime-text" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FilterTrigger active={statusFilter !== 'all'} className="min-w-0 px-3 sm:min-w-[132px] sm:px-4">
              {statusFilter === 'all' ? 'Status' : FILTER_STATUSES.find((s) => s.value === statusFilter)?.label}
            </FilterTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={cn('w-52', MENU_CLS)}>
            {FILTER_STATUSES.map((s) => (
              <DropdownMenuItem key={s.value} onClick={() => setStatusFilter(s.value)} className={ITEM_CLS}>
                <span className="flex-1">{s.label}</span>
                {statusFilter === s.value && <Check className="h-4 w-4 text-lime-text" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <FilterTrigger
              disabled={selected.size === 0}
              active={selected.size > 0}
              className="min-w-0 px-3 sm:min-w-[132px] sm:px-4"
            >
              <span className="sm:hidden">Bulk</span>
              <span className="hidden sm:inline">Bulk Actions</span>
              {selected.size > 0 && (
                <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[12px] font-bold tabular-nums text-text-primary">
                  {selected.size}
                </span>
              )}
            </FilterTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={cn('w-60', MENU_CLS)}>
            <DropdownMenuLabel className={LABEL_CLS}>{selected.size} Selected</DropdownMenuLabel>
            <DropdownMenuItem className={ITEM_CLS} onClick={() => void bulkStatus('active')}>
              <Play className="h-4 w-4" /> Activate
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM_CLS} onClick={() => void bulkStatus('paused')}>
              <Pause className="h-4 w-4" /> Pause
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM_CLS} onClick={() => setBulkDeliveryOpen(true)}>
              <Clock className="h-4 w-4" /> Change Delivery Time
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={cn(ITEM_CLS, 'text-red-400 focus:text-red-300')}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>

        <div className="relative min-w-0 flex-1 sm:min-w-[220px] sm:max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search offers…"
            className="h-[42px] w-full rounded-md border-2 border-border-default bg-[rgba(20,20,27,0.56)] pl-9 pr-3 text-[13px] font-medium text-text-primary backdrop-blur-md transition-colors placeholder:text-text-tertiary focus:border-border-strong focus:outline-none focus-visible:shadow-none"
          />
        </div>

        <div className="sm:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-[42px] items-center gap-1.5 whitespace-nowrap px-1 text-[13.5px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {SORTS.find((s) => s.value === sort)?.label}
                <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={cn('w-52', MENU_CLS)}>
              {SORTS.map((s) => (
                <DropdownMenuItem key={s.value} onClick={() => setSort(s.value)} className={ITEM_CLS}>
                  <span className="flex-1">{s.label}</span>
                  {sort === s.value && <Check className="h-4 w-4 text-lime-text" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Results card ── */}
      <div className="relative mt-4 overflow-hidden rounded-lg border border-border-default bg-[rgba(20,20,27,0.56)] shadow-elevated backdrop-blur-md">
        {/* Top sheen — the bundle-card light-from-above, on the card itself. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent)]" />

        {/* md+ keeps the full table; below md the stacked card list renders instead. */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1160px] border-collapse text-left">
            <thead>
              <tr className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#6d7488]">
                <th className="w-12 py-3 pl-5 pr-2">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all offers" />
                </th>
                <th className="min-w-[220px] px-3 py-3">Offer</th>
                <th className="px-3 py-3 whitespace-nowrap">Delivery Time</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Stock</th>
                <th className="px-3 py-3 whitespace-nowrap">Min Quantity</th>
                <th className="px-3 py-3 whitespace-nowrap">Delivery Method</th>
                <th className="px-3 py-3 whitespace-nowrap">Offer ID</th>
                <th className="px-3 py-3 whitespace-nowrap">Updated</th>
                <th className="sticky right-0 z-10 w-24 bg-[linear-gradient(to_right,rgba(16,17,23,0)_0%,rgba(16,17,23,0.92)_42%,rgba(16,17,23,0.99)_68%)] py-3 pl-10 pr-5" />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`s${i}`} className="border-t border-white/[0.06]">
                    <td colSpan={11} className="px-5 py-3">
                      <div className="h-10 animate-pulse rounded-md bg-white/[0.04]" />
                    </td>
                  </tr>
                ))}

              {!isLoading && error != null && (
                <tr className="border-t border-white/[0.06]">
                  <td colSpan={11} className="px-5 py-10 text-center text-[13px] text-red-300">
                    Couldn’t load your offers. Refresh to try again.
                  </td>
                </tr>
              )}

              {!isLoading && !error && paged.map((l) => {
                const chip = chipKeyFor(l.status, storePaused)
                const logo = (type === 'items' || type === 'accounts' ? l.images?.[0] : null) || l.game?.image_url
                return (
                  <tr
                    key={l.id}
                    className={cn(
                      'border-t border-white/[0.06] transition-colors',
                      selected.has(l.id) && 'bg-white/[0.03]',
                    )}
                  >
                    <td className="py-4 pl-5 pr-2">
                      <Checkbox
                        checked={selected.has(l.id)}
                        onCheckedChange={() => toggleOne(l.id)}
                        aria-label={`Select ${l.title}`}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <span className="flex items-center gap-3">
                        {logo ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={logo} alt="" className="h-10 w-10 flex-none rounded-md object-cover ring-1 ring-white/10" />
                        ) : (
                          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-white/[0.05] ring-1 ring-white/10">
                            <Package className="h-4 w-4 text-text-tertiary" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block max-w-[240px] truncate text-[13.5px] font-bold text-text-primary">
                            {displayTitle(l, type)}
                          </span>
                          <span className="mt-0.5 block text-[12px] text-text-tertiary">{l.game?.name ?? '—'}</span>
                          {/* What the review team asked to change — shown ONLY
                              while the offer is in Changes Requested (the same
                              column is internal notes after approval). Tap/click
                              opens the full note (hover-only title doesn't work
                              on touch). */}
                          {l.status === 'changes_requested' && l.moderation_notes && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="mt-1 block max-w-[240px] truncate text-left text-[12px] font-medium text-amber-300 underline decoration-amber-300/40 decoration-dotted underline-offset-2"
                                >
                                  Requested: {l.moderation_notes}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="text-amber-200">
                                {l.moderation_notes}
                              </PopoverContent>
                            </Popover>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-[13px] text-text-secondary">
                      {formatDeliveryLabel(l.delivery_time)}
                    </td>
                    <td className="px-3 py-4">
                      <PriceField value={l.price} unit="Unit" onSave={(next) => savePrice(l, next)} />
                    </td>
                    <td className="px-3 py-4"><StatusChip k={chip} /></td>
                    <td className="px-3 py-4 text-[13.5px] font-bold tabular-nums text-text-primary">
                      {l.is_unlimited ? '∞' : fmtCompact(l.quantity ?? 0)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-[13px] tabular-nums text-text-secondary">
                      {(l.min_quantity ?? 1).toLocaleString()} Unit
                    </td>
                    <td className="px-3 py-4">
                      <span className="whitespace-nowrap rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-[3px] text-[12px] font-semibold text-text-secondary">
                        {methodLabel(l.delivery_method)}
                      </span>
                    </td>
                    <td className="px-3 py-4"><OfferIdChip listing={l} /></td>
                    <td className="whitespace-nowrap px-3 py-4 text-[12.5px] text-text-tertiary">
                      {fmtRelative(l.updated_at)}
                    </td>
                    <td className="sticky right-0 z-10 bg-[linear-gradient(to_right,rgba(16,17,23,0)_0%,rgba(16,17,23,0.92)_42%,rgba(16,17,23,0.99)_68%)] py-4 pl-10 pr-5">
                      {renderActionsMenu(
                        l,
                        'flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-text-tertiary transition-colors hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-text-primary',
                      )}
                    </td>
                  </tr>
                )
              })}

              {!isLoading && !error && paged.length === 0 && (
                <tr className="border-t border-white/[0.06]">
                  <td colSpan={11} className="px-5 py-12 text-center">
                    <p className="text-[13.5px] font-semibold text-text-secondary">
                      {typed.length === 0 ? `No ${OFFER_META[type].title.toLowerCase()} yet.` : 'No offers match these filters.'}
                    </p>
                    {typed.length === 0 && (
                      <Link
                        href="/sell/new"
                        className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-lime px-3.5 text-[13px] font-bold text-text-inverse transition-colors hover:bg-lime-hover"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.75} />
                        Add New Offer
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Card list (below md) — same rows, data and actions as the
            table, stacked so nothing hides off-screen on phones. ── */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-1">
            <label className="-ml-2 flex min-h-11 cursor-pointer items-center gap-2.5 px-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#6d7488]">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all offers" />
              Select All
            </label>
            <span className="text-[12px] font-semibold text-text-tertiary">
              {visible.length} {visible.length === 1 ? 'Offer' : 'Offers'}
            </span>
          </div>

          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`cs${i}`} className="border-t border-white/[0.06] px-4 py-3">
                <div className="h-28 animate-pulse rounded-md bg-white/[0.04]" />
              </div>
            ))}

          {!isLoading && error != null && (
            <p className="border-t border-white/[0.06] px-4 py-10 text-center text-[13px] text-red-300">
              Couldn’t load your offers. Refresh to try again.
            </p>
          )}

          {!isLoading && !error && paged.map((l) => {
            const chip = chipKeyFor(l.status, storePaused)
            const logo = (type === 'items' || type === 'accounts' ? l.images?.[0] : null) || l.game?.image_url
            return (
              <div
                key={l.id}
                className={cn('border-t border-white/[0.06] px-4 py-4', selected.has(l.id) && 'bg-white/[0.03]')}
              >
                {/* Identity row: checkbox (44px hit area) · logo · title/game · status */}
                <div className="flex items-start gap-2">
                  <label className="-ml-3 flex h-11 w-11 flex-none cursor-pointer items-center justify-center">
                    <Checkbox
                      checked={selected.has(l.id)}
                      onCheckedChange={() => toggleOne(l.id)}
                      aria-label={`Select ${l.title}`}
                    />
                  </label>
                  {logo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logo} alt="" className="h-10 w-10 flex-none rounded-md object-cover ring-1 ring-white/10" />
                  ) : (
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-white/[0.05] ring-1 ring-white/10">
                      <Package className="h-4 w-4 text-text-tertiary" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 pl-1">
                    <span className="block truncate text-[13.5px] font-bold text-text-primary">
                      {displayTitle(l, type)}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-text-tertiary">{l.game?.name ?? '—'}</span>
                  </span>
                  <StatusChip k={chip} />
                </div>

                {/* Moderation ask — wraps fully on cards (no hover needed). */}
                {l.status === 'changes_requested' && l.moderation_notes && (
                  <p className="mt-3 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[12px] font-medium leading-snug text-amber-300">
                    Requested: {l.moderation_notes}
                  </p>
                )}

                {/* Primary controls: inline price editor + 44px actions kebab. */}
                <div className="mt-3 flex items-center gap-2">
                  <PriceField
                    value={l.price}
                    unit="Unit"
                    onSave={(next) => savePrice(l, next)}
                    className="w-auto min-w-0 flex-1"
                  />
                  {renderActionsMenu(
                    l,
                    'flex h-11 w-11 flex-none items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-text-tertiary transition-colors hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-text-primary',
                  )}
                </div>

                {/* Compact meta. */}
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
                  <OfferIdChip listing={l} />
                  <span className="whitespace-nowrap rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-[3px] text-[12px] font-semibold text-text-secondary">
                    {methodLabel(l.delivery_method)}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-tertiary">
                  <span className="whitespace-nowrap">
                    Stock{' '}
                    <span className="font-bold tabular-nums text-text-primary">
                      {l.is_unlimited ? '∞' : fmtCompact(l.quantity ?? 0)}
                    </span>
                  </span>
                  <span className="whitespace-nowrap">
                    Min{' '}
                    <span className="tabular-nums text-text-secondary">
                      {(l.min_quantity ?? 1).toLocaleString()} Unit
                    </span>
                  </span>
                  <span className="whitespace-nowrap">
                    Delivery <span className="text-text-secondary">{formatDeliveryLabel(l.delivery_time)}</span>
                  </span>
                  <span className="whitespace-nowrap">Updated {fmtRelative(l.updated_at)}</span>
                </div>
              </div>
            )
          })}

          {!isLoading && !error && paged.length === 0 && (
            <div className="border-t border-white/[0.06] px-4 py-12 text-center">
              <p className="text-[13.5px] font-semibold text-text-secondary">
                {typed.length === 0 ? `No ${OFFER_META[type].title.toLowerCase()} yet.` : 'No offers match these filters.'}
              </p>
              {typed.length === 0 && (
                <Link
                  href="/sell/new"
                  className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-lime px-4 text-[13px] font-bold text-text-inverse transition-colors hover:bg-lime-hover"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.75} />
                  Add New Offer
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── Pagination footer ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center gap-5 text-[12.5px] text-text-tertiary">
            <span>
              Showing <span className="font-semibold text-text-secondary">{rangeStart}–{rangeEnd}</span> of{' '}
              <span className="font-semibold text-text-secondary">{visible.length}</span>
            </span>
            <span className="flex items-center gap-2">
              Per page:
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#12151e] px-2.5 text-[12.5px] font-semibold text-text-secondary transition-colors max-md:h-10 hover:border-white/[0.16] hover:text-text-primary"
                  >
                    {perPage} <ChevronDown className="h-3 w-3 text-text-tertiary" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn('w-24', MENU_CLS)}>
                  {[15, 25, 50].map((n) => (
                    <DropdownMenuItem key={n} onClick={() => setPerPage(n)} className={ITEM_CLS}>
                      <span className="flex-1">{n}</span>
                      {perPage === n && <Check className="h-4 w-4 text-lime-text" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <PagerButton disabled={safePage <= 1} onClick={() => setPage(1)}><ChevronsLeft className="h-4 w-4" /></PagerButton>
            <PagerButton disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-4 w-4" /></PagerButton>
            <span className="flex h-9 min-w-9 items-center justify-center rounded-md bg-white/[0.08] px-2 text-[12.5px] font-bold tabular-nums text-text-primary max-md:h-10 max-md:min-w-10">
              {safePage}
            </span>
            <PagerButton disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}><ChevronRight className="h-4 w-4" /></PagerButton>
            <PagerButton disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}><ChevronsRight className="h-4 w-4" /></PagerButton>
          </div>
        </div>
      </div>

      {/* ── Archive confirm ── */}
      <Dialog open={archiveTarget != null} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>Archive This Offer?</DialogTitle>
            <DialogDescription>
              “{archiveTarget?.title}” will be delisted and moved to Closed. You can re-activate it later
              from the Closed filter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void archive()}
              disabled={busy}
              className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 focus-visible:ring-0 focus-visible:ring-offset-0"
              variant="outline"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Archive Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm (single offer) ── */}
      <Dialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>Delete This Offer?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.title}” will be permanently removed. This can’t be undone — archive it
              instead if you might relist later. Offers with order history can’t be deleted and will
              be archived automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void removeOne()}
              disabled={busy}
              className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 focus-visible:ring-0 focus-visible:ring-offset-0"
              variant="outline"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk delete confirm ── */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>Delete {selected.size} {selected.size === 1 ? 'Offer' : 'Offers'}?</DialogTitle>
            <DialogDescription>
              This permanently removes the selected offers. This can’t be undone — pause or archive them
              instead if you might relist.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void bulkRemove()}
              disabled={busy}
              className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 focus-visible:ring-0 focus-visible:ring-offset-0"
              variant="outline"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Offers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk delivery time ── */}
      <Dialog open={bulkDeliveryOpen} onOpenChange={setBulkDeliveryOpen}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>Change Delivery Time</DialogTitle>
            <DialogDescription>
              Applies to {selected.size} selected {selected.size === 1 ? 'offer' : 'offers'}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {DELIVERY_TIME_OPTIONS.map((v) => (
              <button
                key={v}
                type="button"
                disabled={busy}
                onClick={() => void bulkDelivery(v)}
                className="flex h-10 items-center justify-center rounded-md border border-white/[0.08] bg-[#12151e] text-[13px] font-semibold text-text-secondary transition-colors hover:border-white/[0.16] hover:text-text-primary disabled:opacity-50"
              >
                {formatDeliveryLabel(v)}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PagerButton({
  children, disabled, onClick,
}: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] text-text-tertiary transition-colors max-md:h-10 max-md:w-10',
        disabled ? 'opacity-40' : 'hover:border-white/[0.16] hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}
