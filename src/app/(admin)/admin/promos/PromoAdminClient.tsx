'use client'

/**
 * P5.3 — Admin Promo Code Management Client
 *
 * Numbers strip, then the codes: cards below lg, a table row from lg.
 * Create and delete run in Radix dialogs. Every server action and
 * payload is unchanged.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { CircleNotch, Plus, Tag, Trash } from '@phosphor-icons/react'
import {
  createPromoCode,
  togglePromoCode,
  deletePromoCode,
} from '@/lib/actions/promo'
import type { PromoCode } from '@/types/database'
import { StatStrip, accountInputCls } from '@/components/account/AccountSurface'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { AdminEmpty, PageHeader, StatusBadge, adminBtn, type ChipTone } from '../components/kit'

interface Props {
  initialCodes: PromoCode[]
  fetchError?: string
}

const INPUT = accountInputCls
const LABEL = 'mb-1.5 block text-[13px] font-medium text-text-secondary'

// ── Create dialog ─────────────────────────────────────────────────────────────
function CreatePromoForm({ onCreated }: { onCreated: (code: PromoCode) => void }) {
  const [open,     setOpen]     = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({
    code:           '',
    type:           'percentage' as 'percentage' | 'flat',
    value:          '',
    description:    '',
    minOrderAmount: '',
    maxDiscount:    '',
    usageLimit:     '',
    perUserLimit:   '1',
    expiresAt:      '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code || !form.value) return
    setSaving(true)
    const result = await createPromoCode({
      code:           form.code,
      type:           form.type,
      value:          parseFloat(form.value),
      description:    form.description,
      minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : 0,
      maxDiscount:    form.maxDiscount    ? parseFloat(form.maxDiscount)    : null,
      usageLimit:     form.usageLimit     ? parseInt(form.usageLimit)       : null,
      perUserLimit:   parseInt(form.perUserLimit) || 1,
      expiresAt:      form.expiresAt      ? new Date(form.expiresAt).toISOString() : null,
    })
    setSaving(false)
    if (result.success && result.promo) {
      toast.success('Promo code created')
      onCreated(result.promo)
      setOpen(false)
      setForm({ code: '', type: 'percentage', value: '', description: '',
        minOrderAmount: '', maxDiscount: '', usageLimit: '', perUserLimit: '1', expiresAt: '' })
    } else {
      toast.error(result.error || 'Failed to create code')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
      <button type="button" onClick={() => setOpen(true)} className={adminBtn.primary}>
        <Plus aria-hidden weight="bold" className="h-4 w-4" />
        New Promo Code
      </button>

      <DialogContent className="max-w-[520px] border-0 p-5 sm:p-6">
        <div className="pr-8">
          <DialogTitle className="text-[18px] font-bold leading-tight">Create Promo Code</DialogTitle>
          <DialogDescription className="mt-1.5 leading-relaxed">
            Buyers enter the code at checkout.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code + Type */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-code" className={LABEL}>Code <span className="text-error">*</span></label>
              <input
                id="promo-code"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SUMMER20"
                required
                className={cn(INPUT, 'font-mono uppercase tracking-widest')}
              />
            </div>
            <div>
              <label htmlFor="promo-type" className={LABEL}>Type <span className="text-error">*</span></label>
              <select
                id="promo-type"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'percentage' | 'flat' }))}
                className={cn(INPUT, 'h-[46px] cursor-pointer py-0 sm:h-[42px]')}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat ($)</option>
              </select>
            </div>
          </div>

          {/* Value + Description */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-value" className={LABEL}>
                Value <span className="text-error">*</span> {form.type === 'percentage' ? '(%)' : '($)'}
              </label>
              <input
                id="promo-value"
                type="number"
                min="0.01"
                step="0.01"
                max={form.type === 'percentage' ? '100' : undefined}
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder={form.type === 'percentage' ? '10' : '5.00'}
                required
                className={cn(INPUT, 'tabular-nums')}
              />
            </div>
            <div>
              <label htmlFor="promo-description" className={LABEL}>Description</label>
              <input
                id="promo-description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Summer sale 20% off"
                className={INPUT}
              />
            </div>
          </div>

          {/* Min order + Max discount */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-min" className={LABEL}>Min Order ($)</label>
              <input
                id="promo-min"
                type="number" min="0" step="0.01"
                value={form.minOrderAmount}
                onChange={e => setForm(f => ({ ...f, minOrderAmount: e.target.value }))}
                placeholder="0.00"
                className={cn(INPUT, 'tabular-nums')}
              />
            </div>
            {form.type === 'percentage' && (
              <div>
                <label htmlFor="promo-max" className={LABEL}>Max Discount ($)</label>
                <input
                  id="promo-max"
                  type="number" min="0" step="0.01"
                  value={form.maxDiscount}
                  onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value }))}
                  placeholder="No cap"
                  className={cn(INPUT, 'tabular-nums')}
                />
              </div>
            )}
          </div>

          {/* Usage limit + Per-user limit + Expires */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="promo-uses" className={LABEL}>Total Uses</label>
              <input
                id="promo-uses"
                type="number" min="1"
                value={form.usageLimit}
                onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))}
                placeholder="Unlimited"
                className={cn(INPUT, 'tabular-nums')}
              />
            </div>
            <div>
              <label htmlFor="promo-per-user" className={LABEL}>Per User</label>
              <input
                id="promo-per-user"
                type="number" min="1"
                value={form.perUserLimit}
                onChange={e => setForm(f => ({ ...f, perUserLimit: e.target.value }))}
                className={cn(INPUT, 'tabular-nums')}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="promo-expires" className={LABEL}>Expires</label>
              <input
                id="promo-expires"
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className={INPUT}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} disabled={saving} className={adminBtn.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={adminBtn.primary}>
              {saving ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" /> : <Plus aria-hidden weight="bold" className="h-4 w-4" />}
              Create Code
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function codeState(code: PromoCode): { label: string; tone: ChipTone } {
  const isExpired = code.expires_at ? new Date(code.expires_at) < new Date() : false
  const isFull    = code.usage_limit !== null && code.total_used >= code.usage_limit
  if (!code.is_active) return { label: 'Inactive', tone: 'neutral' }
  if (isExpired) return { label: 'Expired', tone: 'error' }
  if (isFull) return { label: 'Full', tone: 'warning' }
  return { label: 'Active', tone: 'success' }
}

const valueLabel = (code: PromoCode) =>
  code.type === 'percentage' ? `${code.value}%` : `$${code.value.toFixed(2)}`

const expiresLabel = (code: PromoCode) =>
  code.expires_at
    ? new Date(code.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
    : 'Never'

const ROW_GRID = 'lg:grid lg:grid-cols-[minmax(0,1fr)_110px_90px_110px_100px_120px] lg:items-center lg:gap-4'

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PromoAdminClient({ initialCodes, fetchError }: Props) {
  const [codes, setCodes]   = useState<PromoCode[]>(initialCodes)
  const [loading, setLoading] = useState<string | null>(null)
  /** Code waiting for the delete confirmation. */
  const [pendingDelete, setPendingDelete] = useState<PromoCode | null>(null)

  const handleToggle = async (id: string) => {
    setLoading(id)
    const result = await togglePromoCode(id)
    setLoading(null)
    if (result.success) {
      setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c))
      toast.success('Updated')
    } else {
      toast.error(result.error || 'Failed')
    }
  }

  const handleDelete = async (id: string) => {
    setPendingDelete(null)
    setLoading(id + '-del')
    const result = await deletePromoCode(id)
    setLoading(null)
    if (result.success) {
      setCodes(prev => prev.filter(c => c.id !== id))
      toast.success('Deleted')
    } else {
      toast.error(result.error || 'Failed')
    }
  }

  const activeCount = codes.filter((c) => codeState(c).label === 'Active').length
  const totalUses = codes.reduce((sum, c) => sum + (c.total_used ?? 0), 0)

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Promo Codes"
        description="Create and manage discount codes for buyers at checkout."
        className="mb-0 sm:mb-0"
        actions={
          <CreatePromoForm
            onCreated={(code) => setCodes(prev => [code, ...prev])}
          />
        }
      />

      {fetchError && (
        <p className="rounded-lg bg-error-bg px-4 py-3 text-[13px] text-error">{fetchError}</p>
      )}

      <StatStrip
        className="grid-cols-3 lg:grid-cols-3"
        stats={[
          { label: 'Active', value: activeCount },
          { label: 'All Codes', value: codes.length },
          { label: 'Redemptions', value: totalUses.toLocaleString() },
        ]}
      />

      {codes.length === 0 ? (
        <AdminEmpty icon={Tag} title="No Promo Codes Yet" hint="Create your first code to get started." />
      ) : (
        <div className="overflow-hidden rounded-lg bg-bg-raised">
          <div className={cn('hidden border-b border-white/[0.06] px-4 py-3 text-[12px] font-medium text-text-tertiary', ROW_GRID)}>
            <span>Code</span>
            <span>Value</span>
            <span>Used</span>
            <span>Expires</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          <ul className="divide-y divide-white/[0.06]">
            {codes.map((code) => {
              const state = codeState(code)
              const toggling = loading === code.id
              const deleting = loading === code.id + '-del'
              return (
                <li key={code.id} className={cn('px-4 py-3.5 transition-colors hover:bg-white/[0.02]', ROW_GRID)}>
                  {/* Code + description */}
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono text-[14px] font-bold tracking-widest text-text-primary">{code.code}</span>
                        {code.min_order_amount > 0 && (
                          <span className="text-[12px] text-text-tertiary">min ${code.min_order_amount.toFixed(0)}</span>
                        )}
                      </div>
                      {code.description && <p className="mt-0.5 truncate text-[12.5px] text-text-tertiary">{code.description}</p>}
                    </div>
                    <StatusBadge status={state.label} tone={state.tone} className="shrink-0 lg:hidden" />
                  </div>

                  {/* Value */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-tertiary lg:hidden">
                    <span>
                      <span className="font-semibold tabular-nums text-text-primary">{valueLabel(code)}</span>
                      {code.max_discount ? ` · max $${code.max_discount}` : ''} off
                    </span>
                    <span className="tabular-nums">{code.total_used}{code.usage_limit ? `/${code.usage_limit}` : ''} used</span>
                    <span>{code.expires_at ? `Expires ${expiresLabel(code)}` : 'No expiry'}</span>
                  </div>
                  <span className="hidden text-[13.5px] font-semibold tabular-nums text-text-primary lg:block">
                    {valueLabel(code)}
                    {code.max_discount ? <span className="ml-1 text-[12px] font-normal text-text-tertiary">max ${code.max_discount}</span> : null}
                  </span>
                  <span className="hidden text-[13px] tabular-nums text-text-secondary lg:block">
                    {code.total_used}{code.usage_limit ? `/${code.usage_limit}` : ''}
                  </span>
                  <span className="hidden text-[13px] text-text-secondary lg:block">{expiresLabel(code)}</span>
                  <span className="hidden lg:block">
                    <StatusBadge status={state.label} tone={state.tone} />
                  </span>

                  {/* Actions */}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 lg:mt-0 lg:justify-end lg:border-0 lg:pt-0">
                    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-text-secondary">
                      {toggling ? (
                        <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                      ) : null}
                      <span className="lg:sr-only">{code.is_active ? 'Active' : 'Inactive'}</span>
                      <Switch
                        checked={code.is_active}
                        onCheckedChange={() => handleToggle(code.id)}
                        disabled={toggling}
                        aria-label={code.is_active ? `Deactivate ${code.code}` : `Activate ${code.code}`}
                        className="data-[state=unchecked]:bg-white/[0.12]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(code)}
                      disabled={deleting}
                      aria-label={`Delete ${code.code}`}
                      title="Delete"
                      className="grid h-9 w-9 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-error-bg hover:text-error disabled:opacity-50"
                    >
                      {deleting ? (
                        <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash aria-hidden weight="bold" className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="max-w-[460px] border-0 p-5 sm:p-6">
          <div className="pr-8">
            <DialogTitle className="text-[18px] font-bold leading-tight">Delete {pendingDelete?.code}?</DialogTitle>
            <DialogDescription className="mt-1.5 leading-relaxed">
              Delete this promo code? This cannot be undone.
            </DialogDescription>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setPendingDelete(null)} className={adminBtn.secondary}>
              Cancel
            </button>
            <button type="button" onClick={() => pendingDelete && handleDelete(pendingDelete.id)} className={adminBtn.danger}>
              <Trash aria-hidden weight="bold" className="h-4 w-4" />
              Delete Code
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
