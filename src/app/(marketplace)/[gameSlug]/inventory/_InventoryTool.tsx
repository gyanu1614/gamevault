'use client'

/**
 * The Inventory Worth tool. Everything runs in the browser:
 *
 * - the catalogue arrives once, packed (lib/values/inventory);
 * - the player's list lives in `location.hash` (`#i=slug:qty,…`) — a link
 *   carries the whole inventory and nothing reaches the server — mirrored to
 *   localStorage as a convenience (try/catch: private windows throw);
 * - items are added through the shared ItemPickerDialog (multi-add: a tap
 *   adds one copy and the tile shows the count);
 * - the share image and the Discord image are captured from DOM by
 *   modern-screenshot, imported only on click.
 *
 * Layout (design lessons): ONE surface for the tool — the total and the
 * actions on top, then the item rows (hairline-separated, no nested boxes)
 * beside the rarity breakdown and the top items; the sell row is its own
 * section below.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type RefObject } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { animate, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { ChartPieSliceIcon } from '@phosphor-icons/react/dist/csr/ChartPieSlice'
import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { CrownIcon } from '@phosphor-icons/react/dist/csr/Crown'
import { DiscordLogoIcon } from '@phosphor-icons/react/dist/csr/DiscordLogo'
import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/csr/DownloadSimple'
import { LinkIcon } from '@phosphor-icons/react/dist/csr/Link'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { MinusIcon } from '@phosphor-icons/react/dist/csr/Minus'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { ShareNetworkIcon } from '@phosphor-icons/react/dist/csr/ShareNetwork'
import { StorefrontIcon } from '@phosphor-icons/react/dist/csr/Storefront'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import Link from '@/components/navigation/AppLink'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ItemPickerDialog, type ItemPickerItem } from '@/components/values/ItemPickerDialog'
import { ValueArt } from '@/components/values/ValueArt'
import { VALUE_BTN_PRIMARY, VALUE_BTN_SECONDARY, VALUE_SURFACE } from '@/components/values/styles'
import { SITE_URL } from '@/config/site'
import { raritiesFor, rarityMeta } from '@/lib/values/rarity'
import {
  MAX_QTY,
  addItem,
  decodeInventory,
  encodeInventory,
  fmtUsd,
  inventoryLines,
  inventoryTotals,
  rarityBreakdown,
  removeItem,
  setQty,
  topItems,
  tradeAdText,
  unpackCatalogue,
  type InventoryEntry,
  type InventoryItem,
  type InventoryLine,
  type PackedCatalogue,
} from '@/lib/values/inventory'
import { cn } from '@/lib/utils'
import { CARD_SIZE, InventoryShareCard, type CardLayout } from './_InventoryShareCard'

const GREEN = '63,217,134'
const ALL = 'all'

function rgbOf(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

// ── persistence ──────────────────────────────────────────────────────────────

const storageKey = (gameSlug: string) => `dm:inventory:${gameSlug}`

function readStored(gameSlug: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(gameSlug))
  } catch {
    return null
  }
}

function writeStored(gameSlug: string, hash: string) {
  try {
    if (hash) window.localStorage.setItem(storageKey(gameSlug), hash)
    else window.localStorage.removeItem(storageKey(gameSlug))
  } catch {
    // Private mode / blocked storage: the hash still holds the list.
  }
}

/** A number that eases to its new value (instant with reduced motion). */
function useTween(value: number): number {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(value)
  const current = useRef(value)
  useEffect(() => {
    if (reduce) {
      current.current = value
      setShown(value)
      return
    }
    const controls = animate(current.current, value, {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        current.current = v
        setShown(v)
      },
    })
    return () => controls.stop()
  }, [value, reduce])
  return shown
}

// ── image capture ────────────────────────────────────────────────────────────

async function capture(node: HTMLElement, layout: CardLayout): Promise<Blob> {
  // Wait for every <img> in the card (art + logo) before the snapshot.
  await Promise.all(
    [...node.querySelectorAll('img')].map((img) =>
      img.complete && img.naturalWidth > 0 ? Promise.resolve() : img.decode().catch(() => undefined),
    ),
  )
  const { domToBlob } = await import('modern-screenshot')
  const { width, height } = CARD_SIZE[layout]
  return domToBlob(node, {
    width,
    height: height ?? node.offsetHeight,
    scale: 1,
    type: 'image/png',
    backgroundColor: '#121317',
    timeout: 20_000,
  })
}

