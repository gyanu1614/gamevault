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
import { X, Plus, Search, ArrowLeft } from 'lucide-react'
import type { CalcPet, Variant } from './_adoptMeCalcTypes'
import { VARIANTS, VARIANT_LABEL } from './_adoptMeCalcTypes'
import { VariantAxisPicker } from './_VariantAxisPicker'

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
      <style>{`
        @keyframes amwfl-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .animate-verdict { animation: amwfl-in 260ms cubic-bezier(0.16,1,0.3,1); }
        .animate-row-in { animation: amwfl-in 200ms cubic-bezier(0.16,1,0.3,1); }
        @media (prefers-reduced-motion: reduce) { .animate-verdict, .animate-row-in { animation: none; } }
      `}</style>

      {(give.length > 0 || receive.length > 0) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setGive([]); setReceive([]) }}
            className="text-[13px] font-semibold text-[#8B978F] transition hover:text-[#C97B6B]"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Side title="You give" side="give" entries={give} petBySlug={petBySlug} total={totals.give} onAdd={() => setPicker('give')} onRemove={removeEntry} onVariant={setVariant} />
        <Side title="They offer" side="receive" entries={receive} petBySlug={petBySlug} total={totals.receive} onAdd={() => setPicker('receive')} onRemove={removeEntry} onVariant={setVariant} />
      </div>

      <Verdict
        cash={cashVerdict}
        trade={tradeVerdict}
        cashGive={totals.give.cash}
        cashRec={totals.receive.cash}
        tradeGive={totals.give.trade}
        tradeRec={totals.receive.trade}
        cashMissing={totals.give.cashMissing || totals.receive.cashMissing}
      />

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
}: {
  cash: V
  trade: V
  cashGive: number
  cashRec: number
  tradeGive: number
  tradeRec: number
  cashMissing: boolean
}) {
  // The headline follows the CASH verdict (our wedge); trade value is secondary.
  const head = cash ?? trade
  if (!head) {
    return (
      <div className="border border-[#1E2723] bg-[#0E1211] p-6 text-center">
        <p className="text-[15px] text-[#6D7A72]">Add pets to both sides to see the verdict.</p>
      </div>
    )
  }

  const headline =
    cash == null
      ? 'No cash data on these pets yet'
      : cash.label === 'Fair'
        ? 'This trade is fair'
        : cash.label === 'Win'
          ? 'This trade is a win'
          : 'This trade is a loss'

  const gapLine =
    cash == null
      ? 'Real-money verdict needs priced pets on both sides.'
      : cash.label === 'Fair'
        ? 'Both sides are within about 5% in real money.'
        : `You ${cash.diff >= 0 ? 'gain' : 'lose'} ${USD.format(Math.abs(cash.diff))} in real money.`

  return (
    <div key={`${cash?.label}-${cash?.diff}`} className="animate-verdict overflow-hidden border border-[#1E2723] bg-[#0E1211]">
      {/* Headline band — tinted by the cash verdict colour. */}
      <div
        className="flex items-center gap-4 px-5 py-4"
        style={{ backgroundColor: head.color ? `${head.color}1A` : undefined, borderBottom: `1px solid ${head.color}33` }}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center border text-[24px] font-bold" style={{ borderColor: head.color, color: head.color }}>
          {head.letter}
        </span>
        <div className="min-w-0">
          <p className="text-[19px] font-semibold leading-tight" style={{ color: head.color }}>{headline}</p>
          <p className="mt-0.5 text-[14px] text-[#C6CEC9]">{gapLine}</p>
        </div>
      </div>

      {/* Two axes side by side — real money first. */}
      <div className="grid sm:grid-cols-2">
        <Axis
          label="Real money"
          hint="DropMarket cash value"
          verdict={cash}
          give={USD.format(cashGive)}
          rec={USD.format(cashRec)}
          bordered
        />
        <Axis
          label="Trade value"
          hint="Community consensus"
          verdict={trade}
          give={TRADE.format(tradeGive)}
          rec={TRADE.format(tradeRec)}
        />
      </div>

      {cashMissing && (
        <p className="border-t border-[#1A211A] px-5 py-2.5 text-[12px] text-[#8B7BA0]">
          Some pets have no cash value yet — they&apos;re excluded from the real-money side.
        </p>
      )}
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
  const [chosen, setChosen] = useState<CalcPet | null>(null)
  // Local variant while picking, so the axis picker + price preview are live
  // before the pet is committed. Defaults to the first priced form (FR-ish).
  const [draft, setDraft] = useState<Variant>('FR')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? pets.filter((p) => p.name.toLowerCase().includes(s)) : pets
  }, [q, pets])

  // When a pet is chosen, seed the draft variant to its first priced form so
  // the preview isn't empty.
  const choosePet = (p: CalcPet) => {
    const firstPriced = VARIANTS.find((c) => p.values[c]?.cashUsd != null) ?? 'FR'
    setDraft(firstPriced)
    setChosen(p)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[10vh] backdrop-blur-sm" onClick={onClose}>
      <div className="animate-verdict w-full max-w-lg border border-[#1E2723] bg-[#0E1211] shadow-[0_28px_60px_-20px_rgba(0,0,0,0.9)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[#1E2723] px-4 py-3">
          {chosen ? (
            <>
              <button type="button" onClick={() => setChosen(null)} aria-label="Back" className="text-[#8B978F] hover:text-[#F1F3F1]">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="flex-1 text-[15px] font-semibold text-[#F1F3F1]">Pick a variant for {chosen.name}</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4 text-[#6D7A72]" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a pet…" className="w-full bg-transparent text-[16px] text-[#F1F3F1] outline-none placeholder:text-[#6D7A72]" />
            </>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#6D7A72] hover:text-[#F1F3F1]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1: pick pet */}
        {!chosen ? (
          <div className="max-h-[50vh] overflow-y-auto">
            {filtered.map((p) => (
              <button key={p.slug} type="button" onClick={() => choosePet(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.04]">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote pet art
                  <img src={p.imageUrl} alt="" className="h-8 w-8 shrink-0 object-contain" />
                ) : (
                  <span className="h-8 w-8 shrink-0 border border-[#1E2723] bg-black/20" />
                )}
                <span className="text-[14px] text-[#E6EAE7]">{p.name}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-[#6D7A72]">No pets match.</div>}
          </div>
        ) : (
          /* Step 2: two-axis variant picker — tier + Fly/Ride toggles, with a
             live price preview and a confirm. Unpriced forms are greyed. */
          <div className="max-h-[60vh] overflow-y-auto p-4">
            <VariantAxisPicker
              variant={draft}
              onChange={setDraft}
              hasCash={(code) => chosen.values[code]?.cashUsd != null}
              disableUnpriced
            />

            {/* Live preview of the selected form's value. */}
            {(() => {
              const v = chosen.values[draft]
              const priced = v?.cashUsd != null
              return (
                <div className="mt-4 flex items-center justify-between gap-3 border border-[#1E2723] bg-[#0B0F0C] px-4 py-3">
                  <span className="flex flex-col">
                    <span className="text-[13px] font-semibold text-[#E6EAE7]">
                      {chosen.name} · {VARIANT_LABEL[draft]}
                    </span>
                    <span className="text-[11px] text-[#7C8A80]">{draft}</span>
                  </span>
                  <span className="text-right">
                    {priced ? (
                      <>
                        <span className="block font-mono text-[15px] font-bold tabular-nums text-[#8FBF9C]">
                          {USD.format(v!.cashUsd!)}
                        </span>
                        {v?.tradeValue != null && (
                          <span className="block font-mono text-[11px] tabular-nums text-[#8B978F]">
                            {TRADE.format(v.tradeValue)} trade
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[12px] text-[#6D7A72]">no cash price yet</span>
                    )}
                  </span>
                </div>
              )
            })()}

            <button
              type="button"
              onClick={() => onPick(chosen.slug, draft)}
              disabled={chosen.values[draft]?.cashUsd == null}
              className="mt-4 w-full bg-[#1B6B3F] py-3 text-[14px] font-semibold text-white transition hover:bg-[#1f7a48] disabled:cursor-not-allowed disabled:bg-[#1E2723] disabled:text-[#6D7A72]"
            >
              Add {chosen.name} · {draft}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
