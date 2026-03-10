'use client'

/**
 * P6.3 — Admin Fraud Detection Client
 *
 * Sections:
 *  1. Stat cards — open/high/medium/low counts + resolved today
 *  2. "Run Scan" button — triggers runFraudScan() server action
 *  3. Status tab filter (open / resolved / dismissed)
 *  4. Flags table — username, rule, severity badge, description, age, resolve/dismiss actions
 */

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ShieldAlert, AlertTriangle, CheckCircle2, Clock,
  Loader2, RefreshCw, UserX, Tag, Zap, TrendingDown,
  BarChart3, X, CircleDot,
} from 'lucide-react'
import {
  runFraudScan,
  getFraudFlags,
  resolveFraudFlag,
} from '@/lib/actions/fraud-detection'
import type { FraudFlag, FraudSeverity, FraudStatus } from '@/lib/actions/fraud-detection'

// ── Animation variants ─────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

// ── Rule metadata ──────────────────────────────────────────────────────────

const RULE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  high_order_velocity:    { label: 'High Order Velocity',     icon: <Zap         className="w-3.5 h-3.5" /> },
  high_dispute_rate:      { label: 'High Dispute Rate',       icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  new_account_high_value: { label: 'New Acct High Value',     icon: <UserX        className="w-3.5 h-3.5" /> },
  multiple_refunds:       { label: 'Multiple Refunds',        icon: <TrendingDown className="w-3.5 h-3.5" /> },
  promo_abuse:            { label: 'Promo Abuse',             icon: <Tag          className="w-3.5 h-3.5" /> },
  seller_balance_anomaly: { label: 'Seller Balance Anomaly',  icon: <BarChart3    className="w-3.5 h-3.5" /> },
}

// ── Severity badge ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: FraudSeverity }) {
  const config: Record<FraudSeverity, { label: string; cls: string }> = {
    high:   { label: 'HIGH',   cls: 'bg-red-500/15 text-red-400 border border-red-500/20' },
    medium: { label: 'MEDIUM', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/20' },
    low:    { label: 'LOW',    cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/20' },
  }
  const { label, cls } = config[severity]
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string
}) {
  return (
    <motion.div
      variants={item}
      className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold font-mono text-white">{value}</p>
        <p className="text-xs text-white/40">{label}</p>
      </div>
    </motion.div>
  )
}

// ── Flag row ───────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days  > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return `${mins}m ago`
}

interface FlagRowProps {
  flag:      FraudFlag
  onResolve: (id: string, action: 'resolved' | 'dismissed') => void
  resolving: string | null
}