const canCopyImage = () => typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Copy a PNG. Takes a promise too: Safari only allows the write inside the
 * click, so a not-yet-drawn image is handed over as a pending ClipboardItem.
 */
async function copyImage(source: Blob | Promise<Blob | null>) {
  const png = Promise.resolve(source).then((b) => {
    if (!b) throw new Error('no image')
    return b
  })
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    toast.success('Image copied')
  } catch {
    toast.error('Your browser blocked copying the image. Download it instead.')
  }
}

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(done)
  } catch {
    toast.error('Copy failed. Select the text and copy it by hand.')
  }
}

// ── the tool ─────────────────────────────────────────────────────────────────

export function InventoryTool({
  gameSlug,
  shortName,
  catalogue,
  popular,
  pageRarities,
  sellHref,
}: {
  gameSlug: string
  shortName: string
  catalogue: PackedCatalogue
  /** Quick-add slugs for the empty state. */
  popular: string[]
  /** Rarities with an item page (the name links there). */
  pageRarities: readonly string[]
  sellHref: string
}) {
  const items = useMemo(() => unpackCatalogue(catalogue), [catalogue])
  const bySlug = useMemo(() => new Map(items.map((i) => [i.slug, i])), [items])
  const rarityOrder = useMemo(() => raritiesFor(gameSlug).map((r) => r.key), [gameSlug])

  const [entries, setEntries] = useState<InventoryEntry[]>([])
  const [ready, setReady] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [adOpen, setAdOpen] = useState(false)

  // Load: the link wins (it is what a shared URL carries), else the last list.
  // `&add=1` (an item page's "Add To Inventory Worth") merges into the saved
  // list instead.
  useEffect(() => {
    const known = (s: string) => bySlug.has(s)
    const fromHash = decodeInventory(window.location.hash, known)
    const stored = decodeInventory(readStored(gameSlug), known)
    const merge = /(^#|&)add=1(&|$)/.test(window.location.hash)
    setEntries(
      merge ? fromHash.reduce((acc, e) => addItem(acc, e.slug, e.qty), stored) : fromHash.length ? fromHash : stored,
    )
    setReady(true)
    // A pasted link replaces the list; a hash with nothing valid in it is ignored
    // (only an empty hash clears it), so a mangled link never wipes the list.
    const onHash = () => {
      const next = decodeInventory(window.location.hash, known)
      if (next.length > 0 || window.location.hash.replace(/^#/, '') === '') setEntries(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [bySlug, gameSlug])

  // Save: hash (replaceState: no history entry per click) + localStorage.
  const hash = useMemo(() => encodeInventory(entries), [entries])
  useEffect(() => {
    if (!ready) return
    const want = hash ? `#${hash}` : ''
    if (window.location.hash !== want) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${want}`)
    }
    writeStored(gameSlug, hash)
  }, [hash, ready, gameSlug])

  const lines = useMemo(() => inventoryLines(entries, bySlug), [entries, bySlug])
  const totals = useMemo(() => inventoryTotals(lines), [lines])
  const breakdown = useMemo(() => rarityBreakdown(lines, rarityOrder), [lines, rarityOrder])
  const top = useMemo(() => topItems(lines, 3), [lines])
  const counts = useMemo(() => new Map(entries.map((e) => [e.slug, e.qty])), [entries])

  const add = useCallback((slug: string) => setEntries((e) => addItem(e, slug)), [])
  const setLineQty = useCallback((slug: string, qty: number) => setEntries((e) => setQty(e, slug, qty)), [])
  const remove = useCallback((slug: string) => setEntries((e) => removeItem(e, slug)), [])

  const pageUrl = `${SITE_URL}/${gameSlug}/inventory`
  const displayUrl = pageUrl.replace(/^https?:\/\//, '')
  const adText = useMemo(
    () => tradeAdText({ lines, totals, shortName, pageUrl, hash }),
    [lines, totals, shortName, pageUrl, hash],
  )

  const shown = useTween(totals.cheapestUsd)
  const shownMarket = useTween(totals.marketUsd)
  const hasItems = lines.length > 0
  const leadRgb = top[0] ? rgbOf(rarityMeta(gameSlug, top[0].item.rarity).color) : GREEN

  // Off-screen stage for the image capture, mounted while a share dialog is open.
  const ogRef = useRef<HTMLDivElement>(null)
  const discordRef = useRef<HTMLDivElement>(null)
  const stageOpen = (shareOpen || adOpen) && hasItems

  return (
    <>
      <section aria-labelledby="inventory-tool" className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 transition-[background] duration-500"
          style={{
            background: `radial-gradient(55% 70% at 100% 0%, rgba(${leadRgb},0.13) 0%, rgba(${leadRgb},0.04) 45%, transparent 75%), radial-gradient(40% 50% at 0% 100%, rgba(${GREEN},0.05) 0%, transparent 70%)`,
          }}
        />

        {/* Total + actions */}
        <div className="flex flex-col gap-5 p-5 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 id="inventory-tool" className="text-[15px] font-semibold text-text-secondary">
              Your {shortName} Inventory Is Worth
            </h2>
            <p className="mt-2 text-[44px] font-extrabold leading-none tracking-tight text-text-primary tabular-nums sm:text-[56px]">
              {fmtUsd(shown)}
            </p>
            <p className="sr-only" aria-live="polite">
              {hasItems ? `Total ${fmtUsd(totals.cheapestUsd)}, market value ${fmtUsd(totals.marketUsd)}` : ''}
            </p>
            <p className="mt-3 text-body-sm text-text-secondary">
              Market Value <span className="font-semibold text-text-primary tabular-nums">{fmtUsd(shownMarket)}</span>
              <span aria-hidden className="mx-2 text-text-tertiary">·</span>
              <span className="tabular-nums">{totals.count.toLocaleString('en-US')}</span> {totals.count === 1 ? 'Item' : 'Items'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap lg:justify-end">
            <button type="button" onClick={() => setPickerOpen(true)} className={cn(VALUE_BTN_PRIMARY, 'h-11 px-5 text-[14px]')}>
              <PlusIcon size={16} weight="bold" aria-hidden />
              Add Items
            </button>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <button
                type="button"
                disabled={!hasItems}
                onClick={() => setShareOpen(true)}
                className={cn(VALUE_BTN_SECONDARY, 'h-11 px-3 sm:px-4 max-sm:[&>svg]:hidden disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100')}
              >
                <ShareNetworkIcon size={16} weight="bold" aria-hidden />
                Share My Inventory
              </button>
              <button
                type="button"
                disabled={!hasItems}
                onClick={() => setAdOpen(true)}
                className={cn(VALUE_BTN_SECONDARY, 'h-11 px-3 sm:px-4 max-sm:[&>svg]:hidden disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100')}
              >
                <DiscordLogoIcon size={16} weight="fill" aria-hidden />
                Copy Trade Ad
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.07]">
          {!ready ? (
            <ToolBodySkeleton />
          ) : hasItems ? (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 px-5 pb-4 pt-2 sm:px-8 sm:pb-6">
                <div className="flex items-center justify-between gap-3 pt-3">
                  <h3 className="text-[16px] font-semibold text-text-primary">
                    Your Items <span className="font-medium text-text-tertiary tabular-nums">({lines.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEntries([])}
                    className="rounded-sm text-[13px] font-medium text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    Clear All
                  </button>
                </div>
                <ul className="mt-2">
                  {lines.map((l, i) => (
                    <ItemRow
                      key={l.item.slug}
                      line={l}
                      first={i === 0}
                      gameSlug={gameSlug}
                      href={l.item.rarity && pageRarities.includes(l.item.rarity) ? `/${gameSlug}/values/${l.item.slug}` : null}
                      onQty={setLineQty}
                      onRemove={remove}
                    />
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-white/[0.04] py-3 text-[14px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <PlusIcon size={15} weight="bold" aria-hidden />
                  Add More Items
                </button>
              </div>

              <aside className="min-w-0 space-y-7 border-t border-white/[0.07] px-5 py-6 sm:px-8 lg:border-l lg:border-t-0">
                <div>
                  <BlockHead icon={ChartPieSliceIcon} title="Value By Rarity" />
                  <RarityBreakdown gameSlug={gameSlug} rows={breakdown} />
                </div>
                <div className="border-t border-white/[0.07] pt-6">
                  <BlockHead icon={CrownIcon} title="Most Valuable Items" />
                  <ol className="mt-3">
                    {top.map((l, i) => {
                      const r = rarityMeta(gameSlug, l.item.rarity)
                      return (
                        <li key={l.item.slug} className={cn('flex items-center gap-3 py-2.5', i > 0 && 'border-t border-white/[0.07]')}>
                          <span className="w-4 shrink-0 text-center text-[13px] font-bold tabular-nums text-text-tertiary">{i + 1}</span>
                          <ArtTile src={l.item.imageUrl} name={l.item.name} color={r.color} size={40} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-semibold text-text-primary">{l.item.name}</span>
                            <span className="block text-[12px] font-medium" style={{ color: r.color }}>
                              {r.label || 'Item'}
                            </span>
                          </span>
                          <span className="text-[14px] font-bold tabular-nums text-text-primary">{fmtUsd(l.item.cheapestUsd)}</span>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              </aside>
            </div>
          ) : (
            <EmptyState
              gameSlug={gameSlug}
              shortName={shortName}
              picks={popular.map((s) => bySlug.get(s)).filter((i): i is InventoryItem => !!i)}
              priced={items.length}
              onAdd={add}
              onBrowse={() => setPickerOpen(true)}
            />
          )}
        </div>
      </section>

      <SellRow shortName={shortName} total={hasItems ? totals.cheapestUsd : null} sellHref={sellHref} art={top[0]?.item ?? null} gameSlug={gameSlug} />

      <InventoryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        gameSlug={gameSlug}
        shortName={shortName}
        items={items}
        counts={counts}
        onPick={add}
      />

      {stageOpen && (
        <div aria-hidden className="pointer-events-none fixed left-[-20000px] top-0" data-inventory-stage>
          <InventoryShareCard ref={ogRef} layout="og" gameSlug={gameSlug} shortName={shortName} displayUrl={displayUrl} lines={lines} top={top} totals={totals} />
          <InventoryShareCard ref={discordRef} layout="discord" gameSlug={gameSlug} shortName={shortName} displayUrl={displayUrl} lines={lines} top={top} totals={totals} />
        </div>
      )}

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} nodeRef={ogRef} shortName={shortName} total={totals.cheapestUsd} />
      <TradeAdDialog open={adOpen} onClose={() => setAdOpen(false)} text={adText} nodeRef={discordRef} shortName={shortName} />
    </>
  )
}

// ── pieces ───────────────────────────────────────────────────────────────────

function ArtTile({ src, name, color, size }: { src: string | null; name: string; color: string; size: number }) {
  const rgb = rgbOf(color)
  return (
    <span
      className="grid shrink-0 place-items-center rounded-md"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(closest-side, rgba(${rgb},0.30), rgba(${rgb},0.06) 70%, rgba(255,255,255,0.03))`,
      }}
    >
      <ValueArt src={src} alt={name} size={Math.round(size * 0.8)} />
    </span>
  )
}

function BlockHead({ icon: Icon, title }: { icon: ComponentType<IconProps>; title: string }) {
  return (
    <h3 className="flex items-center gap-2.5 text-[16px] font-semibold text-text-primary">
      <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-white/[0.07] text-text-primary">
        <Icon size={17} weight="duotone" />
      </span>
      {title}
    </h3>
  )
}

function ItemRow({
  line,
  first,
  gameSlug,
  href,
  onQty,
  onRemove,
}: {
  line: InventoryLine
  first: boolean
  gameSlug: string
  href: string | null
  onQty: (slug: string, qty: number) => void
  onRemove: (slug: string) => void
}) {
  const { item, qty, lineUsd } = line
  const r = rarityMeta(gameSlug, item.rarity)
  return (
    <li
      className={cn(
        'grid items-center gap-x-3 gap-y-2 py-3',
        'grid-cols-[48px_minmax(0,1fr)_auto] [grid-template-areas:"art_name_total"_"art_qty_remove"]',
        'sm:grid-cols-[48px_minmax(0,1fr)_auto_96px_36px] sm:[grid-template-areas:"art_name_qty_total_remove"]',
        !first && 'border-t border-white/[0.07]',
      )}
    >
      <span className="[grid-area:art]">
        <ArtTile src={item.imageUrl} name={item.name} color={r.color} size={48} />
      </span>
      <span className="min-w-0 [grid-area:name]">
        {href ? (
          <Link
            href={href}
            prefetch={false}
            className="block truncate rounded-sm text-[14px] font-semibold leading-5 text-text-primary hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {item.name}
          </Link>
        ) : (
          <span className="block truncate text-[14px] font-semibold leading-5 text-text-primary">{item.name}</span>
        )}
        <span className="block truncate text-[12.5px] leading-5 text-text-secondary">
          <span className="font-medium" style={{ color: r.color }}>
            {r.label || 'Item'}
          </span>
          <span aria-hidden className="mx-1.5 text-text-tertiary">·</span>
          <span className="tabular-nums">{fmtUsd(item.cheapestUsd)} Each</span>
        </span>
      </span>
      <span className="[grid-area:qty] max-sm:justify-self-start">
        <QtyStepper value={qty} name={item.name} onChange={(q) => onQty(item.slug, q)} />
      </span>
      <span className="text-right text-[15px] font-bold tabular-nums text-text-primary [grid-area:total]">{fmtUsd(lineUsd)}</span>
      <span className="justify-self-end [grid-area:remove]">
        <button
          type="button"
          onClick={() => onRemove(item.slug)}
          aria-label={`Remove ${item.name}`}
          className="grid h-9 w-9 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <XIcon size={16} weight="bold" aria-hidden />
        </button>
      </span>
    </li>
  )
}

function QtyStepper({ value, name, onChange }: { value: number; name: string; onChange: (qty: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const n = parseInt(draft, 10)
    if (!Number.isFinite(n) || n < 1) setDraft(String(value))
    else onChange(Math.min(MAX_QTY, n))
  }
  const btn =
    'grid h-9 w-9 place-items-center rounded-md text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent'
  return (
    <span className="inline-flex h-9 items-center rounded-md bg-bg-overlay">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={`One fewer ${name}`}>
        <MinusIcon size={14} weight="bold" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={`${name} quantity`}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className="h-9 w-10 bg-transparent text-center text-[14px] font-semibold tabular-nums text-text-primary outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus-ring"
      />
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= MAX_QTY} aria-label={`One more ${name}`}>
        <PlusIcon size={14} weight="bold" aria-hidden />
      </button>
    </span>
  )
}

function RarityBreakdown({ gameSlug, rows }: { gameSlug: string; rows: ReturnType<typeof rarityBreakdown> }) {
  return (
    <div className="mt-4">
      <div aria-hidden className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/[0.06]">
        {rows
          .filter((r) => r.share > 0)
          .map((r) => (
            <span
              key={r.rarity}
              className="h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${Math.max(r.share * 100, 1.5)}%`, background: rarityMeta(gameSlug, r.rarity).color }}
            />
          ))}
      </div>
      <ul className="mt-3">
        {rows.map((r) => {
          const m = rarityMeta(gameSlug, r.rarity)
          return (
            <li key={r.rarity} className="flex items-center gap-2.5 py-1.5 text-[13.5px]">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: m.color }} />
              <span className="font-semibold" style={{ color: m.color }}>
                {m.label || r.rarity}
              </span>
              <span className="text-text-tertiary tabular-nums">×{r.count}</span>
              <span className="ml-auto font-semibold tabular-nums text-text-primary">{fmtUsd(r.cheapestUsd)}</span>
              <span className="w-11 text-right tabular-nums text-text-tertiary">{Math.round(r.share * 100)}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EmptyState({
  gameSlug,
  shortName,
  picks,
  priced,
  onAdd,
  onBrowse,
}: {
  gameSlug: string
  shortName: string
  picks: InventoryItem[]
  priced: number
  onAdd: (slug: string) => void
  onBrowse: () => void
}) {
  return (
    <div className="px-5 py-8 sm:px-8 sm:py-10">
      <h3 className="text-[18px] font-semibold text-text-primary">Popular {shortName} Items</h3>
      <p className="mt-1.5 text-body-sm text-text-secondary">
        Tap an item to add it, or search all {priced.toLocaleString('en-US')} priced items.
      </p>
      <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {picks.map((p) => {
          const r = rarityMeta(gameSlug, p.rarity)
          return (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => onAdd(p.slug)}
                className="group flex w-full items-center gap-3 rounded-md bg-white/[0.04] p-3 text-left transition-[background-color,transform] hover:bg-white/[0.08] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <ArtTile src={p.imageUrl} name={p.name} color={r.color} size={52} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-text-primary">{p.name}</span>
                  <span className="block text-[12.5px]">
                    <span className="font-medium" style={{ color: r.color }}>
                      {r.label}
                    </span>
                    <span aria-hidden className="mx-1.5 text-text-tertiary">·</span>
                    <span className="tabular-nums text-text-secondary">{fmtUsd(p.cheapestUsd)}</span>
                  </span>
                </span>
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors"
                  style={{ background: `rgba(${GREEN},0.14)`, color: `rgb(${GREEN})` }}
                >
                  <PlusIcon size={15} weight="bold" />
                </span>
                <span className="sr-only">Add {p.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={onBrowse} className={cn(VALUE_BTN_SECONDARY, 'mt-4 h-11 w-full sm:w-auto')}>
        <MagnifyingGlassIcon size={16} weight="bold" aria-hidden />
        Search All {shortName} Items
      </button>
    </div>
  )
}

function ToolBodySkeleton() {
  return (
    <div aria-hidden className="space-y-3 px-5 py-8 sm:px-8">
      <span className="block h-5 w-64 max-w-full animate-pulse rounded-md bg-bg-inset" />
      <span className="block h-4 w-80 max-w-full animate-pulse rounded-md bg-bg-inset" />
      <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-[76px] animate-pulse rounded-md bg-white/[0.04]" />
        ))}
      </div>
    </div>
  )
}

function SellRow({
  shortName,
  total,
  sellHref,
  art,
  gameSlug,
}: {
  shortName: string
  total: number | null
  sellHref: string
  art: InventoryItem | null
  gameSlug: string
}) {
  const color = art ? rarityMeta(gameSlug, art.rarity).color : `rgb(${GREEN})`
  return (
    <section aria-labelledby="inventory-sell" className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: `radial-gradient(45% 90% at 0% 50%, rgba(${GREEN},0.10) 0%, transparent 70%)` }}
      />
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
        <span className="hidden sm:block">
          {art ? (
            <ArtTile src={art.imageUrl} name={art.name} color={color} size={72} />
          ) : (
            <span aria-hidden className="grid h-[72px] w-[72px] place-items-center rounded-md" style={{ background: `rgba(${GREEN},0.12)`, color: `rgb(${GREEN})` }}>
              <StorefrontIcon size={32} weight="duotone" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="inventory-sell" className="text-[20px] font-semibold tracking-tight text-text-primary">
            Sell Your Inventory on DropMarket
          </h2>
          <p className="mt-1.5 text-body leading-7 text-text-secondary">
            {total != null && total > 0 ? (
              <>
                Your items are worth <strong className="font-semibold text-text-primary tabular-nums">{fmtUsd(total)}</strong>. List them in minutes.
              </>
            ) : (
              <>Know what your {shortName} items are worth? List them in minutes.</>
            )}
          </p>
        </div>
        <Link href={sellHref} prefetch={false} className={cn(VALUE_BTN_PRIMARY, 'h-11 shrink-0 px-5 text-[14px]')}>
          <StorefrontIcon size={17} weight="bold" aria-hidden />
          Sell Your {shortName} Items
        </Link>
      </div>
    </section>
  )
}

// ── picker ───────────────────────────────────────────────────────────────────

function InventoryPicker({
  open,
  onClose,
  gameSlug,
  shortName,
  items,
  counts,
  onPick,
}: {
  open: boolean
  onClose: () => void
  gameSlug: string
  shortName: string
  items: InventoryItem[]
  counts: ReadonlyMap<string, number>
  onPick: (slug: string) => void
}) {
  const [q, setQ] = useState('')
  const [rarity, setRarity] = useState(ALL)

  const rarityOptions = useMemo(() => {
    const n = new Map<string, number>()
    for (const i of items) if (i.rarity) n.set(i.rarity, (n.get(i.rarity) ?? 0) + 1)
    return [
      { key: ALL, label: 'All', color: '#E8EDE9', count: items.length },
      ...raritiesFor(gameSlug)
        .filter((r) => n.has(r.key))
        .map((r) => ({ key: r.key, label: r.label, color: r.color, count: n.get(r.key) })),
    ]
  }, [items, gameSlug])

  const shown: ItemPickerItem[] = useMemo(() => {
    const s = q.trim().toLowerCase()
    const pool = items.filter((i) => rarity === ALL || i.rarity === rarity)
    const hits = s
      ? [
          ...pool.filter((i) => i.name.toLowerCase().startsWith(s)),
          ...pool.filter((i) => !i.name.toLowerCase().startsWith(s) && (i.name.toLowerCase().includes(s) || i.slug.includes(s))),
        ]
      : pool
    return hits.map((i) => {
      const r = rarityMeta(gameSlug, i.rarity)
      return { key: i.slug, name: i.name, imageUrl: i.imageUrl, sub: r.label || 'Item', subColor: r.color, price: fmtUsd(i.cheapestUsd), count: counts.get(i.slug) }
    })
  }, [items, q, rarity, gameSlug, counts])

  const picked = [...counts.values()].reduce((s, n) => s + n, 0)

  return (
    <ItemPickerDialog
      open={open}
      onClose={onClose}
      title={`Add ${shortName} Items`}
      subtitle={picked > 0 ? `${picked} ${picked === 1 ? 'item' : 'items'} in your inventory. Tap again for another copy.` : 'Tap an item to add it. Tap again for another copy.'}
      items={shown}
      onPick={onPick}
      query={q}
      onQueryChange={setQ}
      searchPlaceholder="Search a knife, gun or pet…"
      searchLabel={`Search ${shortName} items`}
      rarityOptions={rarityOptions}
      rarity={rarity}
      onRarityChange={setRarity}
      emptyText="No priced items match."
    />
  )
}

// ── share dialogs ────────────────────────────────────────────────────────────

function useCapture(nodeRef: RefObject<HTMLDivElement | null>, layout: CardLayout) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const run = useCallback(async (): Promise<Blob | null> => {
    // The stage mounts in the same commit as the dialog: wait a frame for it.
    for (let i = 0; i < 10 && !nodeRef.current; i++) await new Promise((r) => requestAnimationFrame(r))
    const node = nodeRef.current
    if (!node) return null
    setBusy(true)
    try {
      const b = await capture(node, layout)
      setBlob(b)
      return b
    } catch {
      toast.error('Could not draw the image. Please try again.')
      return null
    } finally {
      setBusy(false)
    }
  }, [nodeRef, layout])
  const reset = useCallback(() => setBlob(null), [])
  return { blob, busy, run, reset }
}

function ShareDialog({
  open,
  onClose,
  nodeRef,
  shortName,
  total,
}: {
  open: boolean
  onClose: () => void
  nodeRef: RefObject<HTMLDivElement | null>
  shortName: string
  total: number
}) {
  const { blob, busy, run, reset } = useCapture(nodeRef, 'og')
  const [url, setUrl] = useState<string | null>(null)
  const [copyable, setCopyable] = useState(false)
  const [shareable, setShareable] = useState(false)
  const fileName = `${shortName.toLowerCase()}-inventory.png`

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    setCopyable(canCopyImage())
    void run()
  }, [open, run, reset])

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    try {
      setShareable(!!navigator.canShare?.({ files: [new File([blob], fileName, { type: 'image/png' })] }))
    } catch {
      setShareable(false)
    }
    return () => URL.revokeObjectURL(u)
  }, [blob, fileName])

  const share = async () => {
    if (!blob) return
    try {
      await navigator.share({
        files: [new File([blob], fileName, { type: 'image/png' })],
        title: `My ${shortName} Inventory: ${fmtUsd(total)}`,
        text: window.location.href,
      })
    } catch {
      // Dismissed: nothing to do.
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="gap-0 border-0 bg-bg-raised p-0 sm:max-w-2xl">
        <div className="border-b border-white/[0.07] py-3.5 pl-5 pr-14">
          <DialogTitle className="text-base font-semibold text-text-primary">Share My Inventory</DialogTitle>
          <DialogDescription className="mt-1 text-[12px] text-text-tertiary">
            A 1200×630 image of your total and top items, drawn in your browser.
          </DialogDescription>
        </div>
        <div className="p-5">
          <div className="relative grid aspect-[1200/630] w-full place-items-center overflow-hidden rounded-md bg-white/[0.04]">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob preview
              <img src={url} alt={`My ${shortName} inventory, worth ${fmtUsd(total)}`} className="h-full w-full object-contain" data-share-preview />
            ) : (
              <span className="flex items-center gap-2 text-body-sm text-text-tertiary">
                <CircleNotchIcon size={18} className="animate-spin" aria-hidden />
                {busy ? 'Drawing your image…' : 'Preparing…'}
              </span>
            )}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <button type="button" disabled={!blob} onClick={() => blob && download(blob, fileName)} className={cn(VALUE_BTN_PRIMARY, 'h-11 px-5 disabled:opacity-45')}>
              <DownloadSimpleIcon size={16} weight="bold" aria-hidden />
              Download Image
            </button>
            {copyable && (
              <button type="button" disabled={!blob} onClick={() => blob && copyImage(blob)} className={cn(VALUE_BTN_SECONDARY, 'h-11 disabled:opacity-45')}>
                <CopyIcon size={16} weight="bold" aria-hidden />
                Copy Image
              </button>
            )}
            {shareable && (
              <button type="button" onClick={share} className={cn(VALUE_BTN_SECONDARY, 'h-11')}>
                <ShareNetworkIcon size={16} weight="bold" aria-hidden />
                Share
              </button>
            )}
            <button type="button" onClick={() => copyText(window.location.href, 'Link copied')} className={cn(VALUE_BTN_SECONDARY, 'h-11')}>
              <LinkIcon size={16} weight="bold" aria-hidden />
              Copy Link
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TradeAdDialog({
  open,
  onClose,
  text,
  nodeRef,
  shortName,
}: {
  open: boolean
  onClose: () => void
  text: string
  nodeRef: RefObject<HTMLDivElement | null>
  shortName: string
}) {
  const { blob, busy, run, reset } = useCapture(nodeRef, 'discord')
  const [copyable, setCopyable] = useState(false)
  const fileName = `${shortName.toLowerCase()}-inventory-discord.png`

  useEffect(() => {
    if (open) setCopyable(canCopyImage())
    else reset()
  }, [open, reset])

  const getBlob = async () => blob ?? (await run())

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="gap-0 border-0 bg-bg-raised p-0 sm:max-w-xl">
        <div className="border-b border-white/[0.07] py-3.5 pl-5 pr-14">
          <DialogTitle className="text-base font-semibold text-text-primary">Copy Trade Ad</DialogTitle>
          <DialogDescription className="mt-1 text-[12px] text-text-tertiary">
            Discord-ready text: paste it in a trading channel. The image is a vertical list sized for Discord.
          </DialogDescription>
        </div>
        <div className="p-5">
          <pre
            data-trade-ad
            className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg-base p-3.5 font-mono text-[12.5px] leading-5 text-text-secondary"
          >
            {text}
          </pre>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <button type="button" onClick={() => copyText(text, 'Trade ad copied')} className={cn(VALUE_BTN_PRIMARY, 'h-11 px-5')}>
              <CopyIcon size={16} weight="bold" aria-hidden />
              Copy Trade Ad
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const b = await getBlob()
                if (b) download(b, fileName)
              }}
              className={cn(VALUE_BTN_SECONDARY, 'h-11 disabled:opacity-60')}
            >
              {busy ? <CircleNotchIcon size={16} className="animate-spin" aria-hidden /> : <DownloadSimpleIcon size={16} weight="bold" aria-hidden />}
              Download Discord Image
            </button>
            {copyable && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void copyImage(getBlob())}
                className={cn(VALUE_BTN_SECONDARY, 'h-11 disabled:opacity-60')}
              >
                <CopyIcon size={16} weight="bold" aria-hidden />
                Copy Image
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
