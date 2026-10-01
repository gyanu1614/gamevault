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
 *
 * Look: flat admin kit — a bg-bg-raised card, one bg-bg-overlay box per
 * bundle, fields one step lighter inside the box, icon-only row actions.
 */

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, CircleNotch, Plus, Trash, UploadSimple } from '@phosphor-icons/react'
import { accountInputCls } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'
import { LabeledField, PanelHead, adminBtnSm } from '../../components/kit'
import { uploadCurrencyImage } from '@/lib/actions/admin-category-configs'
import { imageTooLargeMessage, readFileAsDataUrl, uploadErrorMessage } from '@/lib/uploads/image-upload'
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

/** A field inside a bundle box (bg-bg-overlay): one step lighter again. */
const ROW_INPUT = cn(accountInputCls, 'bg-white/[0.06]')

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
    <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
      <PanelHead
        title="Bundles"
        subtitle="Define a fixed list of bundles when this currency sells in pre-set sizes (Fortnite V-Bucks, Apex Coins). Leave empty for flexible-quantity currencies like Robux. Sellers will be required to pick one of these bundles when listing."
      />

      {bundles.length === 0 && (
        <div className="rounded-md bg-bg-overlay px-3.5 py-3 text-[13px] leading-relaxed text-text-tertiary">
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {bundles.length > COLLAPSE_AFTER && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={adminBtnSm.secondary}
          >
            {expanded
              ? 'Show Fewer'
              : `Show ${hiddenCount} More Bundle${hiddenCount === 1 ? '' : 's'}`}
          </button>
        )}

        <button
          type="button"
          onClick={addBundle}
          className={adminBtnSm.secondary}
        >
          <Plus aria-hidden weight="bold" className="h-3.5 w-3.5" /> Add Bundle
        </button>
      </div>
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

  // The read and the upload are awaited INSIDE the try, so `finally` clears
  // the spinner only once the upload has finished (it used to run as soon as
  // the FileReader started, so the spinner never showed).
  const onPickFile = async (file: File | null | undefined) => {
    if (!file) return
    const tooLarge = imageTooLargeMessage(file, 2_097_152, 'Icon')
    if (tooLarge) {
      toast.error(tooLarge)
      return
    }
    setUploading(true)
    try {
      const base64 = await readFileAsDataUrl(file)
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
    } catch (error) {
      toast.error(uploadErrorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  const nameId = `bundle-${bundle.id}-name`
  const amountId = `bundle-${bundle.id}-amount`

  return (
    <li className="flex gap-3 rounded-md bg-bg-overlay p-3">
      {/* Image tile */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        aria-busy={uploading}
        className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/[0.06] transition-colors hover:bg-white/[0.10] disabled:cursor-wait sm:h-20 sm:w-20"
        aria-label={bundle.icon_url ? 'Replace bundle icon' : 'Upload bundle icon'}
      >
        {bundle.icon_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={bundle.icon_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <UploadSimple aria-hidden weight="bold" className="h-5 w-5 text-text-tertiary" />
        )}
        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-black/55">
            <CircleNotch aria-hidden weight="bold" className="h-5 w-5 animate-spin text-text-primary" />
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.currentTarget.value = ''
          onPickFile(file)
        }}
      />

      {/* Phones: name on its own line, then amount + actions.
          From sm: name | amount | actions on one line. */}
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:gap-3">
        {/* Name + amount inputs */}
        <LabeledField label="Bundle Name" htmlFor={nameId} className="col-span-2 sm:col-span-1">
          <input
            id={nameId}
            value={bundle.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="800 V-Bucks"
            className={ROW_INPUT}
          />
        </LabeledField>

        <LabeledField label="Amount" htmlFor={amountId}>
          <input
            id={amountId}
            type="number"
            min="0"
            step="1"
            value={bundle.amount}
            onChange={(e) => onChange({ amount: parseInt(e.target.value || '0', 10) })}
            placeholder="800"
            className={cn(ROW_INPUT, 'tabular-nums')}
          />
        </LabeledField>

        {/* Reorder + delete controls */}
        <div className="flex items-center gap-0.5 pb-1">
          <IconButton
            aria-label="Move up"
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden weight="bold" className="h-4 w-4" />
          </IconButton>
          <IconButton
            aria-label="Move down"
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden weight="bold" className="h-4 w-4" />
          </IconButton>
          <IconButton
            aria-label="Remove bundle"
            onClick={onRemove}
            className="hover:bg-[color-mix(in_srgb,var(--color-error)_14%,transparent)] hover:text-error"
          >
            <Trash aria-hidden weight="bold" className="h-4 w-4" />
          </IconButton>
        </div>
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
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary',
        className,
      )}
    >
      {children}
    </button>
  )
}
