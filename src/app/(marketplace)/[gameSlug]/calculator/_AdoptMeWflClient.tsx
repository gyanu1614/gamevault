'use client'

/**
 * Adopt Me WFL (Win / Fair / Loss) trade calculator — DUAL verdict.
 *
 * The differentiator: every incumbent WFL calculator scores a trade in
 * community trade POINTS only. This one scores it in points AND in real money,
 * because DropMarket holds cash values. A trade can be "Fair" in trade value
 * but a "Loss" of $201 in real money — the number no rival can show.
 *
 * Inputs are variant-only per pet (the 8-form ladder already encodes fly/ride/
 * neon/mega). No age slider — we hold no age-priced data.
 *
 * Design: values-kit card surfaces (no outlines). Adding a pet is the shared
 * two-step ItemPickerDialog (pick pet → pick variant). Each row shows a bold
 * price + the shared two-axis variant picker. The verdict states the
 * real-money gap in words.
 */

import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { ArrowsLeftRightIcon } from '@phosphor-icons/react/dist/csr/ArrowsLeftRight'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import type { CalcPet, Variant } from './_adoptMeCalcTypes'
import { VARIANTS, VARIANT_LABEL } from './_adoptMeCalcTypes'
import { CompactVariantPicker } from '../values/_CompactVariantPicker'
import { variantColor } from '../values/[itemSlug]/_adoptMeVariantColor'
import { centsToUsd, sumSide } from '@/lib/calculator/trade-sum'
import { ItemPickerDialog } from '@/components/values/ItemPickerDialog'
import { ValueArt } from '@/components/values/ValueArt'
import { ValuesEmptyState } from '@/components/values/ValuesEmptyState'
import {
  VALUE_BTN_PRIMARY,
  VALUE_BTN_SECONDARY,
  VALUE_SURFACE,
  VALUE_TILE,
} from '@/components/values/styles'
import { ADOPT_ME_RARITIES, rarityMeta } from '@/lib/values/rarity'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const TRADE = new Intl.NumberFormat('en-US')

/** Adopt Me stat colours (same as the value list): cheapest cash + trade. */
const CASH_COLOR = '#54DDBE'
const TRADE_COLOR = '#E8BD6A'
const EASE = [0.16, 1, 0.3, 1] as const

interface Entry {
  id: string
  slug: string
  variant: Variant
}

let idc = 0
const nextId = () => `e${++idc}`

