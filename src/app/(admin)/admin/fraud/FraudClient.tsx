'use client'

/**
 * P6.3 — Admin Fraud Detection Client
 *
 * Sections:
 *  1. Header with "Run Scan" — triggers runFraudScan() server action
 *  2. Numbers strip — open / high / medium / low + resolved today
 *  3. Status tabs (open / resolved / dismissed) + flags: cards below xl, table from xl
 *  4. Active rules reference
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowsClockwise, ArrowUUpLeft, ChartBar, CheckCircle, Circle, CircleNotch, Lightning, Scales, ShieldCheck, Tag, UserMinus, X,
} from '@phosphor-icons/react'
import {
  runFraudScan,
  getFraudFlags,
  resolveFraudFlag,
} from '@/lib/actions/fraud-detection'
import type { FraudFlag, FraudSeverity, FraudStatus } from '@/lib/actions/fraud-detection'
import { StatStrip } from '@/components/account/AccountSurface'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { cn } from '@/lib/utils'
import {
  AdminEmpty, AdminLoadingRows, PageHeader, PanelHead, StatusBadge, TABLE, adminBtn, adminBtnSm,
  type AdminIcon, type ChipTone,
} from '../components/kit'

// ── Rule metadata ──────────────────────────────────────────────────────────

const RULE_META: Record<string, { label: string; icon: AdminIcon; rule: string; severity: FraudSeverity }> = {
  high_order_velocity:    { label: 'High Order Velocity',    icon: Lightning,    rule: 'More than 5 orders in 24 hours',          severity: 'high' },
  high_dispute_rate:      { label: 'High Dispute Rate',      icon: Scales,       rule: 'More than 2 disputes',                    severity: 'medium' },
  new_account_high_value: { label: 'New Account High Value', icon: UserMinus,    rule: 'Account under 7 days, order over $100',   severity: 'medium' },
  multiple_refunds:       { label: 'Multiple Refunds',       icon: ArrowUUpLeft, rule: 'More than 2 refunded orders',             severity: 'medium' },
  promo_abuse:            { label: 'Promo Abuse',            icon: Tag,          rule: 'More than 5 promo codes used',            severity: 'low' },
  seller_balance_anomaly: { label: 'Seller Balance Anomaly', icon: ChartBar,     rule: 'No sales but over $50 pending',           severity: 'high' },
}

const SEVERITY: Record<FraudSeverity, { label: string; tone: ChipTone }> = {
  high:   { label: 'High',   tone: 'error' },
  medium: { label: 'Medium', tone: 'warning' },
  low:    { label: 'Low',    tone: 'info' },
}

function SeverityBadge({ severity }: { severity: FraudSeverity }) {
  const s = SEVERITY[severity] ?? SEVERITY.low
  return <StatusBadge status={s.label} tone={s.tone} />
}

function ruleOf(flag: FraudFlag) {
  return RULE_META[flag.rule_id] ?? { label: flag.rule_id, icon: Circle, rule: '', severity: flag.severity }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days  > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return `${mins}m ago`
}

// ── Flag pieces ────────────────────────────────────────────────────────────

interface FlagProps {
  flag:      FraudFlag
  onResolve: (id: string, action: 'resolved' | 'dismissed') => void
  resolving: string | null
}

function FlagUser({ flag }: { flag: FraudFlag }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[13.5px] font-semibold text-text-primary">
        {flag.username ? `@${flag.username}` : <span className="font-medium italic text-text-tertiary">Unknown</span>}
      </p>
      <p className="truncate text-[12px] text-text-tertiary">
        {flag.email ?? ''}
        {flag.role && <span className="capitalize">{flag.email ? ' · ' : ''}{flag.role}</span>}
      </p>
    </div>
  )
}

function FlagRule({ flag }: { flag: FraudFlag }) {
  const rule = ruleOf(flag)
  const Icon = rule.icon
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary">
      <Icon aria-hidden weight="bold" className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      {rule.label}
    </span>
  )
}

function FlagActions({ flag, onResolve, resolving }: FlagProps) {
  const busy = resolving === flag.id
  if (flag.status !== 'open') {
    return <StatusBadge status={flag.status} tone={flag.status === 'resolved' ? 'success' : 'neutral'} />
  }
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" disabled={busy} onClick={() => onResolve(flag.id, 'resolved')} className={adminBtnSm.primary}>
        {busy ? <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />}
        Resolve
      </button>
      <button type="button" disabled={busy} onClick={() => onResolve(flag.id, 'dismissed')} className={adminBtnSm.secondary}>
        <X aria-hidden weight="bold" className="h-3.5 w-3.5" />
        Dismiss
      </button>
    </div>
  )
}

const rowMotion = {
  layout: true,
  initial: false as const,
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

function FlagCard(props: FlagProps) {
  const { flag } = props
  return (
    <motion.li {...rowMotion} className="rounded-lg bg-bg-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <FlagUser flag={flag} />
        <SeverityBadge severity={flag.severity} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <FlagRule flag={flag} />
        <span className="text-[12px] text-text-tertiary">{timeAgo(flag.created_at)}</span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{flag.description}</p>
      <div className="mt-3.5 border-t border-white/[0.06] pt-3.5">
        <FlagActions {...props} />
      </div>
    </motion.li>
  )
}

function FlagRow(props: FlagProps) {
  const { flag } = props
  return (
    <motion.tr {...rowMotion} className={TABLE.row}>
      <td className={cn(TABLE.td, 'max-w-[240px]')}><FlagUser flag={flag} /></td>
      <td className={cn(TABLE.td, 'whitespace-nowrap')}><FlagRule flag={flag} /></td>
      <td className={TABLE.td}><SeverityBadge severity={flag.severity} /></td>
      <td className={cn(TABLE.td, 'min-w-[260px] text-[13px] leading-relaxed')}>{flag.description}</td>
      <td className={cn(TABLE.td, 'whitespace-nowrap text-[12.5px] text-text-tertiary')}>{timeAgo(flag.created_at)}</td>
      <td className={cn(TABLE.td, 'text-right')}>
        <div className="flex justify-end"><FlagActions {...props} /></div>
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

type Tab = FraudStatus

export default function FraudClient({ initialFlags, stats, fetchError }: Props) {
  const [flags,        setFlags]        = useState<FraudFlag[]>(initialFlags)
  const [activeTab,    setActiveTab]    = useState<Tab>('open')
  const [resolving,    setResolving]    = useState<string | null>(null)
  const [scanning,     setScanning]     = useState(false)
  const [tabLoading,   setTabLoading]   = useState(false)
  // The numbers come from the server page; refresh them after a scan or a verdict.
  const router = useRouter()

  // ── Run scan ─────────────────────────────────────────────────────────────

  const handleScan = async () => {
    setScanning(true)
    const result = await runFraudScan()
    setScanning(false)
    if (result.success) {
      toast.success(`Scan complete — ${result.newFlags} new flag${result.newFlags !== 1 ? 's' : ''} found`)
      // Refresh open flags
      handleTabChange('open')
      router.refresh()
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
      router.refresh()
    } else {
      toast.error(result.error ?? 'Action failed')
    }
  }

  const tabs: { id: Tab; label: React.ReactNode }[] = [
    { id: 'open',      label: <>Open <TabCount n={stats.open} /></> },
    { id: 'resolved',  label: 'Resolved'  },
    { id: 'dismissed', label: 'Dismissed' },
  ]

  const tint = (n: number, cls: string) => <span className={n > 0 ? cls : undefined}>{n}</span>

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Fraud Detection"
        description="Rules that scan orders, accounts and payment patterns for risk."
        className="mb-0 sm:mb-0"
        actions={
          <button type="button" onClick={handleScan} disabled={scanning} className={adminBtn.primary}>
            {scanning
              ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              : <ArrowsClockwise aria-hidden weight="bold" className="h-4 w-4" />}
            {scanning ? 'Scanning…' : 'Run Scan'}
          </button>
        }
      />

      <StatStrip
        className="md:grid-cols-5 lg:grid-cols-5 [&>div:first-child]:col-span-2 md:[&>div:first-child]:col-span-1"
        stats={[
          { label: 'Open Flags', value: stats.open },
          { label: 'High', value: tint(stats.high, 'text-error') },
          { label: 'Medium', value: tint(stats.medium, 'text-warning') },
          { label: 'Low', value: stats.low },
          { label: 'Resolved Today', value: stats.resolvedToday },
        ]}
      />

      <SegmentedTabs tabs={tabs} value={activeTab} onChange={handleTabChange} layoutId="fraud-tabs" ariaLabel="Flag status" />

      <div role="tabpanel" id={`fraud-tabs-panel-${activeTab}`} aria-labelledby={`fraud-tabs-tab-${activeTab}`} className="space-y-3">
        {fetchError && (
          <p className="rounded-lg bg-error-bg px-4 py-3 text-[13px] text-error">Error loading flags: {fetchError}</p>
        )}

        {tabLoading ? (
          <AdminLoadingRows rows={4} />
        ) : flags.length === 0 ? (
          <AdminEmpty
            icon={ShieldCheck}
            title={activeTab === 'open' ? 'No Open Flags' : `No ${activeTab === 'resolved' ? 'Resolved' : 'Dismissed'} Flags`}
            hint={activeTab === 'open' ? 'Run a scan to check for new risk.' : undefined}
          />
        ) : (
          <>
            {/* Phones and tablets: one card per flag */}
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                {flags.map(flag => (
                  <FlagCard key={flag.id} flag={flag} onResolve={handleResolve} resolving={resolving} />
                ))}
              </AnimatePresence>
            </ul>

            {/* Wide screens: table */}
            <div className="hidden overflow-hidden rounded-lg bg-bg-raised xl:block">
              <div className={TABLE.wrap}>
                <table className={TABLE.table}>
                  <thead>
                    <tr>
                      {['User', 'Rule', 'Severity', 'Description', 'Age'].map(h => (
                        <th key={h} className={TABLE.th}>{h}</th>
                      ))}
                      <th className={cn(TABLE.th, 'text-right')}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="[&>tr:last-child>td]:border-b-0">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {flags.map(flag => (
                        <FlagRow key={flag.id} flag={flag} onResolve={handleResolve} resolving={resolving} />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Rules reference ─────────────────────────────────────────────── */}
      <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
        <PanelHead title="Active Rules" subtitle="What each scan checks. A user gets one open flag per rule." />
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(RULE_META).map(([ruleId, { label, icon: Icon, rule, severity }]) => (
            <li key={ruleId} className="flex items-start gap-3 rounded-md bg-bg-overlay px-3.5 py-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/[0.05] text-text-secondary">
                <Icon aria-hidden weight="bold" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold text-text-primary">{label}</p>
                  <SeverityBadge severity={severity} />
                </div>
                <p className="mt-0.5 text-[12px] text-text-tertiary">{rule}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
