'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Copy, Check, Share2, Users, DollarSign,
  TrendingUp, Clock, Gift, ChevronRight, ExternalLink,
} from 'lucide-react'
import type { ReferralStats } from '@/lib/actions/referral'
import type { ReferralEarning } from '@/types/database'

interface ReferralClientProps {
  stats: ReferralStats
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

// ── Earning row ───────────────────────────────────────────────────────────────
function EarningRow({ earning }: { earning: ReferralEarning }) {
  const isPaid    = earning.status === 'paid'
  const isBonus   = earning.type === 'signup_bonus'

  return (
    <div className="flex items-center justify-between py-3 border-b border-border-subtle last:border-0">
      <div className="flex items-center gap-3">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isBonus ? 'bg-amber-500/10 text-amber-400' : 'bg-lime/10 text-lime-text'}`}>
          {isBonus ? <Gift className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
        </div>
        <div>
          <div className="text-sm font-medium text-white">
            {isBonus ? 'Signup Bonus' : 'Purchase Commission'}
          </div>
          <div className="text-xs text-text-tertiary">
            {new Date(earning.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className={`text-sm font-semibold ${isPaid ? 'text-success' : 'text-amber-400'}`}>
            +${earning.amount.toFixed(2)}
          </div>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
          isPaid
            ? 'bg-success-bg text-success border border-green-500/20'
            : earning.status === 'cancelled'
            ? 'bg-error-bg text-error border border-error/40'
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        }`}>
          {isPaid ? 'Paid' : earning.status === 'cancelled' ? 'Cancelled' : 'Pending'}
        </span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReferralClient({ stats }: ReferralClientProps) {
  const [copied, setCopied] = useState(false)

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || 'https://gamevault.gg'
  const referralUrl = `${appUrl}/signup?ref=${stats.referralCode}`

  const copyCode = () => {
    navigator.clipboard.writeText(stats.referralCode).then(() => {
      setCopied(true)
      toast.success('Referral code copied!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const copyLink = () => {
    navigator.clipboard.writeText(referralUrl).then(() => {
      toast.success('Referral link copied!')
    })
  }

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join GameVault',
        text: `Use my referral code ${stats.referralCode} to sign up on GameVault — the lowest-fee gaming marketplace!`,
        url: referralUrl,
      }).catch(() => { /* user cancelled */ })
    } else {
      copyLink()
    }
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Refer &amp; Earn</h1>
          <p className="text-sm text-text-secondary mt-1">
            Share your link. Earn <span className="text-lime-text font-medium">10% commission</span> on
            platform fees from every purchase your referrals make.
          </p>
        </div>

        {/* Referral Code Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-lime-tint-border bg-gradient-to-br from-lime/10 via-purple-500/5 to-transparent p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Gift className="h-4 w-4 text-lime-text" />
            <span className="text-sm font-medium text-lime-text">Your Referral Code</span>
          </div>

          {/* Code display */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 rounded-xl bg-black/40 border border-white/[0.1] px-5 py-3.5 font-mono text-2xl font-bold text-white tracking-[0.3em] text-center">
              {stats.referralCode}
            </div>
            <button
              onClick={copyCode}
              className="flex items-center gap-2 rounded-xl bg-lime hover:bg-lime-hover active:scale-95 transition-all px-4 py-3.5 text-sm font-medium text-text-inverse shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Link display */}
          <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-border-subtle px-4 py-2.5 mb-4">
            <ExternalLink className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
            <span className="flex-1 truncate text-xs text-text-secondary font-mono">
              {referralUrl}
            </span>
            <button
              onClick={copyLink}
              className="text-xs text-lime-text hover:text-lime-text transition-colors shrink-0 font-medium"
            >
              Copy
            </button>
          </div>

          {/* Share button */}
          <button
            onClick={shareLink}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-lime-tint-border bg-lime/10 hover:bg-lime/20 transition-colors py-3 text-sm font-medium text-lime-text"
          >
            <Share2 className="h-4 w-4" />
            Share Your Link
          </button>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Users}
            label="Total Referrals"
            value={stats.totalReferrals.toString()}
            sub="Signed up with your code"
            color="blue"
          />
          <StatCard
            icon={DollarSign}
            label="Total Earned"
            value={`$${stats.totalEarned.toFixed(2)}`}
            sub="Lifetime paid commissions"
            color="green"
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={`$${stats.pendingEarnings.toFixed(2)}`}
            sub="Awaiting order completion"
            color="amber"
          />
          <StatCard
            icon={TrendingUp}
            label="This Month"
            value={`$${stats.thisMonthEarned.toFixed(2)}`}
            sub="Paid this calendar month"
            color="violet"
          />
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-border-subtle bg-bg-overlay p-5 mb-8">
          <h2 className="text-sm font-semibold text-white mb-4">How it works</h2>
          <div className="space-y-3">
            {[
              { step: '1', text: 'Share your unique link or code with friends' },
              { step: '2', text: 'They sign up using your code' },
              { step: '3', text: 'You earn 10% of the platform fee on every purchase they make' },
              { step: '4', text: 'Commissions are credited once orders complete' },
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

        {/* Earnings History */}
        <div className="rounded-xl border border-border-subtle bg-bg-overlay overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
            <h2 className="text-sm font-semibold text-white">Earnings History</h2>
            {stats.recentEarnings.length > 0 && (
              <span className="text-xs text-text-tertiary">{stats.recentEarnings.length} records</span>
            )}
          </div>

          {stats.recentEarnings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Gift className="h-12 w-12 text-gray-700 mb-3" />
              <p className="text-sm font-medium text-text-tertiary">No earnings yet</p>
              <p className="text-xs text-text-disabled mt-1 max-w-xs">
                Start sharing your referral link. You'll earn commissions once your
                referrals make purchases.
              </p>
            </div>
          ) : (
            <div className="px-5 py-2">
              {stats.recentEarnings.map((earning) => (
                <EarningRow key={earning.id} earning={earning} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