function FlagRow({ flag, onResolve, resolving }: FlagRowProps) {
  const rule = RULE_META[flag.rule_id] ?? { label: flag.rule_id, icon: <CircleDot className="w-3.5 h-3.5" /> }
  const busy = resolving === flag.id

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
    >
      {/* User */}
      <td className="px-4 py-3">
        <div>
          <p className="text-sm text-white font-medium">
            {flag.username ? `@${flag.username}` : <span className="text-white/30 italic">unknown</span>}
          </p>
          <p className="text-xs text-white/30">{flag.email ?? ''}</p>
          {flag.role && (
            <span className="text-[10px] text-white/30 capitalize">{flag.role}</span>
          )}
        </div>
      </td>

      {/* Rule */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-white/60">
          {rule.icon}
          <span className="text-xs">{rule.label}</span>
        </div>
      </td>

      {/* Severity */}
      <td className="px-4 py-3">
        <SeverityBadge severity={flag.severity as FraudSeverity} />
      </td>

      {/* Description */}
      <td className="px-4 py-3 max-w-xs">
        <p className="text-xs text-white/50 leading-relaxed">{flag.description}</p>
      </td>

      {/* Age */}
      <td className="px-4 py-3 text-xs text-white/30 whitespace-nowrap">
        {timeAgo(flag.created_at)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {flag.status === 'open' ? (
          <div className="flex items-center gap-1.5">
            <button
              disabled={busy}
              onClick={() => onResolve(flag.id, 'resolved')}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Resolve
            </button>
            <button
              disabled={busy}
              onClick={() => onResolve(flag.id, 'dismissed')}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-white/[0.05] text-white/40 hover:bg-white/[0.08] transition-colors disabled:opacity-40"
            >
              <X className="w-3 h-3" />
              Dismiss
            </button>
          </div>
        ) : (
          <span className={`text-xs capitalize ${flag.status === 'resolved' ? 'text-green-400' : 'text-white/30'}`}>
            {flag.status}
          </span>
        )}
      </td>
    </motion.tr>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface StatsProps {
  open: number; high: number; medium: number; low: number; resolvedToday: number
  success: boolean; error?: string
}

interface Props {
  initialFlags: FraudFlag[]
  stats:        StatsProps
  fetchError?:  string
}

type Tab = 'open' | 'resolved' | 'dismissed'

export default function FraudClient({ initialFlags, stats, fetchError }: Props) {
  const [flags,        setFlags]        = useState<FraudFlag[]>(initialFlags)
  const [activeTab,    setActiveTab]    = useState<Tab>('open')
  const [resolving,    setResolving]    = useState<string | null>(null)
  const [scanning,     setScanning]     = useState(false)
  const [tabLoading,   setTabLoading]   = useState(false)
  const [, startTransition]            = useTransition()

  // ── Run scan ─────────────────────────────────────────────────────────────

  const handleScan = async () => {
    setScanning(true)
    const result = await runFraudScan()
    setScanning(false)
    if (result.success) {
      toast.success(`Scan complete — ${result.newFlags} new flag${result.newFlags !== 1 ? 's' : ''} found`)
      // Refresh open flags
      handleTabChange('open')
    } else {
      toast.error(result.error ?? 'Scan failed')
    }
  }

  // ── Tab change ───────────────────────────────────────────────────────────

  const handleTabChange = async (tab: Tab) => {
    setActiveTab(tab)
    setTabLoading(true)
    const result = await getFraudFlags(tab)
    setTabLoading(false)
    if (result.success) {
      setFlags(result.flags ?? [])
    } else {
      toast.error('Failed to load flags')
    }
  }

  // ── Resolve / dismiss ────────────────────────────────────────────────────

  const handleResolve = async (flagId: string, action: 'resolved' | 'dismissed') => {
    setResolving(flagId)
    const result = await resolveFraudFlag(flagId, action)
    setResolving(null)
    if (result.success) {
      toast.success(action === 'resolved' ? 'Flag resolved' : 'Flag dismissed')
      setFlags(prev => prev.filter(f => f.id !== flagId))
    } else {
      toast.error(result.error ?? 'Action failed')
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'open',      label: 'Open'      },
    { key: 'resolved',  label: 'Resolved'  },
    { key: 'dismissed', label: 'Dismissed' },
  ]

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-10"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.div variants={item} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            <h1 className="text-2xl font-bold text-white">Fraud Detection</h1>
          </div>
          <p className="text-white/40 text-sm">
            Rules-based engine scanning orders, users, and payment patterns.
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20
                     text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50 text-sm font-medium"
        >
          {scanning
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          {scanning ? 'Scanning…' : 'Run Scan'}
        </button>
      </motion.div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard label="Open Flags"       value={stats.open}          icon={<ShieldAlert  className="w-4 h-4 text-red-400"   />} color="bg-red-500/10"   />
        <StatCard label="High Severity"    value={stats.high}          icon={<AlertTriangle className="w-4 h-4 text-red-400"   />} color="bg-red-500/10"   />
        <StatCard label="Medium Severity"  value={stats.medium}        icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} color="bg-amber-500/10" />
        <StatCard label="Low Severity"     value={stats.low}           icon={<CircleDot     className="w-4 h-4 text-blue-400"  />} color="bg-blue-500/10"  />
        <StatCard label="Resolved Today"   value={stats.resolvedToday} icon={<CheckCircle2  className="w-4 h-4 text-green-400" />} color="bg-green-500/10" />
      </div>

      {/* ── Rules reference ─────────────────────────────────────────────── */}
      <motion.div
        variants={item}
        className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4"
      >
        <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-3">Active Rules</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(RULE_META).map(([ruleId, { label, icon }]) => (
            <div
              key={ruleId}
              className="flex items-center gap-1.5 text-xs text-white/50 bg-white/[0.04] px-2.5 py-1 rounded-full"
            >
              {icon}
              {label}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Flags table ─────────────────────────────────────────────────── */}
      <motion.div variants={item} className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-white/[0.06]">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'text-white border-b-2 border-red-400'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {fetchError && (
          <div className="p-4 text-sm text-red-400 bg-red-500/5">
            Error loading flags: {fetchError}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['User', 'Rule', 'Severity', 'Description', 'Age', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-white/30 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {tabLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-white/30 mx-auto" />
                    </td>
                  </tr>
                ) : flags.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <CheckCircle2 className="w-8 h-8 text-green-400/50 mx-auto mb-2" />
                      <p className="text-sm text-white/30">
                        {activeTab === 'open' ? 'No open fraud flags — run a scan to check.' : `No ${activeTab} flags.`}
                      </p>
                    </td>
                  </tr>
                ) : (
                  flags.map(flag => (
                    <FlagRow
                      key={flag.id}
                      flag={flag}
                      onResolve={handleResolve}
                      resolving={resolving}
                    />
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  )
}
