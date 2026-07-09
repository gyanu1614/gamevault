'use client'

/**
 * P5.3 — Admin Promo Code Management Client
 *
 * V53 restyle — admin kit design language: PageHeader, neutral
 * bg-bg-raised surfaces, lime primary actions, StatusBadge pills,
 * kit-style inputs and modal.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Tag, Plus, Trash2, ToggleLeft, ToggleRight,
  Calendar, Users, Percent, DollarSign, Loader2, X,
} from 'lucide-react'
import {
  createPromoCode,
  togglePromoCode,
  deletePromoCode,
} from '@/lib/actions/promo'
import type { PromoCode } from '@/types/database'
import { PageHeader, StatusBadge } from '../components/kit'

interface Props {
  initialCodes: PromoCode[]
  fetchError?: string
}

const INPUT =
  'w-full rounded-lg border border-border-default bg-bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none'
const LABEL = 'block text-xs font-medium text-text-tertiary mb-1.5'

// ── Create form ───────────────────────────────────────────────────────────────
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
    <div>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-lime-pressed px-4 py-2.5 text-sm font-bold text-text-inverse transition-colors hover:bg-lime"
      >
        <Plus className="h-4 w-4" />
        New Promo Code
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-xl border border-border-default bg-bg-raised p-6"
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-bold text-text-primary">Create Promo Code</h2>
                <button onClick={() => setOpen(false)} className="text-text-tertiary transition-colors hover:text-text-primary">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Code + Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Code *</label>
                    <input
                      value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="SUMMER20"
                      required
                      className={`${INPUT} uppercase tracking-widest`}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Type *</label>
                    <select
                      value={form.type}
                      onChange={e => setForm(f => ({ ...f, type: e.target.value as 'percentage' | 'flat' }))}
                      className={INPUT}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat ($)</option>
                    </select>
                  </div>
                </div>

                {/* Value + Description */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>
                      Value * {form.type === 'percentage' ? '(%)' : '($)'}
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={form.type === 'percentage' ? '100' : undefined}
                      value={form.value}
                      onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                      placeholder={form.type === 'percentage' ? '10' : '5.00'}
                      required
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Description</label>
                    <input
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Summer sale 20% off"
                      className={INPUT}
                    />
                  </div>
                </div>

                {/* Min order + Max discount */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Min Order ($)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.minOrderAmount}
                      onChange={e => setForm(f => ({ ...f, minOrderAmount: e.target.value }))}
                      placeholder="0.00"
                      className={INPUT}
                    />
                  </div>
                  {form.type === 'percentage' && (
                    <div>
                      <label className={LABEL}>Max Discount ($)</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={form.maxDiscount}
                        onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value }))}
                        placeholder="No cap"
                        className={INPUT}
                      />
                    </div>
                  )}
                </div>

                {/* Usage limit + Per-user limit + Expires */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL}>Total Uses</label>
                    <input
                      type="number" min="1"
                      value={form.usageLimit}
                      onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))}
                      placeholder="Unlimited"
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Per User</label>
                    <input
                      type="number" min="1"
                      value={form.perUserLimit}
                      onChange={e => setForm(f => ({ ...f, perUserLimit: e.target.value }))}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Expires</label>
                    <input
                      type="date"
                      value={form.expiresAt}
                      onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                      className={INPUT}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-lime-pressed py-3 text-sm font-bold text-text-inverse transition-colors hover:bg-lime disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Code
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PromoAdminClient({ initialCodes, fetchError }: Props) {
  const [codes, setCodes]   = useState<PromoCode[]>(initialCodes)
  const [loading, setLoading] = useState<string | null>(null)

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
    if (!confirm('Delete this promo code? This cannot be undone.')) return
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

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <PageHeader
        title="Promo Codes"
        description="Create and manage discount codes for buyers at checkout."
        actions={
          <CreatePromoForm
            onCreated={(code) => setCodes(prev => [code, ...prev])}
          />
        }
      />

      {fetchError && (
        <div className="mb-4 rounded-xl border border-[rgba(255,92,92,0.25)] bg-error-bg px-4 py-3 text-sm text-error">
          {fetchError}
        </div>
      )}

      {/* Codes table */}
      {codes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-bg-raised py-20">
          <Tag className="mb-3 h-12 w-12 text-text-disabled" />
          <p className="text-sm font-medium text-text-secondary">No promo codes yet</p>
          <p className="mt-1 text-xs text-text-tertiary">Create your first code to get started.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-default bg-bg-raised">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 border-b border-border-subtle px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            <span>Code</span>
            <span>Type</span>
            <span>Value</span>
            <span>Used</span>
            <span>Expires</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {codes.map((code) => {
            const isExpired = code.expires_at ? new Date(code.expires_at) < new Date() : false
            const isFull    = code.usage_limit !== null && code.total_used >= code.usage_limit

            return (
              <div
                key={code.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] items-center gap-4 border-b border-border-subtle px-5 py-3.5 transition-colors last:border-0 hover:bg-bg-overlay"
              >
                {/* Code + description */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold tracking-widest text-text-primary">{code.code}</span>
                    {code.min_order_amount > 0 && (
                      <span className="text-[10px] text-text-tertiary">min ${code.min_order_amount.toFixed(0)}</span>
                    )}
                  </div>
                  {code.description && (
                    <p className="mt-0.5 text-xs text-text-tertiary">{code.description}</p>
                  )}
                </div>

                {/* Type icon */}
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-bg-overlay">
                  {code.type === 'percentage'
                    ? <Percent className="h-3.5 w-3.5 text-lime-text" />
                    : <DollarSign className="h-3.5 w-3.5 text-success" />
                  }
                </div>

                {/* Value */}
                <span className="text-sm font-semibold tabular-nums text-text-primary">
                  {code.type === 'percentage' ? `${code.value}%` : `$${code.value.toFixed(2)}`}
                  {code.max_discount && (
                    <span className="ml-1 text-[10px] text-text-tertiary">max ${code.max_discount}</span>
                  )}
                </span>

                {/* Usage */}
                <div className="flex items-center gap-1 text-xs tabular-nums text-text-secondary">
                  <Users className="h-3 w-3" />
                  {code.total_used}{code.usage_limit ? `/${code.usage_limit}` : ''}
                </div>

                {/* Expires */}
                <div className="flex items-center gap-1 text-xs text-text-secondary">
                  <Calendar className="h-3 w-3" />
                  {code.expires_at
                    ? new Date(code.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                    : '—'}
                </div>

                {/* Status badge */}
                <StatusBadge
                  status={!code.is_active ? 'Inactive' : isExpired ? 'Expired' : isFull ? 'Full' : 'Active'}
                />

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(code.id)}
                    disabled={loading === code.id}
                    className="text-text-tertiary transition-colors hover:text-text-primary"
                    title={code.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {loading === code.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : code.is_active
                      ? <ToggleRight className="h-5 w-5 text-success" />
                      : <ToggleLeft className="h-5 w-5" />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(code.id)}
                    disabled={loading === code.id + '-del'}
                    className="text-text-tertiary transition-colors hover:text-error"
                    title="Delete"
                  >
                    {loading === code.id + '-del'
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />
                    }
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
