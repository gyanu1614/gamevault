'use client'

/**
 * Fees tab — one panel per enabled (game, category) pair
 * (docs/design/fee-engine.md §5.1). Per pair it shows what
 * resolve_seller_fee(NULL, pair) returns right now, the rule that produced
 * it, the dated rules still to come, running/scheduled promotions and (for
 * accounts) the risk band. Edits go through src/lib/actions/admin-fees.ts;
 * nothing here computes or trusts a rate — every number on screen came back
 * from the database after the write.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarBlank, Tag, Warning, X } from '@phosphor-icons/react'
import { adminBtn, adminBtnSm } from '../../components/kit'

import {
  cancelScheduledBaseRule,
  createPromoFeeRule,
  endPromoFeeRule,
  fetchPairFeeState,
  scheduleBaseFeeRule,
  setAccountRiskBand,
  type FeeRuleRow,
  type PairFeeState,
} from '@/lib/actions/admin-fees'
import { ACCOUNT_RISK_BAND_PCT, fmtUtcDate, type AccountRiskBandKey } from '@/lib/fees/admin-rules'

type PairRow = { id: string; slug: string; name: string; type: string; is_enabled: boolean }

// Inputs sit on a bg-bg-overlay form box, so one step lighter; 16px on phones (no iOS zoom).
const INPUT =
  'h-10 w-full rounded-md border border-transparent bg-bg-overlay-2 px-3 text-base text-text-primary placeholder:text-text-disabled ' +
  'transition-colors hover:border-white/[0.08] focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft sm:text-sm'
const LABEL = 'mb-1.5 block text-[12.5px] font-medium text-text-secondary'
const BTN = `${adminBtn.primary} w-full`
const BTN_GHOST = adminBtnSm.secondary
const FORM_BOX = 'space-y-3 rounded-md bg-bg-overlay p-4'

const TYPE_LABEL: Record<string, string> = {
  currency: 'Currency', items: 'Items', account: 'Accounts', top_up: 'Top-Ups', service: 'Boosting / Services', gift_card: 'Gift Cards',
}

const pct = (n: number) => `${Number(n).toFixed(2).replace(/\.?0+$/, '')}%`

export function FeesTab({ rows, gameName }: { rows: PairRow[]; gameName: string }) {
  const pairs = rows.filter((r) => r.is_enabled)
  if (pairs.length === 0) {
    return (
      <div className="rounded-lg bg-bg-raised px-6 py-10 text-center">
        <p className="text-[14px] font-semibold text-text-primary">No categories are enabled for {gameName}.</p>
        <p className="mt-1.5 text-[12.5px] text-text-secondary">Enable one in the Setup tab&apos;s Categories step, then set its fee here.</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-text-secondary">
        Seller commission per category, read from the live fee table. A new base rate needs the notice period before it
        starts; promotions can start today but must end. Every change is audited and republishes the public fee pages.
      </p>
      {pairs.map((p) => (
        <PairFeePanel key={p.id} pair={p} />
      ))}
    </div>
  )
}

function PairFeePanel({ pair }: { pair: PairRow }) {
  const qc = useQueryClient()
  const key = ['admin-pair-fee', pair.id]
  const query = useQuery({ queryKey: key, queryFn: () => fetchPairFeeState(pair.id), staleTime: 10_000 })
  const refresh = () => qc.invalidateQueries({ queryKey: key })
  const state = query.data

  if (query.isLoading) {
    return (
      <div className="rounded-lg bg-bg-raised p-4 sm:p-5" aria-busy aria-label={`Loading ${pair.name || pair.slug}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="skeleton h-4 w-40 rounded" />
            <div className="skeleton mt-2 h-3 w-72 max-w-full rounded" />
          </div>
          <div className="skeleton h-8 w-16 rounded" />
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div className="skeleton h-56 rounded-md" />
          <div className="skeleton h-56 rounded-md" />
          <div className="skeleton h-56 rounded-md" />
        </div>
      </div>
    )
  }
  if (!state) {
    return (
      <div className="rounded-lg bg-error-bg p-4 text-[13px] text-error">
        Could not load the fee state for {pair.name || pair.slug}.
      </div>
    )
  }

  const via =
    state.resolved.fallback
      ? 'hard-coded fallback — no fee rule matched'
      : state.current_rule
        ? `${state.current_rule.kind === 'promo' ? 'promotion' : 'base rate'} · ${state.current_rule.scope === 'game_category' ? 'this category' : `${TYPE_LABEL[state.pair.type] ?? state.pair.type} default`} · since ${fmtUtcDate(state.current_rule.starts_at)}${state.current_rule.ends_at ? ` until ${fmtUtcDate(state.current_rule.ends_at)}` : ''}`
        : 'no rule'

  return (
    <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-text-primary">{state.pair.name || pair.slug}</h3>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11.5px] font-semibold text-text-secondary">
              {TYPE_LABEL[state.pair.type] ?? state.pair.type}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-text-secondary">
            Current headline rate: <b className="text-text-primary">{pct(state.resolved.pct)}</b> — {via}
          </p>
          {state.category_default && (
            <p className="mt-0.5 text-[12px] text-text-tertiary">
              Category default: {pct(state.category_default.pct)} since {fmtUtcDate(state.category_default.starts_at)}
              {state.resolved.rule_scope === 'game_category' ? ' (overridden for this game)' : ''}
            </p>
          )}
          {state.resolved.fallback && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-warning">
              <Warning aria-hidden weight="bold" className="h-3.5 w-3.5" /> This pair resolves through the fallback — add a rule.
            </p>
          )}
        </div>
        <div className="sm:text-right">
          <p className="text-[12px] font-medium text-text-tertiary">Sellers Pay</p>
          <p className="text-[30px] font-extrabold leading-none tabular-nums text-text-primary">{pct(state.resolved.pct)}</p>
          {state.pair.type === 'account' && (
            <p className="mt-1 text-[11.5px] text-text-secondary">
              Risk band: <b className="text-text-primary">{state.risk_band ?? 'category default'}</b>
            </p>
          )}
        </div>
      </header>

      <Timeline state={state} onChanged={refresh} />

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <BaseRateForm state={state} onChanged={refresh} />
        <PromoForm state={state} onChanged={refresh} />
        {state.pair.type === 'account' ? (
          <RiskBandForm state={state} onChanged={refresh} />
        ) : (
          <div className="rounded-md bg-bg-overlay p-4 text-[12.5px] leading-relaxed text-text-tertiary">
            Rank discounts and the founding programme apply on top of this rate per seller; they are platform settings,
            not per-category.
          </div>
        )}
      </div>
    </section>
  )
}

function Timeline({ state, onChanged }: { state: PairFeeState; onChanged: () => void }) {
  const cancel = useMutation({
    mutationFn: (ruleId: string) => cancelScheduledBaseRule({ ruleId }),
    onSuccess: (res) => { if (!res.success) return toast.error(res.error); toast.success('Scheduled rate cancelled'); onChanged() },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  })
  const end = useMutation({
    mutationFn: (ruleId: string) => endPromoFeeRule({ ruleId }),
    onSuccess: (res) => { if (!res.success) return toast.error(res.error); toast.success('Promotion ended'); onChanged() },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  })
  const items: Array<{ rule: FeeRuleRow; label: string; action?: { text: string; run: () => void; busy: boolean } }> = []
  for (const r of state.upcoming) {
    items.push({
      rule: r,
      label: `${pct(r.pct)} ${r.scope === 'game_category' ? 'for this category' : `${TYPE_LABEL[r.category_type] ?? r.category_type} default`} from ${fmtUtcDate(r.starts_at)}${r.ends_at ? ` to ${fmtUtcDate(r.ends_at)}` : ''}${r.note ? ` — ${r.note}` : ''}`,
      action: r.scope === 'game_category' ? { text: 'Cancel', run: () => cancel.mutate(r.id), busy: cancel.isPending } : undefined,
    })
  }
  for (const r of state.promos) {
    const started = r.starts_at <= new Date().toISOString()
    items.push({
      rule: r,
      label: `Promo ${pct(r.pct)} ${started ? 'running' : 'scheduled'} ${fmtUtcDate(r.starts_at)} → ${r.ends_at ? fmtUtcDate(r.ends_at) : '∞'}${r.note ? ` — ${r.note}` : ''}`,
      action: { text: started ? 'End now' : 'Remove', run: () => end.mutate(r.id), busy: end.isPending },
    })
  }
  if (items.length === 0) {
    return <p className="mt-4 text-[12px] text-text-tertiary">Nothing scheduled — the rate above stays until a new rule is added.</p>
  }
  return (
    <ul className="mt-4 divide-y divide-white/[0.06] rounded-md bg-bg-overlay">
      {items.map(({ rule, label, action }) => (
        <li key={rule.id} className="flex flex-col gap-2 px-3.5 py-2.5 text-[12.5px] text-text-secondary sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="inline-flex items-start gap-2">
            {rule.kind === 'promo' ? (
              <Tag aria-hidden weight="bold" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-text" />
            ) : (
              <CalendarBlank aria-hidden weight="bold" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            )}
            {label}
          </span>
          {action && (
            <button type="button" className={`${BTN_GHOST} self-start sm:self-auto`} disabled={action.busy} onClick={action.run}>
              <X aria-hidden weight="bold" className="h-3.5 w-3.5" /> {action.text}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function BaseRateForm({ state, onChanged }: { state: PairFeeState; onChanged: () => void }) {
  const earliest = fmtUtcDate(state.earliest_start)
  const [rate, setRate] = useState('')
  const [date, setDate] = useState(earliest)
  const [note, setNote] = useState('')
  const m = useMutation({
    mutationFn: () => scheduleBaseFeeRule({ gameCategoryId: state.pair.id, pct: rate, startsAt: date, note }),
    onSuccess: (res) => {
      if (!res.success) return toast.error(res.error)
      toast.success(`Base rate ${pct(res.rule.pct)} scheduled from ${fmtUtcDate(res.rule.starts_at)}`)
      setRate(''); setNote(''); onChanged()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  })
  return (
    <form className={FORM_BOX} onSubmit={(e) => { e.preventDefault(); m.mutate() }}>
      <p className="text-[13.5px] font-semibold text-text-primary">New Base Rate</p>
      <div>
        <label className={LABEL}>Rate %</label>
        <input className={INPUT} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 10" />
      </div>
      <div>
        <label className={LABEL}>Starts (UTC)</label>
        <input className={INPUT} type="date" min={earliest} value={date} onChange={(e) => setDate(e.target.value)} />
        <p className="mt-1 text-[12px] text-text-tertiary">Needs {state.notice_days} days&apos; notice — earliest {earliest}.</p>
      </div>
      <div>
        <label className={LABEL}>Note</label>
        <input className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} placeholder="why (optional)" maxLength={200} />
      </div>
      <button type="submit" className={BTN} disabled={m.isPending || !rate || !date}>
        {m.isPending ? 'Scheduling…' : 'Schedule Base Rate'}
      </button>
    </form>
  )
}

function PromoForm({ state, onChanged }: { state: PairFeeState; onChanged: () => void }) {
  const [rate, setRate] = useState('0')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [note, setNote] = useState('')
  const m = useMutation({
    mutationFn: () => createPromoFeeRule({ gameCategoryId: state.pair.id, pct: rate, startsAt: start, endsAt: end, note }),
    onSuccess: (res) => {
      if (!res.success) return toast.error(res.error)
      toast.success(`Promotion ${pct(res.rule.pct)} until ${fmtUtcDate(res.rule.ends_at!)}`)
      setEnd(''); setNote(''); onChanged()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  })
  return (
    <form className={FORM_BOX} onSubmit={(e) => { e.preventDefault(); m.mutate() }}>
      <p className="text-[13.5px] font-semibold text-text-primary">Promotion</p>
      <div>
        <label className={LABEL}>Rate %</label>
        <input className={INPUT} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Starts</label>
          <input className={INPUT} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Ends *</label>
          <input className={INPUT} type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={LABEL}>Note</label>
        <input className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} placeholder="campaign (optional)" maxLength={200} />
      </div>
      <p className="text-[12px] text-text-tertiary">Blank start = now. No notice period; the end date is required.</p>
      <button type="submit" className={BTN} disabled={m.isPending || !end}>
        {m.isPending ? 'Adding…' : 'Add Promotion'}
      </button>
    </form>
  )
}

function RiskBandForm({ state, onChanged }: { state: PairFeeState; onChanged: () => void }) {
  const earliest = fmtUtcDate(state.earliest_start)
  const initial = useMemo<AccountRiskBandKey>(() => (state.risk_band && state.risk_band !== 'custom' ? state.risk_band : 'mid'), [state.risk_band])
  const [band, setBand] = useState<AccountRiskBandKey>(initial)
  const [date, setDate] = useState(earliest)
  const m = useMutation({
    mutationFn: () => setAccountRiskBand({ gameCategoryId: state.pair.id, band, startsAt: date }),
    onSuccess: (res) => {
      if (!res.success) return toast.error(res.error)
      toast.success(`Risk band ${band} (${pct(res.rule.pct)}) from ${fmtUtcDate(res.rule.starts_at)}`)
      onChanged()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  })
  return (
    <form className={FORM_BOX} onSubmit={(e) => { e.preventDefault(); m.mutate() }}>
      <p className="text-[13.5px] font-semibold text-text-primary">Account Risk Band</p>
      <div>
        <label className={LABEL}>Band</label>
        <select className={`${INPUT} cursor-pointer`} value={band} onChange={(e) => setBand(e.target.value as AccountRiskBandKey)}>
          {(Object.keys(ACCOUNT_RISK_BAND_PCT) as AccountRiskBandKey[]).map((b) => (
            <option key={b} value={b}>{b} — {ACCOUNT_RISK_BAND_PCT[b]}%</option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>Starts (UTC)</label>
        <input className={INPUT} type="date" min={earliest} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <p className="text-[12px] text-text-tertiary">
        A band is a base rate for this game&apos;s accounts — same {state.notice_days}-day notice.
      </p>
      <button type="submit" className={BTN} disabled={m.isPending || !date}>
        {m.isPending ? 'Saving…' : 'Set Risk Band'}
      </button>
    </form>
  )
}
