'use client'

/**
 * V19/P24/P2 — Admin editor for fixed-bundle currencies.
 *
 * When a currency has at least one bundle defined, the buyer-side
 * page flips from "stepper + free quantity" to "pick a bundle, see
 * sellers for that bundle". When the list is empty, currency stays
 * in flexible mode. The two modes are mutually exclusive — the admin
 * doesn't toggle anything explicitly; the presence of bundles is the
 * mode switch.
 *
 * Each bundle is { id, name, amount, icon_url?, sort_order? }. We
 * generate stable ids on add (crypto.randomUUID) and never recycle
 * them — listings reference bundle.id by string, so editing a name
 * or amount in place is safe but renaming an id would orphan sellers.
 *
 * Reordering uses arrow buttons rather than drag-and-drop to keep
 * the surface small; the wizard usually has 6-12 bundles, so up/down
 * arrows are quick enough and we don't need a dnd dependency.
 *
 * Image upload reuses the existing uploadCurrencyImage server action;
 * we render an avatar-style preview tile with a file input behind it.
 */

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { uploadCurrencyImage } from '@/lib/actions/admin-category-configs'
import type { CurrencyBundle } from '@/lib/types/category-configs'

type Props = {
  gameId: string
  value: CurrencyBundle[] | undefined
  onChange: (next: CurrencyBundle[]) => void
}

/**
 * V19/P24/P7.b — Collapse threshold. The first N bundles always
 * show; the rest hide behind a "Show all" toggle. Big games run
 * 10+ bundles and the editor gets unwieldy.
 */
const COLLAPSE_AFTER = 3

export function CurrencyBundlesSection({ gameId, value, onChange }: Props) {
  const bundles = value ?? []
  const [expanded, setExpanded] = useState(false)
  const showAll = expanded || bundles.length <= COLLAPSE_AFTER
  const visibleBundles = showAll ? bundles : bundles.slice(0, COLLAPSE_AFTER)
  const hiddenCount = bundles.length - visibleBundles.length

  const updateBundle = (id: string, patch: Partial<CurrencyBundle>) => {
    onChange(bundles.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  const removeBundle = (id: string) => {
    onChange(bundles.filter((b) => b.id !== id))
  }

  const moveBundle = (id: string, direction: -1 | 1) => {
    const idx = bundles.findIndex((b) => b.id === id)
    const swap = idx + direction
    if (idx < 0 || swap < 0 || swap >= bundles.length) return
    const next = [...bundles]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    // Persist the new order on sort_order so it survives drag-and-drop later.
    onChange(next.map((b, i) => ({ ...b, sort_order: i })))
  }

  const addBundle = () => {
    onChange([
      ...bundles,
      {
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: '',
        amount: 0,
        icon_url: null,
        sort_order: bundles.length,
      },
    ])
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
      <header className="space-y-1">
        <h3 className="text-[15px] font-semibold text-text-primary">Bundles</h3>
        <p className="text-[12.5px] text-text-secondary">
          Define a fixed list of bundles when this currency sells in pre-set sizes
          (Fortnite V-Bucks, Apex Coins). Leave empty for flexible-quantity currencies
          like Robux. Sellers will be required to pick one of these bundles when listing.
        </p>
      </header>

      {bundles.length === 0 && (
        <div className="rounded-xl border border-dashed border-border-default bg-bg-overlay/30 p-4 text-[12.5px] text-text-tertiary">
          No bundles defined &mdash; this currency stays in flexible mode (Robux-style stepper).
        </div>
      )}

      {bundles.length > 0 && (
        <ul className="space-y-2">
          {visibleBundles.map((bundle, i) => (
            <BundleRow
              key={bundle.id}
              gameId={gameId}
              bundle={bundle}
              isFirst={i === 0}
              isLast={i === bundles.length - 1}
              onChange={(patch) => updateBundle(bundle.id, patch)}
              onRemove={() => removeBundle(bundle.id)}
              onMove={(direction) => moveBundle(bundle.id, direction)}
            />
          ))}
        </ul>
      )}

      {bundles.length > COLLAPSE_AFTER && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-overlay/60 px-3 py-1.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
        >
          {expanded
            ? 'Show fewer'
            : `Show ${hiddenCount} more bundle${hiddenCount === 1 ? '' : 's'}`}
        </button>
      )}

      <button
        type="button"
        onClick={addBundle}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-overlay px-3 py-1.5 text-[13px] font-semibold text-text-primary transition-colors hover:bg-bg-raised-hover"
      >
        <Plus className="h-3.5 w-3.5" /> Add bundle
      </button>
    </section>
  )
}

/* ── Single bundle row ──────────────────────────────────────────── */

function BundleRow({
  gameId,
  bundle,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMove,
}: {
  gameId: string
  bundle: CurrencyBundle
  isFirst: boolean
  isLast: boolean
  onChange: (patch: Partial<CurrencyBundle>) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const onPickFile = async (file: File | null | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = String(reader.result ?? '')
        const res = await uploadCurrencyImage(gameId, {
          name: file.name,
          type: file.type,
          size: file.size,
          base64,
        })
        if (!res.success) {
          toast.error(res.error)
          return
        }
        onChange({ icon_url: res.data.url })
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
    }
  }

  return (
    <li className="grid grid-cols-[64px_1fr_120px_auto] items-center gap-3 rounded-xl border border-border-default bg-bg-overlay/40 p-3 sm:grid-cols-[80px_1fr_140px_auto]">
      {/* Image tile */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-border-default bg-bg-base transition-colors hover:border-lime-tint-border"
        aria-label="Upload bundle icon"
      >
        {bundle.icon_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={bundle.icon_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
        ) : (
          <Upload className="h-5 w-5 text-text-tertiary" />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />
      </button>

      {/* Name + amount inputs */}
      <div className="min-w-0 space-y-1.5">
        <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">
          Bundle name
        </label>
        <Input
          value={bundle.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="800 V-Bucks"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">
          Amount
        </label>
        <Input
          type="number"
          min="0"
          step="1"
          value={bundle.amount}
          onChange={(e) => onChange({ amount: parseInt(e.target.value || '0', 10) })}
          placeholder="800"
        />
      </div>

      {/* Reorder + delete controls */}
      <div className="flex items-center gap-1">
        <IconButton
          aria-label="Move up"
          disabled={isFirst}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          aria-label="Move down"
          disabled={isLast}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton aria-label="Remove bundle" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-error" />
        </IconButton>
      </div>
    </li>
  )
}

function IconButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={
        'inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-default bg-bg-overlay text-text-primary transition-colors hover:bg-bg-raised-hover disabled:cursor-not-allowed disabled:opacity-40 ' +
        (className ?? '')
      }
    >
      {children}
    </button>
  )
}