export default function AdoptMeWflClient({ pets }: { pets: CalcPet[] }) {
  const petBySlug = useMemo(() => new Map(pets.map((p) => [p.slug, p])), [pets])
  const [give, setGive] = useState<Entry[]>([])
  const [receive, setReceive] = useState<Entry[]>([])
  const [picker, setPicker] = useState<null | 'give' | 'receive'>(null)
  // Fresh picker state (search, filter, chosen pet) every time it opens.
  const [pickerSession, setPickerSession] = useState(0)
  // Once both sides have pets we collapse the big adders to one-line summaries
  // and float the verdict to the top. "Edit" reopens the full panels.
  const [editing, setEditing] = useState(false)

  function openPicker(side: 'give' | 'receive') {
    setPickerSession((n) => n + 1)
    setPicker(side)
  }
  function addPet(side: 'give' | 'receive', slug: string, variant: Variant) {
    const entry: Entry = { id: nextId(), slug, variant }
    if (side === 'give') setGive((g) => [...g, entry])
    else setReceive((r) => [...r, entry])
    setPicker(null)
  }
  function removeEntry(side: 'give' | 'receive', id: string) {
    if (side === 'give') setGive((g) => g.filter((e) => e.id !== id))
    else setReceive((r) => r.filter((e) => e.id !== id))
  }
  function setVariant(side: 'give' | 'receive', id: string, variant: Variant) {
    const upd = (list: Entry[]) => list.map((e) => (e.id === id ? { ...e, variant } : e))
    if (side === 'give') setGive(upd)
    else setReceive(upd)
  }

  const totals = useMemo(() => {
    const sum = (list: Entry[]) => {
      let trade = 0
      for (const e of list) trade += petBySlug.get(e.slug)?.values[e.variant]?.tradeValue ?? 0
      // Cash sums in cents through the shared calculator maths, so small
      // estimates are never lost to float drift.
      const cashSide = sumSide(
        list.map((e) => ({ pointUsd: petBySlug.get(e.slug)?.values[e.variant]?.cashUsd, quantity: 1 })),
      )
      return { trade, cash: centsToUsd(cashSide.pointCents), cashMissing: cashSide.unknown > 0 }
    }
    return { give: sum(give), receive: sum(receive) }
  }, [give, receive, petBySlug])

  function verdict(giveVal: number, recVal: number) {
    if (giveVal === 0 && recVal === 0) return null
    const diff = recVal - giveVal
    const base = Math.max(giveVal, recVal, 1)
    const pct = (diff / base) * 100
    if (Math.abs(pct) <= 5) return { letter: 'F', label: 'Fair', color: '#E0B155', pct, diff }
    if (pct > 5) return { letter: 'W', label: 'Win', color: '#4FB477', pct, diff }
    return { letter: 'L', label: 'Loss', color: '#C97B6B', pct, diff }
  }

  const tradeVerdict = verdict(totals.give.trade, totals.receive.trade)
  const cashVerdict =
    totals.give.cash === 0 && totals.receive.cash === 0 ? null : verdict(totals.give.cash, totals.receive.cash)

  return (
    <div className="space-y-6">
      {(give.length > 0 || receive.length > 0) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setGive([]); setReceive([]); setEditing(false) }}
            className="rounded-md px-2 py-1 text-[13px] font-semibold text-text-secondary transition-colors hover:text-[#C97B6B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Clear All
          </button>
        </div>
      )}

      {(() => {
        const bothFilled = give.length > 0 && receive.length > 0
        const collapsed = bothFilled && !editing

        // Collapsed: ONE card — each side card shows its pets + total, an Edit at
        // top-right reopens the pickers, and the balance + verdict sit below.
        if (collapsed) {
          return (
            <Verdict
              cash={cashVerdict}
              trade={tradeVerdict}
              cashGive={totals.give.cash}
              cashRec={totals.receive.cash}
              tradeGive={totals.give.trade}
              tradeRec={totals.receive.trade}
              cashMissing={totals.give.cashMissing || totals.receive.cashMissing}
              giveCount={give.length}
              receiveCount={receive.length}
              giveLines={<PetLines entries={give} petBySlug={petBySlug} />}
              recLines={<PetLines entries={receive} petBySlug={petBySlug} align="right" />}
              onEdit={() => setEditing(true)}
            />
          )
        }

        // Building (or explicitly editing): full adder panels, then the verdict
        // / incomplete prompt below.
        return (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Side title="You give" side="give" entries={give} petBySlug={petBySlug} total={totals.give} onAdd={() => openPicker('give')} onRemove={removeEntry} onVariant={setVariant} />
              <Side title="They offer" side="receive" entries={receive} petBySlug={petBySlug} total={totals.receive} onAdd={() => openPicker('receive')} onRemove={removeEntry} onVariant={setVariant} />
            </div>
            {bothFilled && editing && (
              <div className="flex justify-end">
                <button type="button" onClick={() => setEditing(false)} className={VALUE_BTN_PRIMARY}>
                  Done Editing
                </button>
              </div>
            )}
            <Verdict
              cash={cashVerdict}
              trade={tradeVerdict}
              cashGive={totals.give.cash}
              cashRec={totals.receive.cash}
              tradeGive={totals.give.trade}
              tradeRec={totals.receive.trade}
              cashMissing={totals.give.cashMissing || totals.receive.cashMissing}
              giveCount={give.length}
              receiveCount={receive.length}
            />
          </div>
        )
      })()}

      <PetPicker
        key={pickerSession}
        open={picker != null}
        pets={pets}
        onPick={(slug, variant) => { if (picker) addPet(picker, slug, variant) }}
        onClose={() => setPicker(null)}
      />
    </div>
  )
}

