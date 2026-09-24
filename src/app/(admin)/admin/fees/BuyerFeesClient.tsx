'use client'

/**
 * Buyer fee editor (checkout B3). One row per payment_method_fees entry with
 * inline number fields + three toggles; a second panel for currency_rates.
 * Every number on screen came back from the database after the write; the
 * client trusts nothing it typed.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

import {
  updateCurrencyRate,
  updatePaymentMethodFee,
  type AuditRow,
  type CurrencyRateRow,
  type PaymentMethodFeeRow,
} from '@/lib/actions/admin-buyer-fees'
import { AdminPanel, PageHeader, SectionLabel, TABLE } from '../components/kit'

const INPUT =
  'h-9 w-full rounded-md border border-border-default bg-bg-overlay px-2 text-[13px] tabular-nums text-text-primary outline-none transition-colors focus:border-lime'
const BTN = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-lime px-3 text-[13px] font-bold text-text-inverse transition-colors hover:bg-lime-hover disabled:opacity-50'
const TOGGLE = 'h-4 w-4 accent-lime'

const PROVIDER_LABEL: Record<string, string> = { payssion: 'Payssion', btcpay: 'BTCPay', coingate: 'CoinGate', wallet: 'Wallet', fake: 'Test' }

const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'

type Draft = {
  provider_pct: string
  provider_fixed_minor: string
  fx_markup_pct: string
  buffer_pct: string
  floor_pct: string
  min_fee_minor: string
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
  max_total_minor: r.max_total_minor == null ? '' : String(r.max_total_minor),
  refundable: r.refundable,
  instant_clearing: r.instant_clearing,
  selectable: r.selectable,
})

export default function BuyerFeesClient({ initial }: { initial: { methods: PaymentMethodFeeRow[]; rates: CurrencyRateRow[]; audit: AuditRow[] } }) {
  const [methods, setMethods] = useState(initial.methods)
  const [rates, setRates] = useState(initial.rates)
  const [audit, setAudit] = useState(initial.audit)

  return (
    <div>
      <PageHeader
        title="Buyer Fees"
        description="Processing fee per payment method — the provider's rate on the full amount, any fixed charge (in the fee currency, minor units), currency-conversion markup, buffer, the floor share of the item price, minimum and provider cap. Checkout quotes every order from these rows; each change is audited and republishes /fees."
      />

      <AdminPanel pad={false}>
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                {['Method', 'Provider', 'Fee ccy', 'Rate %', 'Fixed (minor)', 'FX %', 'Buffer %', 'Floor %', 'Min (minor)', 'Cap (minor)', 'Refunds', 'Instant', 'Shown', ''].map((h) => (
                  <th key={h} className={TABLE.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {methods.map((row) => (
                <MethodRow
                  key={row.method}
                  row={row}
                  onSaved={(updated, entry) => {
                    setMethods((m) => m.map((x) => (x.method === updated.method ? updated : x)))
                    setAudit((a) => [entry, ...a].slice(0, 20))
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <AdminPanel>
          <SectionLabel>Currency rates (USD per unit)</SectionLabel>
          <p className="mb-4 text-[12.5px] text-text-secondary">
            Converts fixed fees, minimums and caps into the order currency. Approximate by design — the buffer covers drift.
          </p>
          <div className="space-y-2">
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
          <SectionLabel>Recent changes</SectionLabel>
          {audit.length === 0 ? (
            <p className="text-[13px] text-text-secondary">No buyer-fee edits yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle text-[13px]">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-text-primary">
                    <span className="text-text-tertiary">{a.scope === 'currency_rate' ? 'rate' : 'method'}</span> {a.key}
                  </span>
                  <span className="whitespace-nowrap text-text-tertiary">{fmtDate(a.created_at)}</span>
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
  const field = (key: keyof Draft, width = 'w-20') => (
    <input
      aria-label={`${row.label} ${key}`}
      className={`${INPUT} ${width}`}
      value={d[key] as string}
      onChange={(e) => setD({ ...d, [key]: e.target.value })}
      inputMode="decimal"
    />
  )
  const toggle = (key: 'refundable' | 'instant_clearing' | 'selectable') => (
    <input
      type="checkbox"
      aria-label={`${row.label} ${key}`}
      className={TOGGLE}
      checked={d[key]}
      onChange={(e) => setD({ ...d, [key]: e.target.checked })}
    />
  )
  const save = () =>
    start(async () => {
      const res = await updatePaymentMethodFee({
        method: row.method,
        patch: {
          provider_pct: d.provider_pct, provider_fixed_minor: d.provider_fixed_minor, fx_markup_pct: d.fx_markup_pct,
          buffer_pct: d.buffer_pct, floor_pct: d.floor_pct, min_fee_minor: d.min_fee_minor, max_total_minor: d.max_total_minor,
          refundable: d.refundable, instant_clearing: d.instant_clearing, selectable: d.selectable,
        },
      })
      if (!res.success) { toast.error(res.error); return }
      setD(toDraft(res.row))
      onSaved(res.row, { id: `${row.method}:${Date.now()}`, actor: null, scope: 'payment_method_fee', key: row.method, created_at: new Date().toISOString() })
      toast.success(`${row.label} saved`)
    })
  return (
    <tr className={TABLE.row}>
      <td className={TABLE.tdPrimary}>
        {row.label}
        <div className="text-[11px] font-normal text-text-tertiary">{row.method}</div>
      </td>
      <td className={TABLE.td}>{PROVIDER_LABEL[row.provider] ?? row.provider}</td>
      <td className={TABLE.td}>{row.fee_currency}</td>
      <td className={TABLE.td}>{field('provider_pct')}</td>
      <td className={TABLE.td}>{field('provider_fixed_minor')}</td>
      <td className={TABLE.td}>{field('fx_markup_pct')}</td>
      <td className={TABLE.td}>{field('buffer_pct', 'w-16')}</td>
      <td className={TABLE.td}>{field('floor_pct', 'w-16')}</td>
      <td className={TABLE.td}>{field('min_fee_minor')}</td>
      <td className={TABLE.td}>{field('max_total_minor', 'w-24')}</td>
      <td className={TABLE.td}>{toggle('refundable')}</td>
      <td className={TABLE.td}>{toggle('instant_clearing')}</td>
      <td className={TABLE.td}>{toggle('selectable')}</td>
      <td className={TABLE.td}>
        <button type="button" className={BTN} disabled={!dirty || pending} onClick={save}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
        </button>
      </td>
    </tr>
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
    <div className="flex items-center gap-3">
      <span className="w-12 text-[13px] font-semibold text-text-primary">{row.currency}</span>
      <input aria-label={`${row.currency} usd per unit`} className={`${INPUT} w-36`} value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" disabled={row.currency === 'USD'} />
      <span className="flex-1 truncate text-[12px] text-text-tertiary">{row.note}</span>
      <button type="button" className={BTN} disabled={pending || row.currency === 'USD' || v === String(row.usd_per_unit)} onClick={save}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
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
    <div className="mt-4 flex items-center gap-3 border-t border-border-subtle pt-4">
      <input aria-label="new currency code" className={`${INPUT} w-16 uppercase`} placeholder="CCY" maxLength={3} value={cur} onChange={(e) => setCur(e.target.value.toUpperCase())} />
      <input aria-label="new currency usd per unit" className={`${INPUT} w-36`} placeholder="USD per unit" value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" />
      <button type="button" className={BTN} disabled={pending || cur.length !== 3 || !v} onClick={add}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Add rate
      </button>
    </div>
  )
}
