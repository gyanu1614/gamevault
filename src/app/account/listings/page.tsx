'use client'

/**
 * /account/listings — seller's listing inventory.
 *
 * V4 reskin: GV tokens, Radix primitives, NumberField for prices, Combobox
 * for category/sort, DropdownMenu for row actions, Dialog for delete
 * confirmation, Checkbox for selection, Tabs for status filter. Mobile-
 * responsive layout: 2-card grid on mobile, 3-up on lg; full-width status
 * tabs scroll horizontally on narrow screens.
 *
 * Behavior preserved end-to-end from the previous file:
 *   - useSellerListings for data + mutations (update, delete, bulk*)
 *   - inline price edit per row with optimistic state
 *   - bulk activate / pause / delete / set-price
 *   - restriction banner when the seller is restricted
 *   - status counts per filter chip
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Trash2, Pause, Play, Eye, MoreVertical, X, Loader2,
  AlertCircle, Edit2, ShieldAlert, Check, Package,
  Share2, FileSpreadsheet, ListFilter, TrendingUp,
} from 'lucide-react'
// V14r — Tabler icons for the metric rail. Lucide's basic icons (Boxes,
// Truck) read as clip-art; Tabler's stroke-style set is more premium
// and consistent with how dashboards like Linear / Vercel render metrics.
import {
  IconEye,
  IconCoins,
  IconPackages,
  IconInfinity,
  IconRocket,
  IconBolt,
} from '@tabler/icons-react'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'

import { useAuth } from '@/hooks/use-auth'
import { useSellerListings } from '@/hooks/use-seller-listings'
import { ListingStatus } from '@/lib/api/seller-compatible'
import { canSellerPublish, type SellerStatus } from '@/lib/utils/seller-status'
import RestrictionBanner from '@/components/seller/RestrictionBanner'
import { SellerOnlyGate } from '@/components/seller/SellerOnlyGate'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { NumberField } from '@/components/ui/number-field'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ─── Game icon helpers (carry-over) ──────────────────────────────────────────

const GAME_ICON_MAP: Record<string, string> = {
  'steal-a-brainrot': 'sab',
  'grow-a-garden': 'gag',
  'apex-legends': 'apexlegends',
  'escape-from-tarkov': 'escapefromtarkov',
  'r6-siege': 'r6',
  'league-of-legends': 'lol',
  'gta-v': 'gta-v',
}
function gameIconUrl(slug: string): string {
  return `/games/${GAME_ICON_MAP[slug] ?? slug}.png`
}
function GameIcon({ slug, emoji, size = 'sm' }: { slug: string; emoji: string; size?: 'xs' | 'sm' }) {
  const [failed, setFailed] = useState(false)
  const cls = size === 'xs' ? 'h-4 w-4 text-xs' : 'h-5 w-5 text-sm'
  if (!slug || failed) {
    return <span className={cn('inline-flex shrink-0 items-center justify-center leading-none', cls)}>{emoji || '🎮'}</span>
  }
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={gameIconUrl(slug)} alt="" className={cn(cls, 'shrink-0 rounded object-cover')} onError={() => setFailed(true)} />
}

// ─── Constants ───────────────────────────────────────────────────────────────

type SortBy = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'views' | 'sales'
type FilterStatus = 'all' | 'active' | 'paused' | 'sold' | 'draft' | 'archived' | 'suspended' | 'pending_approval'

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
  { value: 'views', label: 'Most viewed' },
  { value: 'sales', label: 'Best selling' },
]

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  { value: 'currency', label: 'Currency' },
  { value: 'items', label: 'Items' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'top-up', label: 'Top Up' },
  { value: 'boosting', label: 'Boosting' },
]

const STATUS_TABS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending_approval', label: 'Under review' },
  { value: 'paused', label: 'Paused' },
  { value: 'sold', label: 'Sold' },
  { value: 'draft', label: 'Drafts' },
]

// ─── Status badge ────────────────────────────────────────────────────────────

// V14q — Listing-row metric cell. Same shape as the currency-page seller
// row's MetricCol: small icon + bold value on top, caption beneath.
// Fixed width per column so every row's columns align vertically.
// V14t — Caption bumped from 10px / tracking-wider to 11.5px / tracking-[0.06em]
// per design call: was too thin to read. Still Inter (app default font).
function MetricCell({
  icon: Icon, label, value, valueClass, width = 84,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  valueClass?: string
  width?: number
}) {
  return (
    <div className="shrink-0" style={{ width }}>
      <div className={cn(
        'flex items-center gap-1.5 text-[15px] font-semibold tabular-nums leading-tight text-text-primary',
        valueClass,
      )}>
        <Icon className="h-4 w-4 shrink-0 text-text-tertiary" />
        <span className="truncate">{value}</span>
      </div>
      <div className="mt-1 text-[11.5px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
        {label}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; text: string; bg: string; border: string; label: string }> = {
    active:           { dot: 'bg-success', text: 'text-success', bg: 'bg-success-bg', border: 'border-success/30', label: 'Active' },
    paused:           { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning-bg', border: 'border-warning/30', label: 'Paused' },
    sold:             { dot: 'bg-text-tertiary', text: 'text-text-tertiary', bg: 'bg-bg-inset', border: 'border-border-subtle', label: 'Sold out' },
    draft:            { dot: 'bg-info', text: 'text-info', bg: 'bg-info-bg', border: 'border-info/30', label: 'Draft' },
    pending_approval: { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning-bg', border: 'border-warning/30', label: 'Under review' },
    suspended:        { dot: 'bg-error', text: 'text-error', bg: 'bg-error-bg', border: 'border-error/30', label: 'Suspended' },
    archived:         { dot: 'bg-text-disabled', text: 'text-text-tertiary', bg: 'bg-bg-inset', border: 'border-border-subtle', label: 'Archived' },
  }
  const c = cfg[status] ?? cfg.draft
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', c.bg, c.border, c.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

// V17e — Default export wraps the page in SellerOnlyGate. Buyers and
// anonymous visitors get redirected; only approved sellers ever render
// the listings UI below.
export default function ListingsPage() {
  return (
    <SellerOnlyGate>
      <ListingsContent />
    </SellerOnlyGate>
  )
}

function ListingsContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortBy>('newest')

  // Selection + bulk
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set())
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false)
  const [bulkPrice, setBulkPrice] = useState<number>(0)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // Per-row inline edits
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({})
  const [updatingListings, setUpdatingListings] = useState<Set<string>>(new Set())
  const [deletingListings, setDeletingListings] = useState<Set<string>>(new Set())
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  const {
    listings: dbListings,
    isLoading: listingsLoading,
    updateListing,
    deleteListing,
    bulkUpdate,
    bulkDelete,
    isUpdating,
    isDeleting,
  } = useSellerListings({
    search: searchQuery,
    status: selectedStatus !== 'all' ? (selectedStatus as ListingStatus) : undefined,
  })

  const listings = useMemo(() => {
    return dbListings.map((l) => ({
      id: l.id,
      title: l.title,
      game: { name: l.game?.name || 'Unknown', slug: l.game?.slug || '', emoji: l.game?.emoji || '🎮' },
      category: l.category?.name || 'Uncategorized',
      categorySlug: l.category?.slug || '',
      slug: l.id,
      price: l.price,
      originalPrice: undefined as number | undefined,
      quantity: l.quantity,
      isUnlimited: !!l.is_unlimited,
      status: l.status,
      views: l.views,
      sales: l.sales,
      delivery_method: l.delivery_method || 'manual',
      delivery_time: l.delivery_time || '1-24 hours',
      image:
        l.images?.length
          ? l.images[0]
          : `https://placehold.co/400x300/6366f1/fff?text=${encodeURIComponent(l.title.slice(0, 20))}`,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    }))
  }, [dbListings])

  const filteredListings = useMemo(() => {
    let result = [...listings]
    if (selectedCategory !== 'all') {
      result = result.filter(
        (l) => l.categorySlug?.toLowerCase() === selectedCategory || l.category?.toLowerCase() === selectedCategory,
      )
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':     return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':     return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'price-low':  return a.price - b.price
        case 'price-high': return b.price - a.price
        case 'views':      return b.views - a.views
        case 'sales':      return b.sales - a.sales
      }
    })
    return result
  }, [listings, sortBy, selectedCategory])

  const statusCounts = useMemo(() => ({
    all:              listings.length,
    active:           listings.filter((l) => l.status === 'active').length,
    paused:           listings.filter((l) => l.status === 'paused').length,
    sold:             listings.filter((l) => l.status === 'sold').length,
    draft:            listings.filter((l) => l.status === 'draft').length,
    pending_approval: listings.filter((l) => (l.status as any) === 'pending_approval').length,
  }), [listings])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const sellerStatus = ((user?.profile as any)?.seller_status as SellerStatus) || 'active'
  const isRestricted = !canSellerPublish(sellerStatus)

  const toggleSelectOne = (id: string) => {
    setSelectedListings((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    setSelectedListings((prev) =>
      prev.size === filteredListings.length ? new Set() : new Set(filteredListings.map((l) => l.id)),
    )
  }
  const clearSelection = () => setSelectedListings(new Set())

  const onBulkActivate = async () => {
    if (isRestricted) { toast.error('Your account is restricted.'); return }
    await bulkUpdate({ ids: Array.from(selectedListings), updates: { status: 'active' } })
    clearSelection()
  }
  const onBulkPause = async () => {
    await bulkUpdate({ ids: Array.from(selectedListings), updates: { status: 'paused' } })
    clearSelection()
  }
  const onBulkDelete = async () => {
    await bulkDelete(Array.from(selectedListings))
    setBulkDeleteOpen(false)
    clearSelection()
  }
  const onBulkPriceApply = async () => {
    if (!bulkPrice || bulkPrice <= 0) { toast.error('Enter a valid price'); return }
    await bulkUpdate({ ids: Array.from(selectedListings), updates: { price: bulkPrice } })
    setBulkPriceOpen(false)
    setBulkPrice(0)
    clearSelection()
  }

  const onUpdatePrice = async (id: string) => {
    const v = editingPrices[id]
    if (!v || v <= 0) { toast.error('Price must be greater than 0'); return }
    setUpdatingListings((s) => new Set(s).add(id))
    try {
      await updateListing({ id, updates: { price: v }, silent: true })
      toast.success('Price updated')
      setEditingPrices((p) => { const n = { ...p }; delete n[id]; return n })
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update price')
    } finally {
      setUpdatingListings((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  const onToggleStatus = async (id: string, current: string) => {
    const next = current === 'active' ? 'paused' : 'active'
    if (next === 'active' && isRestricted) { toast.error('Your account is restricted.'); return }
    setUpdatingListings((s) => new Set(s).add(id))
    try {
      await updateListing({ id, updates: { status: next } })
      toast.success(`Listing ${next === 'active' ? 'activated' : 'paused'}`)
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update status')
    } finally {
      setUpdatingListings((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  const onConfirmDelete = async () => {
    if (!confirmingDeleteId) return
    setDeletingListings((s) => new Set(s).add(confirmingDeleteId))
    try {
      await deleteListing({ id: confirmingDeleteId, silent: true })
      toast.success('Listing deleted')
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete listing')
    } finally {
      setDeletingListings((s) => { const n = new Set(s); n.delete(confirmingDeleteId); return n })
      setConfirmingDeleteId(null)
    }
  }

  const onCopyLink = (l: { id: string; game: { slug: string }; categorySlug: string; slug: string }) => {
    // V17g — Currency listings live on the category page itself
    // (e.g. /roblox/buy-robux) — no per-listing URL exists for them.
    // For all other categories (accounts/items/etc.) copy the canonical
    // /{game}/{category}/{listing-slug} URL. The categorySlug we get is
    // already canonical because the DB stores it that way.
    const isCurrency = l.categorySlug?.startsWith('buy-') &&
      // Treat any of the per-game currency slugs as "no detail page".
      ['buy-robux','buy-vbucks','buy-vp','buy-gta-money','buy-minecoins','buy-rp','buy-coins','buy-roubles','buy-credits','buy-sheckles','buy-cash'].includes(l.categorySlug)
    const url = isCurrency
      ? `${window.location.origin}/${l.game.slug || 'game'}/${l.categorySlug}`
      : `${window.location.origin}/${l.game.slug || 'game'}/${l.categorySlug || 'category'}/${l.slug || l.id}`
    navigator.clipboard.writeText(url)
    toast.success('Link copied')
  }

  // ── Loading / auth ────────────────────────────────────────────────────────

  if (authLoading || listingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-lime-text" />
          <p className="text-sm text-text-tertiary">Loading listings…</p>
        </div>
      </div>
    )
  }

  const allSelected = selectedListings.size > 0 && selectedListings.size === filteredListings.length
  const someSelected = selectedListings.size > 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-base pb-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {isRestricted && (
          <RestrictionBanner
            status={sellerStatus}
            reason={(user?.profile as any)?.seller_restriction_reason}
            dismissible={false}
          />
        )}

        {/* Header */}
        <header className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end sm:justify-between sm:pt-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">My listings</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Manage your offers, prices, and stock.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/sell/bulk">
              <Button variant="outline" className="h-10 gap-1.5 rounded-md border-border-default bg-bg-raised text-text-primary hover:bg-bg-raised-hover hover:border-lime-tint-border">
                <FileSpreadsheet className="h-4 w-4" />
                Bulk upload
              </Button>
            </Link>
            {isRestricted ? (
              <Link href="/account/restrictions">
                <Button variant="outline" className="h-10 gap-1.5 rounded-md border-warning/40 bg-warning-bg text-warning hover:bg-warning-bg">
                  <ShieldAlert className="h-4 w-4" />
                  Selling restricted
                </Button>
              </Link>
            ) : (
              <Link href="/sell/new">
                <Button className="h-10 gap-1.5 rounded-md bg-lime text-text-inverse font-semibold shadow-elevated hover:bg-lime-hover hover:shadow-glow">
                  <Plus className="h-4 w-4" />
                  Create listing
                </Button>
              </Link>
            )}
          </div>
        </header>

        {/* Status tabs */}
        <Tabs
          value={selectedStatus}
          onValueChange={(v) => setSelectedStatus(v as FilterStatus)}
          className="mt-5"
        >
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList variant="underline" className="min-w-max">
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                  {t.label}
                  <span className="rounded-full bg-bg-inset px-1.5 text-[10px] font-semibold text-text-tertiary data-[state=active]:bg-lime-tint-bg data-[state=active]:text-lime-text">
                    {statusCounts[t.value as keyof typeof statusCounts] ?? 0}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {/* Filter row */}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search */}
          <div className="relative flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search your listings…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-md border border-border-default bg-bg-raised pl-9 pr-9 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary hover:bg-bg-raised-hover hover:text-text-primary"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category */}
          <div className="lg:w-52">
            <Combobox
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={CATEGORY_OPTIONS}
              ariaLabel="Filter by category"
              unsorted
            />
          </div>

          {/* Sort */}
          <div className="lg:w-52">
            <Combobox
              value={sortBy}
              onChange={(v) => setSortBy(v as SortBy)}
              options={SORT_OPTIONS}
              ariaLabel="Sort"
              unsorted
            />
          </div>
        </div>

        {/* Bulk action bar — appears when items selected */}
        <AnimatePresence>
          {someSelected && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-lime-tint-border bg-lime-tint-bg px-3 py-2"
            >
              <span className="text-xs font-semibold text-lime-text">
                {selectedListings.size} selected
              </span>
              <span className="hidden h-3 w-px bg-border-default sm:block" />
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkActivate}
                disabled={isUpdating}
                className="h-8 gap-1.5 rounded-md border-border-default bg-bg-raised text-text-primary hover:bg-bg-raised-hover"
              >
                {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkPause}
                disabled={isUpdating}
                className="h-8 gap-1.5 rounded-md border-border-default bg-bg-raised text-text-primary hover:bg-bg-raised-hover"
              >
                {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                Pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkPriceOpen(true)}
                disabled={isUpdating}
                className="h-8 gap-1.5 rounded-md border-border-default bg-bg-raised text-text-primary hover:bg-bg-raised-hover"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Set price
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={isDeleting}
                className="h-8 gap-1.5 rounded-md border-error/40 bg-error-bg text-error hover:bg-error-bg hover:border-error"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                className="ml-auto h-8 gap-1.5 text-text-tertiary hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Select-all row */}
        {filteredListings.length > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-text-tertiary">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all"
            />
            <span>
              {allSelected
                ? `All ${filteredListings.length} selected`
                : `${filteredListings.length} listing${filteredListings.length === 1 ? '' : 's'}`}
            </span>
          </div>
        )}

        {/* Listings */}
        {filteredListings.length === 0 ? (
          <EmptyState searchQuery={searchQuery} isRestricted={isRestricted} />
        ) : (
          <div className="mt-3 space-y-2">
            {filteredListings.map((l, i) => (
              <ListingRow
                key={l.id}
                listing={l}
                index={i}
                selected={selectedListings.has(l.id)}
                onToggleSelect={() => toggleSelectOne(l.id)}
                editingPrice={editingPrices[l.id]}
                onPriceChange={(v) => setEditingPrices((p) => ({ ...p, [l.id]: v }))}
                onSavePrice={() => onUpdatePrice(l.id)}
                onCancelPrice={() =>
                  setEditingPrices((p) => { const n = { ...p }; delete n[l.id]; return n })
                }
                onToggleStatus={() => onToggleStatus(l.id, l.status)}
                onRequestDelete={() => setConfirmingDeleteId(l.id)}
                onCopyLink={() => onCopyLink(l)}
                onView={() => router.push(`/listings/${l.id}`)}
                onEdit={() => router.push(`/account/listings/${l.id}/edit`)}
                isUpdating={updatingListings.has(l.id)}
                isDeleting={deletingListings.has(l.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}

      {/* Delete single listing */}
      <Dialog open={!!confirmingDeleteId} onOpenChange={(o) => !o && setConfirmingDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this listing?</DialogTitle>
            <DialogDescription>
              This can't be undone. Buyers will no longer see the listing in the marketplace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmingDeleteId(null)}
              className="text-text-secondary hover:text-text-primary"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirmDelete}
              disabled={deletingListings.has(confirmingDeleteId ?? '')}
              className="bg-error text-text-primary hover:bg-error/90"
            >
              {deletingListings.has(confirmingDeleteId ?? '') ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete listing'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedListings.size} listing{selectedListings.size === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              This can't be undone. The listings will be removed from the marketplace immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button onClick={onBulkDelete} disabled={isDeleting} className="bg-error text-text-primary hover:bg-error/90">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Delete ${selectedListings.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk set price */}
      <Dialog open={bulkPriceOpen} onOpenChange={(o) => { setBulkPriceOpen(o); if (!o) setBulkPrice(0) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set a new price for {selectedListings.size} listing{selectedListings.size === 1 ? '' : 's'}</DialogTitle>
            <DialogDescription>
              All selected listings will be updated to this price.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              New price (USD)
            </label>
            <NumberField
              value={bulkPrice}
              onChange={(v) => setBulkPrice(v ?? 0)}
              minValue={0.01}
              maxValue={99_999}
              step={0.01}
              ariaLabel="Bulk price"
              formatOptions={{ style: 'currency', currency: 'USD' }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkPriceOpen(false)}>Cancel</Button>
            <Button onClick={onBulkPriceApply} disabled={isUpdating || bulkPrice <= 0} className="bg-lime text-text-inverse hover:bg-lime-hover">
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : `Apply to ${selectedListings.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ searchQuery, isRestricted }: { searchQuery: string; isRestricted: boolean }) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-bg-overlay p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-default bg-bg-raised">
        <Package className="h-5 w-5 text-text-tertiary" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-text-primary">No listings found</h3>
        <p className="mt-1 text-sm text-text-secondary">
          {searchQuery ? 'Try adjusting your search or filters.' : 'Create your first listing to get started.'}
        </p>
      </div>
      {!searchQuery &&
        (isRestricted ? (
          <Button disabled variant="outline" className="gap-1.5 rounded-md">
            <Plus className="h-4 w-4" />
            Create listing
          </Button>
        ) : (
          <Link href="/sell/new">
            <Button className="gap-1.5 rounded-md bg-lime text-text-inverse hover:bg-lime-hover">
              <Plus className="h-4 w-4" />
              Create listing
            </Button>
          </Link>
        ))}
    </div>
  )
}

// ─── Single listing row ──────────────────────────────────────────────────────

interface ListingRowProps {
  listing: {
    id: string
    title: string
    game: { slug: string; emoji: string; name: string }
    category: string
    categorySlug: string
    slug: string
    price: number
    originalPrice?: number
    quantity: number
    /** V14q — Real is_unlimited flag from the DB. Replaces the bogus
     *  "quantity > 10k → unlimited" heuristic that was lying about the
     *  stock state on currency listings. */
    isUnlimited: boolean
    status: string
    views: number
    sales: number
    delivery_method: string
    delivery_time: string
    image: string
  }
  index: number
  selected: boolean
  onToggleSelect: () => void
  editingPrice: number | undefined
  onPriceChange: (v: number) => void
  onSavePrice: () => void
  onCancelPrice: () => void
  onToggleStatus: () => void
  onRequestDelete: () => void
  onCopyLink: () => void
  onView: () => void
  onEdit: () => void
  isUpdating: boolean
  isDeleting: boolean
}

function ListingRow(p: ListingRowProps) {
  const isEditing = p.editingPrice !== undefined
  const canToggleStatus = p.listing.status === 'active' || p.listing.status === 'paused'
  const isLowStock = p.listing.quantity > 0 && p.listing.quantity <= 5
  // V14q — Honour the actual is_unlimited flag from the DB. The previous
  // "quantity > 10k" heuristic mislabelled currency listings (e.g. 150k
  // Robux stock) as Unlimited even though they have a finite supply.
  const isUnlimited = p.listing.isUnlimited

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(p.index, 8) * 0.02 }}
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-bg-raised p-3 transition-colors sm:p-4',
        'sm:flex-row sm:items-center',
        p.selected
          ? 'border-lime-tint-border bg-lime-tint-bg/40'
          : 'border-border-subtle hover:border-border-default',
      )}
    >
      {/* Left — checkbox + image + content */}
      <div className="flex flex-1 items-center gap-3 sm:gap-4">
        <Checkbox
          checked={p.selected}
          onCheckedChange={p.onToggleSelect}
          aria-label={`Select ${p.listing.title}`}
        />

        {/* Listing image — bigger, with a subtle ring like StockX/Mercari */}
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.listing.image}
            alt=""
            className="h-16 w-16 rounded-xl border border-border-default object-cover shadow-sm sm:h-20 sm:w-20"
          />
          {/* Tiny game-icon overlay (Mercari / Goat pattern) */}
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border-default bg-bg-raised shadow-elevated">
            <GameIcon slug={p.listing.game.slug} emoji={p.listing.game.emoji} size="xs" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* Game + category chip row — proper sized, lime accent for the game */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Game chip: actual logo + name for accessibility + scanability */}
            <span
              className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-overlay py-0.5 pl-0.5 pr-2"
              aria-label={`Game: ${p.listing.game.name}`}
            >
              <GameIcon slug={p.listing.game.slug} emoji={p.listing.game.emoji} size="xs" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                {p.listing.game.name}
              </span>
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              {p.listing.category}
            </span>
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-text-primary sm:text-base">
            {p.listing.title}
          </h3>
          {/* V14q — Left side keeps only the status pill. Stock and
              delivery moved to the right metric rail so every listing's
              columns align in a clean vertical stack. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={p.listing.status} />
            {isLowStock && !isUnlimited && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-bg px-2 py-0.5 text-[10px] font-medium text-warning"
                title="Low stock — top up soon"
              >
                <AlertCircle className="h-2.5 w-2.5" />
                Low stock
              </span>
            )}
          </div>
        </div>
      </div>

      {/* V14q — Fixed-width metric columns mirror the currency-page seller
          row layout. Every column (Views · Sales · Stock · Delivery · Price ·
          Actions) gets a locked width and a small icon + uppercase caption
          so the row stays scannable at any density. */}
      <div className="flex items-center justify-end gap-5 sm:gap-6">
        {/* Views + Sales — lg+ only (saves space on smaller screens) */}
        <div className="hidden items-start gap-5 lg:flex">
          <MetricCell icon={IconEye} label="Views" value={p.listing.views.toLocaleString('en-US')} width={76} />
          <MetricCell icon={IconCoins} label="Sales" value={p.listing.sales.toLocaleString('en-US')} width={76} />
        </div>

        {/* Stock + Delivery — md+, key inventory info */}
        <div className="hidden items-start gap-5 md:flex">
          <MetricCell
            icon={isUnlimited ? IconInfinity : IconPackages}
            label="Stock"
            value={isUnlimited ? '∞' : p.listing.quantity.toLocaleString('en-US')}
            valueClass={isUnlimited ? 'text-success' : isLowStock ? 'text-warning' : undefined}
            width={108}
          />
          <MetricCell
            icon={p.listing.delivery_method === 'instant' ? IconBolt : IconRocket}
            label="Delivery"
            value={
              p.listing.delivery_method === 'instant'
                ? 'Instant'
                : formatDeliveryLabel(p.listing.delivery_time)
            }
            valueClass={p.listing.delivery_method === 'instant' ? 'text-info' : undefined}
            width={108}
          />
        </div>

        {/* Price column — locked width so all prices form a vertical rail. */}
        {(() => {
          const needsFractional = p.listing.price > 0 && p.listing.price < 1
          const decimals = needsFractional ? 4 : 2
          const step = needsFractional ? 0.0001 : 0.01
          const minValue = needsFractional ? 0.0001 : 0.01
          return (
            <div className="w-[140px] shrink-0 sm:w-[160px]">
              {isEditing ? (
                <div className="flex items-center gap-1.5">
                  <NumberField
                    value={p.editingPrice ?? 0}
                    onChange={(v) => p.onPriceChange(v ?? 0)}
                    minValue={minValue}
                    maxValue={99_999}
                    step={step}
                    ariaLabel="Edit price"
                    formatOptions={{
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: decimals,
                      maximumFractionDigits: decimals,
                    }}
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    onClick={p.onSavePrice}
                    disabled={p.isUpdating}
                    className="h-9 rounded-md bg-lime px-2.5 text-text-inverse hover:bg-lime-hover"
                    aria-label="Save price"
                  >
                    {p.isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={p.onCancelPrice}
                    disabled={p.isUpdating}
                    className="h-9 rounded-md px-2 text-text-tertiary hover:text-text-primary"
                    aria-label="Cancel price edit"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => p.onPriceChange(p.listing.price)}
                  // V14q — Full-width button so every price sits in the same
                  // horizontal slot. justify-between pins price left and
                  // pencil right; tabular-nums keeps digit columns aligned.
                  className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border-default bg-bg-overlay px-3 text-sm font-semibold tabular-nums text-text-primary transition-colors hover:border-lime-tint-border hover:text-lime-text"
                  title="Click to edit price"
                >
                  <span>${p.listing.price.toFixed(decimals)}</span>
                  <Edit2 className="h-3 w-3 shrink-0 text-text-tertiary" />
                </button>
              )}
            </div>
          )
        })()}

        {/* Actions cluster */}
        {/* V14q — Locked-width actions rail so the trailing dropdown sits
            in the same column whether or not the Pause/Play button renders.
            Empty slot keeps the dropdown's horizontal position stable. */}
        <div className="flex w-[84px] shrink-0 items-center justify-end gap-1">
          {canToggleStatus ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={p.onToggleStatus}
              disabled={p.isUpdating}
              className="h-9 w-9 rounded-md text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary"
              title={p.listing.status === 'active' ? 'Pause' : 'Resume'}
            >
              {p.isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : p.listing.status === 'active' ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          ) : (
            // Empty placeholder so the dropdown stays in the same column.
            <span aria-hidden className="h-9 w-9" />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-md text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary"
                aria-label="Open listing menu"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            {/* V14r — Trimmed to actions the seller actually uses on a
                listing row: View, Edit, Copy link, Delete. Duplicate and
                Analytics were aspirational stubs — Duplicate went to
                /sell/new?from=… which works but never gets used at this
                density, and Analytics pointed at a route we don't have a
                proper per-listing page for. Removed to keep the menu
                focused on real actions. */}
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={p.onView}>
                <Eye className="h-3.5 w-3.5" />
                View listing
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={p.onEdit}>
                <Edit2 className="h-3.5 w-3.5" />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={p.onCopyLink}>
                <Share2 className="h-3.5 w-3.5" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={p.onRequestDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete listing
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  )
}