/* ── One side of the trade ───────────────────────────────────────────────── */
function Side({
  title,
  side,
  entries,
  petBySlug,
  total,
  onAdd,
  onRemove,
  onVariant,
}: {
  title: string
  side: 'give' | 'receive'
  entries: Entry[]
  petBySlug: Map<string, CalcPet>
  total: { trade: number; cash: number; cashMissing: boolean }
  onAdd: () => void
  onRemove: (side: 'give' | 'receive', id: string) => void
  onVariant: (side: 'give' | 'receive', id: string, v: Variant) => void
}) {
  const reduced = useReducedMotion()
  return (
    <div className={VALUE_SURFACE}>
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <span className="text-[14px] font-semibold text-text-primary">{title}</span>
        <span className="text-[12px] text-text-secondary">{entries.length} item{entries.length === 1 ? '' : 's'}</span>
      </div>

      <div className="space-y-2 p-3">
        {entries.length === 0 ? (
          <div className="px-1 py-6 text-center text-[13px] text-text-tertiary">No pets added yet.</div>
        ) : (
          entries.map((e) => {
            const pet = petBySlug.get(e.slug)
            if (!pet) return null
            const v = pet.values[e.variant]
            return (
              <motion.div
                key={e.id}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                className={`${VALUE_TILE} p-3`}
              >
                <div className="mb-2.5 flex items-center gap-3">
                  <ValueArt src={pet.imageUrl} alt={pet.name} aria-hidden size={40} className="shrink-0" />
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text-primary">{pet.name}</p>
                  <div className="text-right">
                    <p className="text-[18px] font-bold leading-none tabular-nums" style={{ color: CASH_COLOR }}>
                      {v?.cashUsd != null ? USD.format(v.cashUsd) : '—'}
                    </p>
                    <p className="mt-0.5 text-[12px] tabular-nums text-text-secondary">
                      {v?.tradeValue != null ? `${TRADE.format(v.tradeValue)} trade` : 'no cash'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(side, e.id)}
                    aria-label="Remove"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-[#C97B6B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <XIcon size={16} weight="bold" aria-hidden />
                  </button>
                </div>
                {/* Two-axis variant picker: tier (Default/Neon/Mega) + Fly/Ride
                    toggles. Unpriced (no-cash) forms are greyed and blocked. */}
                <CompactVariantPicker
                  variant={e.variant}
                  onChange={(code) => onVariant(side, e.id, code)}
                  accent={variantColor(e.variant)}
                  isAvailable={(code) => pet.values[code]?.cashUsd != null}
                  layout="inline"
                  showSelected={false}
                />
                <p className="mt-1.5 text-[11px] text-text-tertiary">
                  {VARIANT_LABEL[e.variant]}
                </p>
              </motion.div>
            )
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3">
        <button type="button" onClick={onAdd} className={`${VALUE_BTN_SECONDARY} h-9 px-3`}>
          <PlusIcon size={16} weight="bold" aria-hidden /> Add Pet
        </button>
        {entries.length > 0 ? (
          <div className="text-right">
            <p className="text-[16px] font-bold leading-none tabular-nums" style={{ color: CASH_COLOR }}>{USD.format(total.cash)}</p>
            <p className="mt-0.5 text-[12px] text-text-secondary"><span className="tabular-nums" style={{ color: TRADE_COLOR }}>{TRADE.format(total.trade)}</span> trade</p>
          </div>
        ) : (
          <span className="text-[12px] text-text-tertiary">Total shows here</span>
        )}
      </div>
    </div>
  )
}

/* ── Compact per-pet lines for one side (collapsed view). No header/total — the
   tug-of-war cards below carry the side totals. ─────────────────────────────── */
function PetLines({
  entries,
  petBySlug,
  align,
}: {
  entries: Entry[]
  petBySlug: Map<string, CalcPet>
  align?: 'right'
}) {
  const right = align === 'right'
  return (
    <ul className="space-y-2">
      {entries.map((e) => {
        const pet = petBySlug.get(e.slug)
        if (!pet) return null
        const v = pet.values[e.variant]
        return (
          <li key={e.id} className={`flex items-center gap-2.5 ${right ? 'flex-row-reverse text-right' : ''}`}>
            <ValueArt src={pet.imageUrl} alt={pet.name} aria-hidden size={36} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-semibold text-text-primary">{pet.name}</p>
              <p className="truncate text-caption text-text-tertiary">{VARIANT_LABEL[e.variant]}</p>
            </div>
            <p className="shrink-0 text-body-sm font-bold tabular-nums" style={{ color: CASH_COLOR }}>
              {v?.cashUsd != null ? USD.format(v.cashUsd) : '—'}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Unified verdict — real money leads, trade value inside the same card ── */
type V = { letter: string; label: string; color: string; pct: number; diff: number } | null

function Verdict({
  cash,
  trade,
  cashGive,
  cashRec,
  tradeGive,
  tradeRec,
  cashMissing,
  giveCount,
  receiveCount,
  giveLines,
  recLines,
  onEdit,
}: {
  cash: V
  trade: V
  cashGive: number
  cashRec: number
  tradeGive: number
  tradeRec: number
  cashMissing: boolean
  giveCount: number
  receiveCount: number
  /** Collapsed view: per-pet lines shown INSIDE each side card, + an Edit action. */
  giveLines?: React.ReactNode
  recLines?: React.ReactNode
  onEdit?: () => void
}) {
  const reduced = useReducedMotion()
  // A verdict only makes sense once BOTH sides have pets. With one side (or
  // neither) filled, a trade isn't a "loss" — it's just incomplete. Prompt for
  // the side that's still empty instead of scaring the user with "you lose $X".
  const bothSides = giveCount > 0 && receiveCount > 0
  if (!bothSides) {
    const prompt =
      giveCount === 0 && receiveCount === 0
        ? 'Add pets to both sides to see if the trade is a win, fair, or a loss.'
        : giveCount === 0
          ? 'Add what you give to see the verdict.'
          : 'Add what they offer to see the verdict.'
    return (
      <div className={`${VALUE_SURFACE} flex flex-col items-center gap-3 px-6 py-10 text-center`}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-text-tertiary">
          <ArrowsLeftRightIcon size={20} weight="bold" aria-hidden />
        </span>
        <div>
          <p className="text-body font-semibold text-text-primary">Build both sides of the trade</p>
          <p className="mt-1 text-body-sm text-text-secondary">{prompt}</p>
        </div>
      </div>
    )
  }

  // The headline follows the CASH verdict (our wedge); trade value is secondary.
  const head = cash ?? trade
  if (!head) {
    return <ValuesEmptyState compact title="No cash or trade data on these pets yet." />
  }

  const headline =
    cash == null
      ? 'No cash data on these pets yet'
      : cash.label === 'Fair'
        ? 'This Trade Is Fair'
        : cash.label === 'Win'
          ? 'This Trade Is a Win'
          : 'This Trade Is a Loss'

  const gapLine =
    cash == null
      ? 'Real-money verdict needs priced pets on both sides.'
      : cash.label === 'Fair'
        ? 'Both sides are within about 5% in real money.'
        : `You ${cash.diff >= 0 ? 'gain' : 'lose'} ${USD.format(Math.abs(cash.diff))} in real money.`

  // Balance meter — the GET side's share of the two totals drives the fill.
  // Uses the cash axis when we have it (our wedge), else trade points, so the
  // bar always reflects the headline verdict. Center = a fair 50/50 split.
  const gv = cash != null ? cashGive : tradeGive
  const rv = cash != null ? cashRec : tradeRec
  const total = gv + rv
  const getShare = total > 0 ? rv / total : 0.5

  return (
    <motion.div
      key={`${cash?.label}-${cash?.diff}`}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className={`${VALUE_SURFACE} overflow-hidden p-5 sm:p-6`}
    >
      {/* Edit — top-right, reopens the full pickers (collapsed view only). */}
      {onEdit && (
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={onEdit} className={`${VALUE_BTN_SECONDARY} h-8 px-3 text-caption`}>
            <PencilSimpleIcon size={14} weight="bold" aria-hidden /> Edit
          </button>
        </div>
      )}

      {/* ── Tug-of-war: each side shows its pets + total; the meter leans to the
          heavier side; the verdict word pops in. ─────────────────────────── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
        <BalanceSide label="You give" accent="#5AC8FA" cash={USD.format(cashGive)} pts={`${TRADE.format(tradeGive)} trade`} lines={giveLines} />
        <div className="flex items-center justify-center text-caption font-extrabold text-text-tertiary">VS</div>
        <BalanceSide label="They offer" accent="#B07BC9" cash={USD.format(cashRec)} pts={`${TRADE.format(tradeRec)} trade`} align="right" lines={recLines} />
      </div>

      {/* Weighted balance bar */}
      <div className="relative mt-5 h-3.5 overflow-hidden rounded-full bg-bg-overlay">
        <div
          className="absolute inset-0 rounded-full transition-[clip-path] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{
            background: 'linear-gradient(90deg, #5AC8FA, #B07BC9)',
            clipPath: `inset(0 ${((1 - getShare) * 100).toFixed(1)}% 0 0)`,
          }}
        />
        {/* center "fair" tick */}
        <div className="absolute -top-1 bottom-[-4px] left-1/2 w-0.5 -translate-x-1/2 bg-white/25" />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium text-text-tertiary">
        <span style={{ color: '#5AC8FA' }}>Your Side</span>
        <span>Fair</span>
        <span style={{ color: '#B07BC9' }}>Their Side</span>
      </div>

      {/* Verdict word — pops in, tinted by the cash verdict. */}
      <motion.div
        key={`${head.letter}-${cash?.diff}`}
        initial={reduced ? false : { opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 22 }}
        className="mt-6 flex flex-col items-center gap-2 text-center"
      >
        <span
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[22px] font-extrabold"
          style={{ color: head.color, background: `${head.color}1f` }}
        >
          {head.letter}
        </span>
        <p className="text-[24px] font-extrabold leading-tight tracking-[-0.01em]" style={{ color: head.color }}>
          {headline}
        </p>
        <p className="text-body-sm text-text-secondary">{gapLine}</p>
      </motion.div>

      {/* Detail axes — real money + trade value, quieter, below the fold. */}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Axis label="Real money" hint="DropMarket cash value" verdict={cash} give={USD.format(cashGive)} rec={USD.format(cashRec)} />
        <Axis label="Trade value" hint="Community consensus" verdict={trade} give={TRADE.format(tradeGive)} rec={TRADE.format(tradeRec)} />
      </div>

      {cashMissing && (
        <p className="mt-3 text-[12px] text-text-tertiary">
          Some pets have no cash value yet — they&apos;re excluded from the real-money side.
        </p>
      )}
    </motion.div>
  )
}

/** One side of the tug-of-war header — coloured label + cash headline + trade sub. */
function BalanceSide({
  label,
  accent,
  cash,
  pts,
  align,
  lines,
}: {
  label: string
  accent: string
  cash: string
  pts: string
  align?: 'right'
  /** Collapsed view: the per-pet rows shown inside this side card. */
  lines?: React.ReactNode
}) {
  // With pet lines (collapsed): compact label + total on top, pets listed below.
  if (lines) {
    return (
      <div className={`${VALUE_TILE} px-4 py-3`}>
        <div className={`flex items-baseline justify-between gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          <span className="text-[12px] font-semibold" style={{ color: accent }}>{label}</span>
          <span className="text-[18px] font-extrabold tabular-nums text-text-primary">{cash}</span>
        </div>
        <div className="mt-3">{lines}</div>
      </div>
    )
  }
  // Without lines: just the label + total (used before pets exist).
  return (
    <div className={`${VALUE_TILE} px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>
      <span className="text-[12px] font-semibold" style={{ color: accent }}>{label}</span>
      <p className="mt-1 text-[22px] font-extrabold tabular-nums text-text-primary">{cash}</p>
      <p className="mt-0.5 text-caption tabular-nums text-text-secondary">{pts}</p>
    </div>
  )
}

function Axis({
  label,
  hint,
  verdict,
  give,
  rec,
}: {
  label: string
  hint: string
  verdict: V
  give: string
  rec: string
}) {
  return (
    <div className={`${VALUE_TILE} px-5 py-4`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-text-primary">{label}</span>
        {verdict && (
          <span className="text-[13px] font-semibold" style={{ color: verdict.color }}>
            {verdict.label} · {Math.abs(verdict.pct).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-[12px] text-text-tertiary">{hint}</p>
      <div className="mt-2.5 flex items-center justify-between text-[14px] text-text-secondary">
        <span>you give <span className="font-semibold tabular-nums text-text-primary">{give}</span></span>
        <ArrowRightIcon size={14} weight="bold" aria-hidden className="text-text-tertiary" />
        <span>get <span className="font-semibold tabular-nums text-text-primary">{rec}</span></span>
      </div>
    </div>
  )
}

/* ── Two-step pet picker: pick pet → pick variant (shared ItemPickerDialog) ── */
/* Rarity filters — "All Pets" + only the rarities our data actually has. */
const ALL_PETS = { key: 'all', label: 'All Pets', color: '#E8EDE9' }

function PetPicker({
  open,
  pets,
  onPick,
  onClose,
}: {
  open: boolean
  pets: CalcPet[]
  onPick: (slug: string, variant: Variant) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [rarity, setRarity] = useState('all')
  const [chosen, setChosen] = useState<CalcPet | null>(null)
  // Local variant while picking, so the axis picker + price preview are live
  // before the pet is committed. Defaults to the first priced form (FR-ish).
  const [draft, setDraft] = useState<Variant>('FR')

  // Rarities actually present, so the filter never shows an empty option.
  const raritiesPresent = useMemo(
    () => new Set(pets.map((p) => p.rarity)),
    [pets],
  )
  const rarityOptions = [ALL_PETS, ...ADOPT_ME_RARITIES.filter((r) => raritiesPresent.has(r.key))]

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return pets.filter((p) => {
      if (rarity !== 'all' && p.rarity !== rarity) return false
      if (s && !p.name.toLowerCase().includes(s)) return false
      return true
    })
  }, [q, rarity, pets])

  const bySlug = useMemo(() => new Map(pets.map((p) => [p.slug, p])), [pets])

  // When a pet is chosen, seed the draft variant to its first priced form so
  // the preview isn't empty.
  const choosePet = (p: CalcPet) => {
    const firstPriced = VARIANTS.find((c) => p.values[c]?.cashUsd != null) ?? 'FR'
    setDraft(firstPriced)
    setChosen(p)
  }

  let detail: React.ReactNode = undefined
  if (chosen) {
    const v = chosen.values[draft]
    const priced = v?.cashUsd != null
    const rMeta = ADOPT_ME_RARITIES.find((r) => r.key === chosen.rarity)
    detail = (
      <div>
        {/* Pet preview — compact: small art + name + rarity + live value. */}
        <div className={`${VALUE_TILE} flex items-center gap-4 px-4 py-3.5`}>
          <ValueArt src={chosen.imageUrl} alt={chosen.name} size={56} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-bold text-text-primary">{chosen.name}</p>
            {rMeta && (
              <span className="mt-0.5 inline-flex items-center gap-1.5 text-caption font-semibold" style={{ color: rMeta.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: rMeta.color }} />
                {rMeta.label}
              </span>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[20px] font-extrabold tabular-nums" style={{ color: CASH_COLOR }}>
              {priced ? USD.format(v!.cashUsd!) : <span className="text-body-sm text-text-tertiary">No price</span>}
            </p>
            <p className="text-caption tabular-nums text-text-secondary">
              {v?.tradeValue != null ? `${TRADE.format(v.tradeValue)} trade` : VARIANT_LABEL[draft]}
            </p>
          </div>
        </div>

        {/* Variant selectors — Tier row (Default/Neon/Mega) over Potion
            row (Fly/Ride), labelled + distinct. */}
        <div className="mt-4">
          <CompactVariantPicker
            variant={draft}
            onChange={setDraft}
            accent={variantColor(draft)}
            showSelected={false}
          />
        </div>

        <button
          type="button"
          onClick={() => onPick(chosen.slug, draft)}
          disabled={chosen.values[draft]?.cashUsd == null}
          className={`${VALUE_BTN_PRIMARY} mt-5 h-11 w-full disabled:cursor-not-allowed disabled:bg-bg-overlay disabled:text-text-disabled disabled:active:scale-100`}
        >
          Add {chosen.name}
        </button>
      </div>
    )
  }

  return (
    <ItemPickerDialog
      open={open}
      onClose={onClose}
      title={chosen ? 'Choose A Variant' : 'Choose A Pet'}
      items={filtered.map((p) => {
        const r = rarityMeta('adopt-me', p.rarity)
        return { key: p.slug, name: p.name, imageUrl: p.imageUrl, sub: r.label, subColor: r.color }
      })}
      onPick={(slug) => { const p = bySlug.get(slug); if (p) choosePet(p) }}
      query={q}
      onQueryChange={setQ}
      searchPlaceholder="Search pets…"
      searchLabel="Search pets"
      rarityOptions={rarityOptions}
      rarity={rarity}
      onRarityChange={setRarity}
      emptyText="No pets match."
      detail={detail}
      onBack={() => setChosen(null)}
    />
  )
}
