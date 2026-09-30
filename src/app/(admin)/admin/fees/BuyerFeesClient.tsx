'use client'

/**
 * Buyer fee editor (checkout B3) — a tab of /admin/fees. One card per
 * payment_method_fees entry (labelled number fields + three switches; the old
 * 15-column table was unusable on a phone), a panel for currency_rates and
 * the recent changes. Every number on screen came back from the database
 * after the write; the client trusts nothing it typed.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CircleNotch, FloppyDisk, MagnifyingGlass } from '@phosphor-icons/react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import {
  updateCurrencyRate,
  updatePaymentMethodFee,
  type AuditRow,
  type CurrencyRateRow,
  type PaymentMethodFeeRow,
} from '@/lib/actions/admin-buyer-fees'
import { AdminPanel, LabeledField, PanelHead, adminBtnSm, adminFieldCls, adminNumCls } from '../components/kit'

const INPUT = adminNumCls
const BTN = adminBtnSm.primary

const PROVIDER_LABEL: Record<string, string> = { payssion: 'Payssion', btcpay: 'BTCPay', coingate: 'CoinGate', wallet: 'Wallet', fake: 'Test' }

const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'

type Draft = {
  provider_pct: string
  provider_fixed_minor: string
  fx_markup_pct: string
  buffer_pct: string
  floor_pct: string
  min_fee_minor: string
  min_total_minor: string
  max_total_minor: string
  refundable: boolean
  instant_clearing: boolean
  selectable: boolean
}
const toDraft = (r: PaymentMethodFeeRow): Draft => ({
  provider_pct: String(r.provider_pct),
  provider_fixed_minor: String(r.provider_fixed_minor),
  fx_markup_pct: String(r.fx_markup_pct),
  buffer_pct: String(r.buffer_pct),
  floor_pct: String(r.floor_pct),
  min_fee_minor: String(r.min_fee_minor),
  min_total_minor: r.min_total_minor == null ? '' : String(r.min_total_minor),
  max_total_minor: r.max_total_minor == null ? '' : String(r.max_total_minor),
  refundable: r.refundable,
  instant_clearing: r.instant_clearing,
  selectable: r.selectable,
})

export default function BuyerFeesClient({ initial }: { initial: { methods: PaymentMethodFeeRow[]; rates: CurrencyRateRow[]; audit: AuditRow[] } }) {
  const [methods, setMethods] = useState(initial.methods)
  const [rates, setRates] = useState(initial.rates)
  const [audit, setAudit] = useState(initial.audit)
  // 25+ methods: narrow the cards by name, code or provider.
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const shown = needle
    ? methods.filter((m) =>
        `${m.label} ${m.method} ${PROVIDER_LABEL[m.provider] ?? m.provider} ${m.fee_currency}`.toLowerCase().includes(needle),
      )
    : methods

  return (
    <div className="space-y-5">
      <PanelHead
        title="Buyer Processing Fees"
        subtitle="Per payment method: the provider’s rate on the full amount, any fixed charge (fee currency, minor units), currency-conversion markup, buffer, the floor share of the item price, minimum and provider cap. Checkout quotes every order from these; each change is audited and republishes /fees."
        className="mb-0"
      />

      <div className="relative max-w-sm">
        <MagnifyingGlass
          aria-hidden
          weight="bold"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter methods (e.g. Payssion, PLN, pix)"
          aria-label="Filter payment methods"
          className={cn(adminFieldCls, 'pl-9 [&::-webkit-search-cancel-button]:hidden')}
        />
      </div>

      {shown.length === 0 && <p className="text-[13px] text-text-tertiary">No method matches “{q}”.</p>}

      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
        {shown.map((row) => (
          <MethodRow
            key={row.method}
            row={row}
            onSaved={(updated, entry) => {
              setMethods((m) => m.map((x) => (x.method === updated.method ? updated : x)))
              setAudit((a) => [entry, ...a].slice(0, 20))
            }}
          />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminPanel>
          <PanelHead
            title="Currency Rates"
            subtitle="USD per unit. Converts fixed fees, minimums and caps into the order currency. Approximate by design — the buffer covers drift."
          />
          <div className="divide-y divide-white/[0.06]">
            {rates.map((r) => (
              <RateRow
                key={r.currency}
                row={r}
                onSaved={(updated, entry) => {
                  setRates((rs) => rs.map((x) => (x.currency === updated.currency ? updated : x)))
                  setAudit((a) => [entry, ...a].slice(0, 20))
                }}
              />
            ))}
          </div>
          <NewRate onSaved={(updated, entry) => { setRates((rs) => [...rs, updated].sort((a, b) => a.currency.localeCompare(b.currency))); setAudit((a) => [entry, ...a].slice(0, 20)) }} />
        </AdminPanel>

        <AdminPanel>
          <PanelHead title="Recent Changes" />
          {audit.length === 0 ? (
            <p className="text-[13px] text-text-tertiary">No buyer-fee edits yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06] text-[13px]">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <span className="min-w-0 truncate text-text-primary">
                    <span className="text-text-tertiary">{a.scope === 'currency_rate' ? 'Rate' : 'Method'}</span> {a.key}
                  </span>
                  <span className="whitespace-nowrap text-[12px] text-text-tertiary">{fmtDate(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    </div>
  )
}

function MethodRow({ row, onSaved }: { row: PaymentMethodFeeRow; onSaved: (r: PaymentMethodFeeRow, a: AuditRow) => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(row))
  const [pending, start] = useTransition()
  const dirty = JSON.stringify(d) !== JSON.stringify(toDraft(row))
  const field = (key: keyof Draft, label: string) => (
    <LabeledField label={label} htmlFor={`${row.method}-${key}`}>
      <input
        id={`${row.method}-${key}`}
        className={INPUT}
        value={d[key] as string}
        onChange={(e) => setD({ ...d, [key]: e.target.value })}
        inputMode="decimal"
      />
    </LabeledField>
  )
  const toggle = (key: 'refundable' | 'instant_clearing' | 'selectable', label: string) => (
    <label className="flex items-center gap-2 text-[12.5px] text-text-secondary">
      <Switch checked={d[key]} onCheckedChange={(c) => setD({ ...d, [key]: c })} aria-label={`${row.label} ${label}`} />
      {label}
    </label>
  )
  const save = () =>
    start(async () => {
      const res = await updatePaymentMethodFee({
        method: row.method,
        patch: {
          provider_pct: d.provider_pct, provider_fixed_minor: d.provider_fixed_minor, fx_markup_pct: d.fx_markup_pct,
          buffer_pct: d.buffer_pct, floor_pct: d.floor_pct, min_fee_minor: d.min_fee_minor, min_total_minor: d.min_total_minor, max_total_minor: d.max_total_minor,
          refundable: d.refundable, instant_clearing: d.instant_clearing, selectable: d.selectable,
        },
      })
      if (!res.success) { toast.error(res.error); return }
      setD(toDraft(res.row))
      onSaved(res.row, { id: `${row.method}:${Date.now()}`, actor: null, scope: 'payment_method_fee', key: row.method, created_at: new Date().toISOString() })
      toast.success(`${row.label} saved`)
    })
  return (
    <AdminPanel pad={false}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-text-primary">{row.label}</p>
          <p className="text-[12px] text-text-tertiary">
            {PROVIDER_LABEL[row.provider] ?? row.provider} · {row.fee_currency} · <span className="font-mono">{row.method}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {toggle('refundable', 'Refunds')}
          {toggle('instant_clearing', 'Instant')}
          {toggle('selectable', 'Shown')}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-4 sm:px-5">
        {field('provider_pct', 'Rate %')}
        {field('provider_fixed_minor', 'Fixed (Minor)')}
        {field('fx_markup_pct', 'FX %')}
        {field('buffer_pct', 'Buffer %')}
        {field('floor_pct', 'Floor %')}
        {field('min_fee_minor', 'Min Fee (Minor)')}
        {field('min_total_minor', 'Min Order (Minor)')}
        {field('max_total_minor', 'Cap (Minor)')}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 sm:px-5">
        <span className="text-[12px] text-text-tertiary">{dirty ? 'Unsaved changes' : 'Saved'}</span>
        <button type="button" className={BTN} disabled={!dirty || pending} onClick={save}>
          {pending ? <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" /> : <FloppyDisk aria-hidden weight="bold" className="h-3.5 w-3.5" />} Save
        </button>
      </div>
    </AdminPanel>
  )
}

function RateRow({ row, onSaved }: { row: CurrencyRateRow; onSaved: (r: CurrencyRateRow, a: AuditRow) => void }) {
  const [v, setV] = useState(String(row.usd_per_unit))
  const [pending, start] = useTransition()
  const save = () =>
    start(async () => {
      const res = await updateCurrencyRate({ currency: row.currency, usdPerUnit: v })
      if (!res.success) { toast.error(res.error); return }
      setV(String(res.row.usd_per_unit))
      onSaved(res.row, { id: `${row.currency}:${Date.now()}`, actor: null, scope: 'currency_rate', key: row.currency, created_at: new Date().toISOString() })
      toast.success(`${row.currency} saved`)
    })
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0">
      <span className="w-11 shrink-0 text-[13px] font-semibold text-text-primary">{row.currency}</span>
      <input aria-label={`${row.currency} usd per unit`} className={cn(INPUT, 'w-32 shrink-0')} value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" disabled={row.currency === 'USD'} />
      <span className="min-w-0 flex-1 truncate text-[12px] text-text-tertiary">{row.note}</span>
      <button type="button" className={BTN} disabled={pending || row.currency === 'USD' || v === String(row.usd_per_unit)} onClick={save}>
        {pending ? <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" /> : <FloppyDisk aria-hidden weight="bold" className="h-3.5 w-3.5" />} Save
      </button>
    </div>
  )
}

function NewRate({ onSaved }: { onSaved: (r: CurrencyRateRow, a: AuditRow) => void }) {
  const [cur, setCur] = useState('')
  const [v, setV] = useState('')
  const [pending, start] = useTransition()
  const add = () =>
    start(async () => {
      const res = await updateCurrencyRate({ currency: cur, usdPerUnit: v, note: 'added on /admin/fees' })
      if (!res.success) { toast.error(res.error); return }
      onSaved(res.row, { id: `${res.row.currency}:${Date.now()}`, actor: null, scope: 'currency_rate', key: res.row.currency, created_at: new Date().toISOString() })
      setCur(''); setV('')
      toast.success(`${res.row.currency} added`)
    })
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">
      <input aria-label="new currency code" className={cn(INPUT, 'w-20 uppercase')} placeholder="CCY" maxLength={3} value={cur} onChange={(e) => setCur(e.target.value.toUpperCase())} />
      <input aria-label="new currency usd per unit" className={cn(INPUT, 'w-32')} placeholder="USD per unit" value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" />
      <button type="button" className={adminBtnSm.secondary} disabled={pending || cur.length !== 3 || !v} onClick={add}>
        {pending ? <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" /> : null} Add Rate
      </button>
    </div>
  )
}
