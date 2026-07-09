'use client'

/**
 * Offers-table design preview (mock data, real tokens/primitives).
 *
 * Proposed design for the seller offer pages (/account/listings?type=…):
 *   header (title + Add New Offer) → filter row (Game / Status / Bulk
 *   Actions / search / sort) → results card (table) → pagination.
 *
 * Interactions mocked here so they can be felt, not imagined:
 *   - inline price editor ($ prefix + /unit suffix inside the control;
 *     grey tick when clean, lime save when dirty)
 *   - offer-id copy chip
 *   - row selection + bulk-actions dropdown arming
 *   - functional game/status/search filtering (client-side, mock rows)
 *   - row ⋮ actions menu
 *
 * Design rules honored: rectangular geometry (rounded-lg card /
 * rounded-md inner), no green fill on selected controls (minimal
 * borders instead), grey hovers, Title Case labels, Inter only.
 */

import * as React from 'react'
import { useMemo, useState } from 'react'
import {
  Archive, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Clock, Copy, ExternalLink, Eye, LayoutGrid,
  Link2, MoreVertical, Pause, Pencil, Play, Plus, Search, Trash2, X,
} from 'lucide-react'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'
import { Checkbox } from '@/components/ui/checkbox'
import { PriceField } from '@/components/ui/price-field'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// ─── Mock data ───────────────────────────────────────────────────────────────

type OfferStatus = 'active' | 'paused' | 'draft' | 'closed' | 'suspended'

interface MockOffer {
  id: string
  num: number
  title: string
  game: string
  logo: string
  deliveryTime: string
  price: string
  unit: string
  stock: string
  minQty: string
  methods: string[]
  status: OfferStatus
  updated: string
}

const CURRENCY_ROWS: MockOffer[] = [
  { id: 'c1', num: 33404, title: 'Roblox Robux', game: 'Roblox', logo: '/games/roblox.png', deliveryTime: '30 Min', price: '0.0065', unit: 'R$', stock: '158K', minQty: '5,000 Unit', methods: ['In-Game', 'Gifting'], status: 'active', updated: 'yesterday' },
  { id: 'c2', num: 32373, title: 'Grow a Garden 2 Sheckles', game: 'Grow a Garden 2', logo: '/games/gag.png', deliveryTime: '20 Min', price: '0.0022', unit: 'M', stock: '99B', minQty: '100 Unit', methods: ['Manual'], status: 'active', updated: 'yesterday' },
  { id: 'c3', num: 32118, title: 'Valorant Points', game: 'Valorant', logo: '/games/valorant.png', deliveryTime: '1 Hour', price: '0.0089', unit: 'VP', stock: '240K', minQty: '1,000 Unit', methods: ['Manual'], status: 'paused', updated: '3 days ago' },
  { id: 'c4', num: 31992, title: 'Genshin Primogems', game: 'Genshin Impact', logo: '/games/genshin.png', deliveryTime: '45 Min', price: '0.0120', unit: 'Unit', stock: '60K', minQty: '500 Unit', methods: ['Manual'], status: 'draft', updated: '5 days ago' },
  { id: 'c5', num: 31746, title: 'Free Fire Diamonds', game: 'Free Fire', logo: '/games/freefire.png', deliveryTime: '30 Min', price: '0.0065', unit: 'Unit', stock: '82K', minQty: '2,000 Unit', methods: ['Instant'], status: 'closed', updated: '1 week ago' },
  { id: 'c6', num: 30554, title: 'PUBG UC', game: 'PUBG Mobile', logo: '/games/pubg.png', deliveryTime: '15 Min', price: '0.0150', unit: 'UC', stock: '12K', minQty: '100 Unit', methods: ['Instant'], status: 'suspended', updated: '2 weeks ago' },
]

