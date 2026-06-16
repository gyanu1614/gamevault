'use client'

import { motion } from 'framer-motion'
import {
  Star, DollarSign, TrendingUp, Clock, Zap,
  ShoppingBag, RotateCcw, Gift, ChevronRight,
} from 'lucide-react'
import type { LoyaltyStats } from '@/lib/actions/loyalty'
import type { LoyaltyCredit } from '@/types/database'

interface LoyaltyClientProps {
  stats: LoyaltyStats
  cashbackRate: number
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'violet',
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color?: 'violet' | 'green' | 'amber' | 'blue'
}) {
  const colors = {
    violet: 'text-lime-text bg-lime/10 border-lime-tint-border',
    green:  'text-success  bg-success-bg  border-green-500/20',
    amber:  'text-amber-400  bg-amber-500/10  border-amber-500/20',
    blue:   'text-blue-400   bg-blue-500/10   border-blue-500/20',
  }
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-overlay p-5">
      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg border mb-3 ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-text-secondary mt-0.5">{label}</div>
      {sub && <div className="text-xs text-text-disabled mt-1">{sub}</div>}
    </div>
  )
}

// ── Credit row ────────────────────────────────────────────────────────────────
function CreditRow({ credit }: { credit: LoyaltyCredit }) {
  const isEarned  = credit.type === 'earned'  || credit.type === 'bonus'
  const isRedeemed = credit.type === 'redeemed'
  const isExpired  = credit.type === 'expired'

  const icon = isEarned
    ? <TrendingUp className="h-4 w-4" />
    : isRedeemed
    ? <ShoppingBag className="h-4 w-4" />
    : <RotateCcw className="h-4 w-4" />

  const iconBg = isEarned
    ? 'bg-success-bg text-success'
    : isRedeemed
    ? 'bg-lime/10 text-lime-text'
    : 'bg-gray-500/10 text-text-tertiary'

  const amountColor = isEarned
    ? 'text-success'
    : isRedeemed
    ? 'text-white'
    : 'text-text-tertiary'

  return (
    <div className="flex items-center justify-between py-3 border-b border-border-subtle last:border-0">
      <div className="flex items-center gap-3">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-white capitalize">
            {credit.type === 'earned'   ? 'Cashback Earned'  :
             credit.type === 'redeemed' ? 'Credits Redeemed' :
             credit.type === 'bonus'    ? 'Bonus Credits'    :
                                          'Credits Expired'}
          </div>
          <div className="text-xs text-text-tertiary">
            {new Date(credit.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
            {credit.description ? ` · ${credit.description}` : ''}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-semibold ${amountColor}`}>
          {isEarned ? '+' : isRedeemed ? '-' : ''}${credit.amount.toFixed(2)}
        </div>
        <div className="text-[10px] text-text-disabled mt-0.5">
          bal. ${credit.balance_after.toFixed(2)}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LoyaltyClient({ stats, cashbackRate }: LoyaltyClientProps) {
  const rateLabel = `${(cashbackRate * 100).toFixed(0)}%`

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Rewards &amp; Cashback</h1>
          <p className="text-sm text-text-secondary mt-1">
            Earn <span className="text-lime-text font-medium">{rateLabel} cashback</span> on
            every purchase you complete.
          </p>
        </div>

        {/* Balance hero card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-lime-tint-border bg-gradient-to-br from-lime/10 via-purple-500/5 to-transparent p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-4 w-4 text-lime-text" />
            <span className="text-sm font-medium text-lime-text">Available Credits</span>
          </div>
          <div className="text-5xl font-bold text-white tracking-tight mb-1">
            ${stats.balance.toFixed(2)}
          </div>
          <p className="text-sm text-text-secondary">
            Use your credits at checkout to save on future orders.
          </p>

          {stats.pendingFromOrders > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5">
              <Clock className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-sm text-amber-300">
                <span className="font-semibold">${stats.pendingFromOrders.toFixed(2)}</span> cashback
                pending — confirm your deliveries to unlock.
              </span>
            </div>
          )}
        </motion.div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Star}
            label="Available Credits"
            value={`$${stats.balance.toFixed(2)}`}
            sub="Ready to redeem"
            color="violet"
          />
          <StatCard
            icon={DollarSign}
            label="Lifetime Earned"
            value={`$${stats.lifetimeCashbackEarned.toFixed(2)}`}
            sub="All-time cashback"
            color="green"
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={`$${stats.pendingFromOrders.toFixed(2)}`}
            sub="Awaiting confirmation"
            color="amber"
          />
          <StatCard
            icon={TrendingUp}
            label="This Month"
            value={`$${stats.thisMonthEarned.toFixed(2)}`}
            sub="Calendar month"
            color="blue"
          />
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-border-subtle bg-bg-overlay p-5 mb-8">
          <h2 className="text-sm font-semibold text-white mb-4">How cashback works</h2>
          <div className="space-y-3">
            {[
              { step: '1', text: `Buy any listing — you'll earn ${rateLabel} of your order subtotal as credits` },
              { step: '2', text: 'Confirm receipt of your order to unlock the cashback' },
              { step: '3', text: 'Credits appear in your balance instantly' },
              { step: '4', text: 'Apply credits at checkout to save on future purchases' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-lime/20 border border-lime-tint-border flex items-center justify-center text-[11px] font-bold text-lime-text shrink-0">
                  {step}
                </div>
                <p className="text-sm text-text-secondary">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Credits history */}
        <div className="rounded-xl border border-border-subtle bg-bg-overlay overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
            <h2 className="text-sm font-semibold text-white">Credits History</h2>
            {stats.recentCredits.length > 0 && (
              <span className="text-xs text-text-tertiary">{stats.recentCredits.length} records</span>
            )}
          </div>

          {stats.recentCredits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Gift className="h-12 w-12 text-gray-700 mb-3" />
              <p className="text-sm font-medium text-text-tertiary">No credits yet</p>
              <p className="text-xs text-text-disabled mt-1 max-w-xs">
                Complete your first purchase and confirm delivery to earn your
                first {rateLabel} cashback.
              </p>
            </div>
          ) : (
            <div className="px-5 py-2">
              {stats.recentCredits.map((credit) => (
                <CreditRow key={credit.id} credit={credit} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
