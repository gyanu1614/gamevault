'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, AlertCircle, ExternalLink, Loader2,
  Shield, Zap, DollarSign, Clock, ArrowRight, RefreshCw,
  Building2, Lock, ArrowLeft
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassBadge } from '@/components/ui/glass-badge'
import { staggerContainer, staggerItem } from '@/lib/animations/variants'
import { cn } from '@/lib/utils'

interface ConnectStatus {
  isConnected: boolean
  accountId: string | null
  status: 'not_connected' | 'pending' | 'restricted' | 'active' | 'disabled'
  chargesEnabled: boolean
  payoutsEnabled: boolean
  sellerBalance: number
  pendingBalance: number
  lifetimeEarnings: number
  isInHold: boolean
}

export default function StripeConnectPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [status, setStatus] = useState<ConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSuccess = searchParams.get('success') === '1'
  const isRefresh = searchParams.get('refresh') === '1'

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect/status')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStatus(data)
    } catch (err) {
      setError('Failed to load account status. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      // Redirect to Stripe's hosted onboarding
      window.location.href = data.onboardingUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start onboarding')
      setConnecting(false)
    }
  }

  async function handleManageDashboard() {
    setConnecting(true)
    try {
      const res = await fetch('/api/stripe/connect/dashboard', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
    } catch {
      setError('Failed to open Stripe dashboard')
    } finally {
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-lime-tint-border border-t-lime animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your payout account…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Header with Back Button */}
      <div>
        <Link
          href="/account/wallet"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Wallet
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-lime/10 border border-lime-tint-border">
            <DollarSign className="w-6 h-6 text-lime-text" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Payout Account</h1>
            <p className="text-sm text-muted-foreground">Connect your bank to receive earnings</p>
          </div>
        </div>
      </div>

      {/* Success / Refresh banners */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-start gap-3 p-4 rounded-lg bg-success-bg border border-success/25"
          >
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-success">Account connected!</p>
              <p className="text-xs text-success/70 mt-0.5">
                Your bank account is being verified. Payouts are sent automatically once the buyer confirms delivery or the protection window closes.
              </p>
            </div>
          </motion.div>
        )}
        {isRefresh && !isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/25"
          >
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Onboarding incomplete</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                You didn&apos;t complete the setup. Click &quot;Continue setup&quot; to finish.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-error-bg border border-red-500/25">
          <AlertCircle className="w-4 h-4 text-error shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Balance Cards (if connected) */}
      {status?.isConnected && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            {
              label: 'Available Balance',
              value: `$${status.sellerBalance.toFixed(2)}`,
              icon: <DollarSign className="w-4 h-4" />,
              color: 'text-lime-text',
              bg: 'bg-lime/10 border-lime-tint-border',
            },
            {
              label: 'Pending Payout',
              value: `$${status.pendingBalance.toFixed(2)}`,
              icon: <Clock className="w-4 h-4" />,
              color: 'text-amber-400',
              bg: 'bg-amber-500/10 border-amber-500/20',
            },
            {
              label: 'Lifetime Earnings',
              value: `$${status.lifetimeEarnings.toFixed(2)}`,
              icon: <Zap className="w-4 h-4" />,
              color: 'text-success',
              bg: 'bg-success-bg border-success/20',
            },
          ].map((card) => (
            <motion.div
              key={card.label}
              variants={staggerItem}
              className={cn('rounded-lg border p-4', card.bg)}
            >
              <div className={cn('flex items-center gap-2 mb-2', card.color)}>
                {card.icon}
                <span className="text-xs font-medium">{card.label}</span>
              </div>
              <div className={cn('text-2xl font-display font-bold font-mono', card.color)}>
                {card.value}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Payout hold notice */}
      {status?.isConnected && status.isInHold && (
        <GlassCard intensity="light" className="border-amber-500/20">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">New Seller Payout Delay</p>
              <p className="text-xs text-muted-foreground mt-1">
                Payouts from your first 3 orders become available 14 days after each sale — a
                standard security measure for new sellers. After completing 3 orders and 14 days
                as a seller, payouts are automatic.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Main Connect Card */}
      <GlassCard intensity="medium" className="overflow-hidden">
        {/* Status header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/5">
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Stripe Connect</p>
              <p className="text-xs text-muted-foreground">Powered by Stripe</p>
            </div>
          </div>

          {/* Status badge */}
          {status && (
            <GlassBadge
              variant={
                status.status === 'active'      ? 'success' :
                status.status === 'restricted'  ? 'warning' :
                status.status === 'disabled'    ? 'error'   :
                status.status === 'pending'     ? 'warning' : 'muted'
              }
              dot
              dotPulse={status.status === 'active'}
            >
              {status.status === 'not_connected' ? 'Not Connected' :
               status.status === 'active'        ? 'Active' :
               status.status === 'pending'       ? 'Setup Incomplete' :
               status.status === 'restricted'    ? 'Needs Attention' : 'Disabled'}
            </GlassBadge>
          )}
        </div>

        {/* Not connected state */}
        {status?.status === 'not_connected' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-lg bg-lime/10 border border-lime-tint-border flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-lime-text" />
            </div>
            <h2 className="text-lg font-display font-semibold text-foreground mb-2">
              Start receiving payments
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Connect your bank account via Stripe to receive automatic payouts when buyers confirm their orders.
              Takes about 5 minutes.
            </p>

            <button
              onClick={handleConnect}
              disabled={connecting}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-lg',
                'bg-lime hover:bg-lime-hover text-text-inverse font-semibold text-sm',
                'transition-all duration-200 hover:shadow-glow',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              )}
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              {connecting ? 'Opening Stripe…' : 'Connect Bank Account'}
            </button>
          </div>
        )}

        {/* Pending / incomplete state */}
        {status?.status === 'pending' && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Your Stripe account setup is incomplete. Complete the setup to enable payouts.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg',
                'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-sm',
                'border border-amber-500/30 transition-all duration-200'
              )}
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Continue Setup
            </button>
          </div>
        )}

        {/* Active state */}
        {(status?.status === 'active' || status?.status === 'restricted') && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-sm text-muted-foreground">
              {status.payoutsEnabled
                ? 'Payouts are automatic. You\'ll receive your money within 2-7 business days after the buyer confirms delivery.'
                : 'Your account is set up, but payouts may be restricted. Check your Stripe dashboard.'}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={fetchStatus}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
              <button
                onClick={handleManageDashboard}
                disabled={connecting}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                  'bg-white/5 hover:bg-white/10 text-sm font-medium text-foreground',
                  'border border-white/10 transition-all duration-200'
                )}
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Stripe Dashboard
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Trust signals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: <Lock className="w-4 h-4" />, title: 'Bank-level security', desc: 'Stripe is PCI-DSS Level 1 certified' },
          { icon: <Shield className="w-4 h-4" />, title: 'No card details stored', desc: 'DropMarket never sees your bank info' },
          { icon: <Zap className="w-4 h-4" />, title: 'Fast Payouts', desc: 'Payouts arrive within 2-7 business days' },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-bg-overlay border border-border-subtle">
            <span className="text-lime-text shrink-0 mt-0.5">{item.icon}</span>
            <div>
              <p className="text-xs font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
