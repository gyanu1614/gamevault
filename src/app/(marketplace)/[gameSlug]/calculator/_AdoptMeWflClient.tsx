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
 * Design: dark neutral chrome (never a native <select>). Adding a pet is a
 * two-step modal (pick pet → pick variant). Each row shows a bold price + a
 * segmented variant pill row. The verdict states the real-money gap in words.
 */

import { useMemo, useState } from 'react'
import { X, Plus, Search, ArrowLeft, ArrowLeftRight, Pencil } from 'lucide-react'
import type { CalcPet, Variant } from './_adoptMeCalcTypes'
import { VARIANTS, VARIANT_LABEL } from './_adoptMeCalcTypes'
import { VariantAxisPicker } from './_VariantAxisPicker'
import { CompactVariantPicker } from '../values/_CompactVariantPicker'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const TRADE = new Intl.NumberFormat('en-US')

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
  // Once both sides have pets we collapse the big adders to one-line summaries
  // and float the verdict to the top. "Edit" reopens the full panels.
  const [editing, setEditing] = useState(false)

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
      let cash = 0
      let cashMissing = false
      for (const e of list) {
        const v = petBySlug.get(e.slug)?.values[e.variant]
        trade += v?.tradeValue ?? 0
        if (v?.cashUsd != null) cash += v.cashUsd
        else cashMissing = true
      }
      return { trade, cash, cashMissing }
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
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes amwfl-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes amwfl-pop { 0% { opacity: 0; transform: scale(0.82); } 60% { transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
        .animate-verdict { animation: amwfl-in 260ms cubic-bezier(0.16,1,0.3,1); }
        .animate-pop { animation: amwfl-pop 460ms cubic-bezier(0.16,1,0.3,1); }
        .animate-row-in { animation: amwfl-in 200ms cubic-bezier(0.16,1,0.3,1); }
        .amwfl-fill { transition: clip-path 900ms cubic-bezier(0.16,1,0.3,1); }
        @media (prefers-reduced-motion: reduce) { .animate-verdict, .animate-pop, .animate-row-in { animation: none; } .amwfl-fill { transition: none; } }
      `,
        }}
      />

      {(give.length > 0 || receive.length > 0) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setGive([]); setReceive([]); setEditing(false) }}
            className="text-[13px] font-semibold text-[#8B978F] transition hover:text-[#C97B6B]"
          >
            Clear all
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
              <Side title="You give" side="give" entries={give} petBySlug={petBySlug} total={totals.give} onAdd={() => setPicker('give')} onRemove={removeEntry} onVariant={setVariant} />
              <Side title="They offer" side="receive" entries={receive} petBySlug={petBySlug} total={totals.receive} onAdd={() => setPicker('receive')} onRemove={removeEntry} onVariant={setVariant} />
            </div>
            {bothFilled && editing && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#2F6B46] bg-[#1B6B3F] px-4 py-2 text-body-sm font-semibold text-white transition hover:bg-[#1f7a48]"
                >
                  Done editing
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

      {picker && (
        <PetPicker pets={pets} onPick={(slug, variant) => addPet(picker, slug, variant)} onClose={() => setPicker(null)} />
      )}
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
  return (
    <div className="border border-[#1E2723] bg-[#0F1311]">
      <div className="flex items-center justify-between border-b border-[#1E2723] px-4 py-3">
        <span className="text-[14px] font-semibold text-[#F1F3F1]">{title}</span>
        <span className="text-[12px] text-[#8B978F]">{entries.length} item{entries.length === 1 ? '' : 's'}</span>
      </div>

      <div className="space-y-2 p-3">
        {entries.length === 0 ? (
          <div className="px-1 py-6 text-center text-[13px] text-[#6D7A72]">No pets added yet.</div>
        ) : (
          entries.map((e) => {
            const pet = petBySlug.get(e.slug)
            if (!pet) return null
            const v = pet.values[e.variant]
            return (
              <div key={e.id} className="animate-row-in border border-[#1E2723] bg-[#0E1211] p-3">
                <div className="mb-2.5 flex items-center gap-3">
                  {pet.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote pet art
                    <img src={pet.imageUrl} alt="" className="h-10 w-10 shrink-0 object-contain" />
                  ) : (
                    <span className="h-10 w-10 shrink-0 border border-[#1E2723] bg-black/20" />
                  )}
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#E6EAE7]">{pet.name}</p>
                  <div className="text-right">
                    <p className="font-mono text-[18px] font-bold leading-none tabular-nums text-[#8FBF9C]">
                      {v?.cashUsd != null ? USD.format(v.cashUsd) : '—'}
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] tabular-nums text-[#8B978F]">
                      {v?.tradeValue != null ? `${TRADE.format(v.tradeValue)} trade` : 'no cash'}
                    </p>
                  </div>
                  <button type="button" onClick={() => onRemove(side, e.id)} aria-label="Remove" className="shrink-0 text-[#6D7A72] transition hover:text-[#C97B6B]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* Two-axis variant picker: tier (Default/Neon/Mega) + Fly/Ride
                    toggles. Unpriced (no-cash) forms are greyed and blocked. */}
                <VariantAxisPicker
                  variant={e.variant}
                  onChange={(code) => onVariant(side, e.id, code)}
                  hasCash={(code) => pet.values[code]?.cashUsd != null}
                  disableUnpriced
                />
                <p className="mt-1.5 text-[11px] text-[#6D7A72]">
                  {VARIANT_LABEL[e.variant]}
                </p>
              </div>
            )
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#1E2723] px-4 py-3">
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 border border-[#26332C] bg-white/[0.03] px-3 py-2 text-[13px] font-semibold text-[#C6CEC9] transition hover:border-[#2A3A31] hover:bg-white/[0.06]">
          <Plus className="h-4 w-4" /> Add pet
        </button>
        {entries.length > 0 ? (
          <div className="text-right">
            <p className="font-mono text-[16px] font-bold leading-none tabular-nums text-[#8FBF9C]">{USD.format(total.cash)}</p>
            <p className="mt-0.5 text-[12px] text-[#8B978F]"><span className="font-mono tabular-nums">{TRADE.format(total.trade)}</span> trade</p>
          </div>
        ) : (
          <span className="text-[12px] text-[#6D7A72]">Total shows here</span>
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
        const price = (
          <p className="shrink-0 font-mono text-body-sm font-bold tabular-nums text-[#8FBF9C]">
            {v?.cashUsd != null ? USD.format(v.cashUsd) : '—'}
          </p>
        )
        const art = pet.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote pet art
          <img src={pet.imageUrl} alt="" className="h-9 w-9 shrink-0 object-contain" />
        ) : (
          <span className="h-9 w-9 shrink-0 border border-[#1E2723] bg-black/20" />
        )
        return (
          <li key={e.id} className={`flex items-center gap-2.5 ${right ? 'flex-row-reverse text-right' : ''}`}>
            {art}
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-semibold text-[#E6EAE7]">{pet.name}</p>
              <p className="truncate text-caption text-[#6D7A72]">{VARIANT_LABEL[e.variant]}</p>
            </div>
            {price}
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
      <div className="flex flex-col items-center gap-3 border border-dashed border-[#26332C] bg-[#0E1211] px-6 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#2C3A31] text-[#6D7A72]">
          <ArrowLeftRight className="h-5 w-5" />
        </span>
        <div>
          <p className="text-body font-semibold text-[#C6CEC9]">Build both sides of the trade</p>
          <p className="mt-1 text-body-sm text-[#8B978F]">{prompt}</p>
        </div>
      </div>
    )
  }

  // The headline follows the CASH verdict (our wedge); trade value is secondary.
  const head = cash ?? trade
  if (!head) {
    return (
      <div className="border border-[#1E2723] bg-[#0E1211] p-6 text-center">
        <p className="text-[15px] text-[#6D7A72]">No cash or trade data on these pets yet.</p>
      </div>
    )
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
    <div key={`${cash?.label}-${cash?.diff}`} className="animate-verdict overflow-hidden rounded-lg border border-[#1E2723] bg-[#0E1211] p-5 sm:p-6">
      {/* Edit — top-right, reopens the full pickers (collapsed view only). */}
      {onEdit && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#26332C] bg-white/[0.03] px-3 py-1.5 text-caption font-semibold text-[#C6CEC9] transition hover:border-[#2A3A31] hover:bg-white/[0.06]"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </div>
      )}

      {/* ── Tug-of-war: each side shows its pets + total; the meter leans to the
          heavier side; the verdict word pops in. ─────────────────────────── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
        <BalanceSide label="You give" accent="#5AC8FA" cash={USD.format(cashGive)} pts={`${TRADE.format(tradeGive)} trade`} lines={giveLines} />
        <div className="flex items-center justify-center text-caption font-extrabold text-[#6D7A72]">VS</div>
        <BalanceSide label="They offer" accent="#B07BC9" cash={USD.format(cashRec)} pts={`${TRADE.format(tradeRec)} trade`} align="right" lines={recLines} />
      </div>

      {/* Weighted balance bar */}
      <div className="relative mt-5 h-3.5 overflow-hidden rounded-full border border-[#1E2723] bg-[#0B0F0D]">
        <div
          className="amwfl-fill absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #5AC8FA, #B07BC9)',
            clipPath: `inset(0 ${((1 - getShare) * 100).toFixed(1)}% 0 0)`,
          }}
        />
        {/* center "fair" tick */}
        <div className="absolute -top-1 bottom-[-4px] left-1/2 w-0.5 -translate-x-1/2 bg-[#3A423C]" />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6D7A72]">
        <span style={{ color: '#5AC8FA' }}>Your side</span>
        <span>Fair</span>
        <span style={{ color: '#B07BC9' }}>Their side</span>
      </div>

      {/* Verdict word — pops in, tinted by the cash verdict. */}
      <div key={`${head.letter}-${cash?.diff}`} className="animate-pop mt-6 flex flex-col items-center gap-2 text-center">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-lg border text-[22px] font-extrabold"
          style={{ borderColor: head.color, color: head.color, background: `${head.color}18` }}
        >
          {head.letter}
        </span>
        <p className="text-[24px] font-extrabold leading-tight tracking-[-0.01em]" style={{ color: head.color }}>
          {headline}
        </p>
        <p className="text-body-sm text-[#C6CEC9]">{gapLine}</p>
      </div>

      {/* Detail axes — real money + trade value, quieter, below the fold. */}
      <div className="mt-6 grid overflow-hidden rounded-md border border-[#1A211A] sm:grid-cols-2">
        <Axis label="Real money" hint="DropMarket cash value" verdict={cash} give={USD.format(cashGive)} rec={USD.format(cashRec)} bordered />
        <Axis label="Trade value" hint="Community consensus" verdict={trade} give={TRADE.format(tradeGive)} rec={TRADE.format(tradeRec)} />
      </div>

      {cashMissing && (
        <p className="mt-3 text-[12px] text-[#8B7BA0]">
          Some pets have no cash value yet — they&apos;re excluded from the real-money side.
        </p>
      )}
    </div>
  )
}

/** One side of the tug-of-war header — colored cap + cash headline + trade sub. */
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
      <div className="rounded-md border bg-[#0E1211] px-4 py-3" style={{ borderColor: `${accent}44` }}>
        <div className={`flex items-baseline justify-between gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: accent }}>{label}</span>
          <span className="text-[18px] font-extrabold tabular-nums text-[#F1F3F1]">{cash}</span>
        </div>
        <div className="mt-3">{lines}</div>
      </div>
    )
  }
  // Without lines: just the label + total (used before pets exist).
  return (
    <div
      className={`rounded-md border bg-[#0E1211] px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}
      style={{ borderColor: `${accent}44` }}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: accent }}>{label}</span>
      <p className="mt-1 text-[22px] font-extrabold tabular-nums text-[#F1F3F1]">{cash}</p>
      <p className="mt-0.5 text-caption tabular-nums text-[#8B978F]">{pts}</p>
    </div>
  )
}

function Axis({
  label,
  hint,
  verdict,
  give,
  rec,
  bordered,
}: {
  label: string
  hint: string
  verdict: V
  give: string
  rec: string
  bordered?: boolean
}) {
  return (
    <div className={`px-5 py-4 ${bordered ? 'border-b border-[#1A211A] sm:border-b-0 sm:border-r' : ''}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-[#C6CEC9]">{label}</span>
        {verdict && (
          <span className="text-[13px] font-semibold" style={{ color: verdict.color }}>
            {verdict.label} · {Math.abs(verdict.pct).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-[12px] text-[#6D7A72]">{hint}</p>
      <div className="mt-2.5 flex items-center justify-between text-[14px] text-[#9BA8A0]">
        <span>you give <span className="font-mono font-semibold text-[#E6EAE7]">{give}</span></span>
        <span className="text-[#6D7A72]">→</span>
        <span>get <span className="font-mono font-semibold text-[#E6EAE7]">{rec}</span></span>
      </div>
    </div>
  )
}

/* ── Two-step pet picker: pick pet → pick variant ────────────────────────── */
/* Rarity filters for the picker sidebar — only what our data actually has. */
const PICKER_RARITIES: { key: string; label: string; color: string }[] = [
  { key: 'all', label: 'All Pets', color: '#E8EDE9' },
  { key: 'legendary', label: 'Legendary', color: '#F5C542' },
  { key: 'ultra_rare', label: 'Ultra-Rare', color: '#B07BC9' },
  { key: 'rare', label: 'Rare', color: '#4FB477' },
  { key: 'uncommon', label: 'Uncommon', color: '#7FE3F0' },
  { key: 'common', label: 'Common', color: '#9BA8A0' },
]

function PetPicker({
  pets,
  onPick,
  onClose,
}: {
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

  // Rarities actually present, so the sidebar never shows an empty filter.
  const raritiesPresent = useMemo(
    () => new Set(pets.map((p) => p.rarity)),
    [pets],
  )
  const sidebar = PICKER_RARITIES.filter((r) => r.key === 'all' || raritiesPresent.has(r.key))

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return pets.filter((p) => {
      if (rarity !== 'all' && p.rarity !== rarity) return false
      if (s && !p.name.toLowerCase().includes(s)) return false
      return true
    })
  }, [q, rarity, pets])

  // When a pet is chosen, seed the draft variant to its first priced form so
  // the preview isn't empty.
  const choosePet = (p: CalcPet) => {
    const firstPriced = VARIANTS.find((c) => p.values[c]?.cashUsd != null) ?? 'FR'
    setDraft(firstPriced)
    setChosen(p)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className={`animate-verdict flex flex-col overflow-hidden rounded-lg border border-[#1E2723] bg-[#0C0F0E] shadow-[0_28px_60px_-20px_rgba(0,0,0,0.9)] ${
          chosen ? 'w-full max-w-md' : 'h-[82vh] w-full max-w-5xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header: title + search (grid) OR back + name (variant step) ─── */}
        <div className="flex items-center gap-3 border-b border-[#1E2723] px-4 py-3 sm:px-5">
          {chosen ? (
            <>
              <button type="button" onClick={() => setChosen(null)} aria-label="Back" className="text-[#8B978F] transition hover:text-[#F1F3F1]">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="flex-1 text-body font-bold text-[#F1F3F1]">Choose A Variant</span>
            </>
          ) : (
            <>
              <span className="text-body font-bold text-[#F1F3F1]">Choose A Pet</span>
              <div className="relative ml-auto w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6D7A72]" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search pets…"
                  className="h-10 w-full rounded-md border border-[#1E2723] bg-white/[0.04] pl-9 pr-3 text-body-sm text-[#F1F3F1] outline-none transition-colors placeholder:text-[#6D7A72] focus:border-[#2F6B46]"
                />
              </div>
            </>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-[#6D7A72] transition hover:text-[#F1F3F1]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1: rarity sidebar + dense pet grid */}
        {!chosen ? (
          <div className="flex min-h-0 flex-1">
            {/* Sidebar — rarity filters */}
            <nav className="hidden w-40 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[#1E2723] p-3 sm:flex">
              {sidebar.map((r) => {
                const on = rarity === r.key
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRarity(r.key)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-body-sm font-semibold transition-colors"
                    style={
                      on
                        ? { backgroundColor: `${r.color}1E`, color: r.color }
                        : { color: '#9BA8A0' }
                    }
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.color }} />
                    {r.label}
                  </button>
                )
              })}
            </nav>

            {/* Grid */}
            <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {/* Mobile rarity chips (sidebar hidden on small screens) */}
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 sm:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {sidebar.map((r) => {
                  const on = rarity === r.key
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRarity(r.key)}
                      className="shrink-0 rounded-full border px-3 py-1.5 text-caption font-semibold transition"
                      style={on ? { backgroundColor: r.color, borderColor: r.color, color: '#0B0810' } : { borderColor: '#2C3A31', color: '#9BA8A0' }}
                    >
                      {r.label}
                    </button>
                  )
                })}
              </div>

              {filtered.length === 0 ? (
                <div className="flex h-full items-center justify-center text-body-sm text-[#6D7A72]">No pets match.</div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                  {filtered.map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => choosePet(p)}
                      className="group flex flex-col items-center gap-1.5 rounded-md border border-[#1E2723] bg-[#0E1211] p-2.5 text-center transition hover:border-[#2C3A31] hover:bg-white/[0.03]"
                    >
                      <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded bg-black/20">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote pet art
                          <img src={p.imageUrl} alt="" className="h-full w-full object-contain p-1 transition group-hover:scale-105" />
                        ) : (
                          <span className="text-[10px] text-[#5E685E]">No image</span>
                        )}
                      </span>
                      <span className="line-clamp-2 text-caption font-semibold leading-tight text-[#E6EAE7]">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Step 2: compact card — pet preview (art + name + rarity + live
             value) over the two-axis variant picker + Add. */
          (() => {
            const v = chosen.values[draft]
            const priced = v?.cashUsd != null
            const rMeta = PICKER_RARITIES.find((r) => r.key === chosen.rarity)
            return (
              <div className="overflow-y-auto p-5">
                {/* Pet preview — compact: small art + name + rarity + live value. */}
                <div className="flex items-center gap-4 rounded-lg border border-[#1E2723] bg-[#0E1211] px-4 py-3.5">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden">
                    {chosen.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote pet art
                      <img src={chosen.imageUrl} alt={chosen.name} className="h-full w-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]" />
                    ) : (
                      <span className="text-[10px] text-[#5E685E]">No image</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-bold text-[#F1F3F1]">{chosen.name}</p>
                    {rMeta && (
                      <span className="mt-0.5 inline-flex items-center gap-1.5 text-caption font-semibold" style={{ color: rMeta.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: rMeta.color }} />
                        {rMeta.label}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[20px] font-extrabold tabular-nums text-[#8FBF9C]">
                      {priced ? USD.format(v!.cashUsd!) : <span className="text-body-sm text-[#6D7A72]">No price</span>}
                    </p>
                    <p className="text-caption tabular-nums text-[#8B978F]">
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
                    accent="#B07BC9"
                    showSelected={false}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onPick(chosen.slug, draft)}
                  disabled={chosen.values[draft]?.cashUsd == null}
                  className="mt-5 w-full rounded-md bg-[#1B6B3F] py-3 text-body-sm font-semibold text-white transition hover:bg-[#1f7a48] disabled:cursor-not-allowed disabled:bg-[#1E2723] disabled:text-[#6D7A72]"
                >
                  Add {chosen.name}
                </button>
              </div>
            )
          })()
        )}
      </div>
    </div>
  )
}