const ITEM_ROWS: MockOffer[] = [
  { id: 'i1', num: 33390, title: 'Garama and Madundung — Clean Split', game: 'Steal a Brainrot', logo: '/games/sab.png', deliveryTime: '20 Min', price: '88.00', unit: 'Unit', stock: '1', minQty: '1 Unit', methods: ['Manual'], status: 'active', updated: 'yesterday' },
  { id: 'i2', num: 33102, title: 'Dragonfly — Neon Age 50', game: 'Grow a Garden 2', logo: '/games/gag.png', deliveryTime: '30 Min', price: '24.50', unit: 'Unit', stock: '3', minQty: '1 Unit', methods: ['Manual'], status: 'active', updated: '2 days ago' },
  { id: 'i3', num: 32871, title: 'AK-47 Redline (Field-Tested)', game: 'CS2', logo: '/games/cs2.png', deliveryTime: '1 Hour', price: '14.20', unit: 'Unit', stock: '5', minQty: '1 Unit', methods: ['In-Game'], status: 'paused', updated: '4 days ago' },
  { id: 'i4', num: 32640, title: '800 V-Bucks Gift', game: 'Fortnite', logo: '/games/fortnite.png', deliveryTime: '30 Min', price: '6.99', unit: 'Unit', stock: '12', minQty: '1 Unit', methods: ['Gifting'], status: 'draft', updated: '1 week ago' },
]

// ─── Status chips ────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<OfferStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'border-[rgba(198,255,61,0.22)] bg-[rgba(198,255,61,0.10)] text-lime-text' },
  paused: { label: 'Paused', cls: 'border-amber-400/25 bg-amber-400/10 text-amber-300' },
  draft: { label: 'Draft', cls: 'border-white/[0.12] bg-white/[0.05] text-text-secondary' },
  closed: { label: 'Closed', cls: 'border-white/[0.08] bg-white/[0.03] text-text-tertiary' },
  suspended: { label: 'Suspended', cls: 'border-red-500/25 bg-red-500/10 text-red-300' },
}

function StatusChip({ status }: { status: OfferStatus }) {
  const c = STATUS_CHIP[status]
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-md border px-2 py-[3px] text-[11.5px] font-bold', c.cls)}>
      {c.label}
    </span>
  )
}

// ─── Offer ID chip (copyable) ────────────────────────────────────────────────

function OfferIdChip({ num }: { num: number }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(`#${num}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <span className="inline-flex h-8 items-stretch overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.03]">
      <span className="flex items-center px-2.5 text-[12.5px] font-semibold tabular-nums text-text-secondary">
        #{num}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy offer ID #${num}`}
        className="flex w-8 items-center justify-center border-l border-white/[0.08] text-text-tertiary transition-colors hover:bg-white/[0.05] hover:text-text-primary"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-lime-text" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
}

// ─── Inline price editor ─────────────────────────────────────────────────────
// Thin stateful wrapper so the shared PriceField (ui/price-field) can be
// felt end-to-end in the mock: save waits ~450ms then commits locally.

function MockPrice({ initial, unit }: { initial: number; unit: string }) {
  const [saved, setSaved] = useState(initial)
  return (
    <PriceField
      value={saved}
      unit={unit}
      onSave={async (next) => {
        await new Promise((r) => setTimeout(r, 450))
        setSaved(next)
      }}
    />
  )
}

// ─── Dense rectangular menu recipe (shared by every dropdown here) ──────────

const MENU_CLS =
  // Platform-card material, opaque enough to read over the table: border-2
  // plate + top sheen (before:) + deep drop shadow + heavy blur.
  "relative overflow-hidden rounded-lg border-2 border-border-default bg-[rgba(17,18,26,0.96)] p-1.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.75)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-10 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent)] before:content-['']"
const ITEM_CLS =
  'h-9 cursor-pointer gap-2.5 rounded-[5px] px-2.5 text-[13px] font-semibold text-text-secondary focus:text-text-primary'
const LABEL_CLS =
  'px-2.5 pb-1 pt-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-tertiary'

