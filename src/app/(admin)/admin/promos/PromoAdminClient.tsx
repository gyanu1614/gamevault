'use client'

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

interface Props {
  initialCodes: PromoCode[]
  fetchError?: string
}

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
        className="flex items-center gap-2 rounded-xl bg-violet-500 hover:bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Create Promo Code</h2>
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Code + Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Code *</label>
                    <input
                      value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="SUMMER20"
                      required
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white uppercase tracking-widest placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Type *</label>
                    <select
                      value={form.type}
                      onChange={e => setForm(f => ({ ...f, type: e.target.value as 'percentage' | 'flat' }))}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat ($)</option>
                    </select>
                  </div>
                </div>

                {/* Value + Description */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
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
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                    <input
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Summer sale 20% off"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Min order + Max discount */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Min Order ($)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.minOrderAmount}
                      onChange={e => setForm(f => ({ ...f, minOrderAmount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  {form.type === 'percentage' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Max Discount ($)</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={form.maxDiscount}
                        onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value }))}
                        placeholder="No cap"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Usage limit + Per-user limit + Expires */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Total Uses</label>
                    <input
                      type="number" min="1"
                      value={form.usageLimit}
                      onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))}
                      placeholder="Unlimited"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Per User</label>
                    <input
                      type="number" min="1"
                      value={form.perUserLimit}
                      onChange={e => setForm(f => ({ ...f, perUserLimit: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Expires</label>
                    <input
                      type="date"
                      value={form.expiresAt}
                      onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 py-3 text-sm font-semibold text-white transition-colors"
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Promo Codes</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Create and manage discount codes for buyers at checkout.
          </p>
        </div>
        <CreatePromoForm
          onCreated={(code) => setCodes(prev => [code, ...prev])}
        />
      </div>

      {fetchError && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {fetchError}
        </div>
      )}

      {/* Codes table */}
      {codes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <Tag className="h-12 w-12 text-gray-700 mb-3" />
          <p className="text-sm font-medium text-gray-500">No promo codes yet</p>
          <p className="text-xs text-gray-600 mt-1">Create your first code to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-white/[0.08] text-[11px] font-semibold uppercase tracking-widest text-gray-600">
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
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center px-5 py-3.5 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                {/* Code + description */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white tracking-widest">{code.code}</span>
                    {code.min_order_amount > 0 && (
                      <span className="text-[10px] text-gray-600">min ${code.min_order_amount.toFixed(0)}</span>
                    )}
                  </div>
                  {code.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{code.description}</p>
                  )}
                </div>

                {/* Type icon */}
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04]">
                  {code.type === 'percentage'
                    ? <Percent className="h-3.5 w-3.5 text-violet-400" />
                    : <DollarSign className="h-3.5 w-3.5 text-green-400" />
                  }
                </div>

                {/* Value */}
                <span className="text-sm font-semibold text-white">
                  {code.type === 'percentage' ? `${code.value}%` : `$${code.value.toFixed(2)}`}
                  {code.max_discount && (
                    <span className="text-[10px] text-gray-600 ml-1">max ${code.max_discount}</span>
                  )}
                </span>

                {/* Usage */}
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Users className="h-3 w-3" />
                  {code.total_used}{code.usage_limit ? `/${code.usage_limit}` : ''}
                </div>

                {/* Expires */}
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="h-3 w-3" />
                  {code.expires_at
                    ? new Date(code.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                    : '—'}
                </div>

                {/* Status badge */}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  !code.is_active || isExpired || isFull
                    ? 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                    : 'bg-green-500/10 text-green-400 border-green-500/20'
                }`}>
                  {!code.is_active ? 'Inactive' : isExpired ? 'Expired' : isFull ? 'Full' : 'Active'}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(code.id)}
                    disabled={loading === code.id}
                    className="text-gray-500 hover:text-white transition-colors"
                    title={code.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {loading === code.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : code.is_active
                      ? <ToggleRight className="h-5 w-5 text-green-400" />
                      : <ToggleLeft className="h-5 w-5" />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(code.id)}
                    disabled={loading === code.id + '-del'}
                    className="text-gray-600 hover:text-red-400 transition-colors"
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