// ─── Filter-bar building blocks ──────────────────────────────────────────────

// forwardRef + prop spread so it can sit under Radix `asChild` triggers
// (Radix injects the ref, aria props, and click handler via cloneElement).
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
    {children}
    {clearable ? (
      <span
        role="button"
        tabIndex={-1}
        aria-label="Clear filter"
        onPointerDown={() => onClear?.()}
        className="-mr-1 flex h-5 w-5 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-white/[0.10] hover:text-text-primary"
      >
        <X className="h-3.5 w-3.5" />
      </span>
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
    )}
  </button>
))
FilterTrigger.displayName = 'FilterTrigger'

// ─── The table (shared framework, per-variant rows) ─────────────────────────

const GAME_FILTER_ALL = 'All Games'

function OffersTable({ title, rows }: { title: string; rows: MockOffer[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [game, setGame] = useState(GAME_FILTER_ALL)
  const [status, setStatus] = useState<'all' | OfferStatus>('all')
  const [search, setSearch] = useState('')

  const games = useMemo(
    () => [GAME_FILTER_ALL, ...Array.from(new Set(rows.map((r) => r.game)))],
    [rows],
  )
  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (game === GAME_FILTER_ALL || r.game === game) &&
          (status === 'all' ? r.status !== 'closed' : r.status === status) &&
          (search.trim() === '' || r.title.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [rows, game, status, search],
  )

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id))
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.id)))
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const gameLogo = (name: string) => rows.find((r) => r.game === name)?.logo

  return (
    <section>
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[24px] font-extrabold tracking-[-0.3px] text-text-primary">{title}</h1>
        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-md bg-lime px-4 text-[13.5px] font-bold text-text-inverse shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-colors hover:bg-lime-hover"
        >
          <Plus className="h-4 w-4" strokeWidth={2.75} />
          Add New Offer
        </button>
      </div>

      {/* ── Filter row ── */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {/* Game — minimal when selected: logo + name, brighter border. No fill. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FilterTrigger active={game !== GAME_FILTER_ALL} clearable={game !== GAME_FILTER_ALL} onClear={() => setGame(GAME_FILTER_ALL)}>
              {game !== GAME_FILTER_ALL && gameLogo(game) ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gameLogo(game)} alt="" className="h-[18px] w-[18px] rounded object-cover" />
                  {game}
                </>
              ) : (
                'Game'
              )}
            </FilterTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={cn('w-60', MENU_CLS)}>
            {games.map((g) => (
              <DropdownMenuItem key={g} onClick={() => setGame(g)} className={ITEM_CLS}>
                {g !== GAME_FILTER_ALL && gameLogo(g) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={gameLogo(g)} alt="" className="h-5 w-5 rounded object-cover ring-1 ring-white/10" />
                ) : (
                  <LayoutGrid className="h-5 w-5 p-[3px] text-text-tertiary" />
                )}
                <span className="flex-1 truncate">{g}</span>
                {game === g && <Check className="h-4 w-4 text-lime-text" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FilterTrigger active={status !== 'all'}>
              {status === 'all' ? 'Status' : STATUS_CHIP[status].label}
            </FilterTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={cn('w-52', MENU_CLS)}>
            {(['all', 'active', 'paused', 'draft', 'closed'] as const).map((s) => (
              <DropdownMenuItem key={s} onClick={() => setStatus(s)} className={ITEM_CLS}>
                <span className="flex-1">{s === 'all' ? 'All' : STATUS_CHIP[s].label}</span>
                {status === s && <Check className="h-4 w-4 text-lime-text" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bulk Actions — armed only when rows are selected */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FilterTrigger disabled={selected.size === 0} active={selected.size > 0}>
              Bulk Actions
              {selected.size > 0 && (
                <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[11px] font-bold text-text-primary tabular-nums">
                  {selected.size}
                </span>
              )}
            </FilterTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={cn('w-60', MENU_CLS)}>
            <DropdownMenuLabel className={LABEL_CLS}>
              {selected.size} Selected
            </DropdownMenuLabel>
            <DropdownMenuItem className={ITEM_CLS}><Play className="h-4 w-4" /> Activate</DropdownMenuItem>
            <DropdownMenuItem className={ITEM_CLS}><Pause className="h-4 w-4" /> Pause</DropdownMenuItem>
            <DropdownMenuItem className={ITEM_CLS}><Clock className="h-4 w-4" /> Change Delivery Time</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={cn(ITEM_CLS, 'text-red-400 focus:text-red-300')}>
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search offers…"
            className="h-[42px] w-full rounded-md border-2 border-border-default bg-[rgba(20,20,27,0.56)] pl-9 pr-3 text-[13px] font-medium text-text-primary backdrop-blur-md transition-colors placeholder:text-text-tertiary focus:border-border-strong focus:outline-none focus-visible:shadow-none"
          />
        </div>

        {/* Sort — floating at the right edge */}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-[42px] items-center gap-1.5 whitespace-nowrap px-1 text-[13.5px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                Newest
                <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={cn('w-52', MENU_CLS)}>
              {['Newest', 'Oldest', 'Price: High to Low', 'Price: Low to High', 'Stock'].map((s, i) => (
                <DropdownMenuItem key={s} className={ITEM_CLS}>
                  <span className="flex-1">{s}</span>
                  {i === 0 && <Check className="h-4 w-4 text-lime-text" />}
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <thead>
              <tr className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6d7488]">
                <th className="w-12 py-3 pl-5 pr-2">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all offers" />
                </th>
                <th className="min-w-[220px] px-3 py-3">Offer</th>
                <th className="px-3 py-3 whitespace-nowrap">Delivery Time</th>
                <th className="px-3 py-3">
                  <span className="inline-flex items-center gap-1">Price <ArrowUpDown className="h-3 w-3 opacity-60" /></span>
                </th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">
                  <span className="inline-flex items-center gap-1">Stock <ArrowUpDown className="h-3 w-3 opacity-60" /></span>
                </th>
                <th className="px-3 py-3 whitespace-nowrap">Min Quantity</th>
                <th className="px-3 py-3 whitespace-nowrap">Delivery Method</th>
                <th className="px-3 py-3 whitespace-nowrap">Offer ID</th>
                <th className="px-3 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">Updated <ArrowUpDown className="h-3 w-3 opacity-60" /></span>
                </th>
                <th className="sticky right-0 z-10 w-24 bg-[linear-gradient(to_right,rgba(16,17,23,0)_0%,rgba(16,17,23,0.92)_42%,rgba(16,17,23,0.99)_68%)] py-3 pl-10 pr-5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-t border-white/[0.06] transition-colors',
                    selected.has(row.id) && 'bg-white/[0.03]',
                  )}
                >
                  <td className="py-4 pl-5 pr-2">
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={() => toggleOne(row.id)}
                      aria-label={`Select ${row.title}`}
                    />
                  </td>
                  <td className="px-3 py-4">
                    <span className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.logo}
                        alt=""
                        className="h-10 w-10 flex-none rounded-md object-cover ring-1 ring-white/10"
                      />
                      <span className="min-w-0">
                        <span className="block max-w-[230px] truncate text-[13.5px] font-bold text-text-primary">
                          {row.title}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-text-tertiary">{row.game}</span>
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-[13px] text-text-secondary">{row.deliveryTime}</td>
                  <td className="px-3 py-4"><MockPrice initial={Number(row.price)} unit="Unit" /></td>
                  <td className="px-3 py-4"><StatusChip status={row.status} /></td>
                  <td className="px-3 py-4 text-[13.5px] font-bold tabular-nums text-text-primary">{row.stock}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-[13px] tabular-nums text-text-secondary">{row.minQty}</td>
                  <td className="px-3 py-4">
                    <span className="flex flex-wrap gap-1">
                      {row.methods.map((m) => (
                        <span
                          key={m}
                          className="whitespace-nowrap rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-[3px] text-[11px] font-semibold text-text-secondary"
                        >
                          {m}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-4"><OfferIdChip num={row.num} /></td>
                  <td className="whitespace-nowrap px-3 py-4 text-[12.5px] text-text-tertiary">{row.updated}</td>
                  <td className="sticky right-0 z-10 bg-[linear-gradient(to_right,rgba(16,17,23,0)_0%,rgba(16,17,23,0.92)_42%,rgba(16,17,23,0.99)_68%)] py-4 pl-10 pr-5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Actions for ${row.title}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-text-tertiary transition-colors hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-text-primary"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={cn('w-60', MENU_CLS)}>
                        <DropdownMenuLabel className={LABEL_CLS}>
                          Offer Actions
                        </DropdownMenuLabel>
                        <DropdownMenuItem className={ITEM_CLS}><Pencil className="h-4 w-4" /> Edit Offer</DropdownMenuItem>
                        <DropdownMenuItem className={ITEM_CLS}><Eye className="h-4 w-4" /> View Offer</DropdownMenuItem>
                        <DropdownMenuItem className={ITEM_CLS}>
                          {row.status === 'paused' ? (
                            <><Play className="h-4 w-4" /> Activate Offer</>
                          ) : (
                            <><Pause className="h-4 w-4" /> Pause Offer</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className={ITEM_CLS}><ExternalLink className="h-4 w-4" /> View Public Offer</DropdownMenuItem>
                        <DropdownMenuItem className={ITEM_CLS}><Link2 className="h-4 w-4" /> Copy Public URL</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className={cn(ITEM_CLS, 'text-red-400 focus:text-red-300')}>
                          <Archive className="h-4 w-4" /> Archive Offer
                        </DropdownMenuItem>
                        <DropdownMenuItem className={cn(ITEM_CLS, 'text-red-400 focus:text-red-300')}>
                          <Trash2 className="h-4 w-4" /> Delete Offer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr className="border-t border-white/[0.06]">
                  <td colSpan={11} className="px-5 py-10 text-center text-[13px] text-text-tertiary">
                    No offers match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center gap-5 text-[12.5px] text-text-tertiary">
            <span>
              Showing <span className="font-semibold text-text-secondary">1–{visible.length}</span> of{' '}
              <span className="font-semibold text-text-secondary">{visible.length}</span>
            </span>
            <span className="flex items-center gap-2">
              Per page:
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#12151e] px-2.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-white/[0.16] hover:text-text-primary"
                  >
                    15 <ChevronDown className="h-3 w-3 text-text-tertiary" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn('w-24', MENU_CLS)}>
                  {['15', '25', '50'].map((n) => (
                    <DropdownMenuItem key={n} className={ITEM_CLS}>{n}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </div>
          <div className="flex items-center gap-1">
            {[ChevronsLeft, ChevronLeft].map((Icon, i) => (
              <button
                key={i}
                type="button"
                disabled
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] text-text-tertiary opacity-40"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.08] text-[12.5px] font-bold text-text-primary">
              1
            </span>
            {[ChevronRight, ChevronsRight].map((Icon, i) => (
              <button
                key={i}
                type="button"
                disabled
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] text-text-tertiary opacity-40"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OffersPreview() {
  return (
    <>
      <HeroBackdropPreload name="account" />
      <HeroBackdrop name="account" className="hero-dim">
        <div className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-lime-text">
            Design Preview · Currency Variant
          </p>
          <OffersTable title="Currency Offers" rows={CURRENCY_ROWS} />

          <div className="mt-16 border-t border-white/[0.06] pt-10">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-lime-text">
              Design Preview · Items Variant (Same Framework)
            </p>
            <OffersTable title="Item Offers" rows={ITEM_ROWS} />
          </div>
        </div>
      </HeroBackdrop>
    </>
  )
}
