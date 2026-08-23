'use client'

/**
 * Founding-seller waitlist admin — card grid.
 *
 * One rich card per early_seller_signups row so the owner sees everything at a
 * glance: who they are, their status, contact (email + Discord, click-to-copy),
 * the GAMES they sell (real logo chips), their monthly-volume band, any past
 * selling experience / note, and when they applied. Each card carries its
 * actions inline — a status dropdown and a "send Founding HQ invite" button.
 * Status-filter tabs, a batch "invite all New", and CSV export sit up top.
 *
 * Built on the admin kit (PageHeader / StatCard / StatusBadge) to match the
 * other admin surfaces (dark neutral, lime accent, semantic status colors).
 */

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Users, UserCheck, UserPlus, MailCheck, Copy, Download, Loader2, Inbox, Send,
  MessageCircle, Gamepad2, TrendingUp, Sparkles, Clock,
} from 'lucide-react'
import {
  updateEarlySellerStatus,
  type EarlySellerSignup,
  type EarlySellerStatus,
} from '@/lib/actions/early-seller'
import { sendFoundingInvite, sendFoundingInvitesToNew } from '@/lib/actions/founding-invite'
import { PageHeader, StatCard, StatusBadge } from '../components/kit'

export interface GameMeta {
  name: string
  icon: string | null
}

const STATUS_OPTIONS: EarlySellerStatus[] = ['new', 'contacted', 'approved', 'rejected']
const STATUS_LABEL: Record<EarlySellerStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  approved: 'Approved',
  rejected: 'Rejected',
}

/** Monthly-volume band → human label (mirrors the signup form's VOLUME_BANDS). */
const VOLUME_LABEL: Record<string, string> = {
  '0-500': '$0–500 / mo',
  '500-1k': '$500–1K / mo',
  '1k-5k': '$1K–5K / mo',
  '5k+': '$5K+ / mo',
}

type Tab = 'all' | EarlySellerStatus

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

/** Resolve a stored game entry (slug or 'custom:<name>') to a display chip. */
function resolveGame(entry: string, gameMeta: Record<string, GameMeta>): { label: string; icon: string | null; custom: boolean } {
  if (entry.startsWith('custom:')) {
    return { label: entry.slice('custom:'.length).trim() || 'Custom', icon: null, custom: true }
  }
  const meta = gameMeta[entry]
  return { label: meta?.name ?? entry, icon: meta?.icon ?? null, custom: false }
}

function toCsv(rows: EarlySellerSignup[], gameMeta: Record<string, GameMeta>): string {
  const head = ['Username', 'Email', 'Discord', 'Games', 'Monthly Volume', 'Experience', 'Note', 'Status', 'Date']
  const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`
  const gamesStr = (r: EarlySellerSignup) =>
    (r.games ?? []).map((g) => resolveGame(g, gameMeta).label).join('; ')
  const lines = rows.map((r) =>
    [
      r.username, r.email, r.discord, gamesStr(r),
      r.monthly_volume ? VOLUME_LABEL[r.monthly_volume] ?? r.monthly_volume : '',
      r.sells, r.note, r.status, r.created_at,
    ]
      .map((v) => esc(v as string | null))
      .join(','),
  )
  return [head.join(','), ...lines].join('\n')
}

export default function EarlySellersClient({
  initialSignups,
  fetchError,
  gameMeta,
}: {
  initialSignups: EarlySellerSignup[]
  fetchError?: string
  gameMeta: Record<string, GameMeta>
}) {
  const [signups, setSignups] = useState<EarlySellerSignup[]>(initialSignups)
  const [tab, setTab] = useState<Tab>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [batchBusy, setBatchBusy] = useState(false)

  const counts = useMemo(() => ({
    all: signups.length,
    new: signups.filter((s) => s.status === 'new').length,
    contacted: signups.filter((s) => s.status === 'contacted').length,
    approved: signups.filter((s) => s.status === 'approved').length,
    rejected: signups.filter((s) => s.status === 'rejected').length,
  }), [signups])

  const visible = useMemo(
    () => (tab === 'all' ? signups : signups.filter((s) => s.status === tab)),
    [signups, tab],
  )

  async function changeStatus(id: string, status: EarlySellerStatus) {
    setBusyId(id)
    const prev = signups
    setSignups((cur) => cur.map((s) => (s.id === id ? { ...s, status } : s)))
    const res = await updateEarlySellerStatus(id, status)
    setBusyId(null)
    if (res.ok) {
      toast.success(`Marked as ${STATUS_LABEL[status]}`)
    } else {
      setSignups(prev)
      toast.error(res.error ?? 'Failed to update')
    }
  }

  async function sendInvite(id: string) {
    setInvitingId(id)
    const res = await sendFoundingInvite(id)
    setInvitingId(null)
    if (res.ok) {
      toast.success('Founding HQ invite sent')
      setSignups((cur) => cur.map((s) => (s.id === id && s.status === 'new' ? { ...s, status: 'contacted' } : s)))
    } else {
      toast.error(res.error ?? 'Could not send invite')
    }
  }

  async function inviteAllNew() {
    const newCount = signups.filter((s) => s.status === 'new').length
    if (newCount === 0) {
      toast.info('No applicants are still marked New.')
      return
    }
    if (!confirm(`Send the Founding HQ invite to all ${newCount} applicants marked New?`)) return
    setBatchBusy(true)
    const res = await sendFoundingInvitesToNew()
    setBatchBusy(false)
    if (res.ok) {
      toast.success(`Sent ${res.sent ?? 0} invite${res.sent === 1 ? '' : 's'}`)
      setSignups((cur) => cur.map((s) => (s.status === 'new' ? { ...s, status: 'contacted' } : s)))
    } else {
      toast.error(res.error ?? 'Batch send failed')
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error('Copy failed'),
    )
  }

  function exportCsv() {
    const csv = toCsv(visible, gameMeta)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `founding-sellers-${tab}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Founding Sellers"
        description="Beta waitlist — early sellers who registered for the first-100 program."
        className="mb-0"
        actions={
          <>
            <button
              onClick={inviteAllNew}
              disabled={batchBusy || counts.new === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-3 py-2 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
              title="Email every applicant still marked New their Founding HQ magic link"
            >
              {batchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Invite New ({counts.new})
            </button>
            <button
              onClick={exportCsv}
              disabled={visible.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-overlay px-3 py-2 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-overlay-2 hover:text-text-primary disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={counts.all} icon={Users} tone="neutral" />
        <StatCard label="New" value={counts.new} icon={UserPlus} tone="info" />
        <StatCard label="Contacted" value={counts.contacted} icon={MailCheck} tone="warning" />
        <StatCard label="Approved" value={counts.approved} icon={UserCheck} tone="success" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border-subtle">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'border-b-2 border-lime text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-[11px] text-text-tertiary">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {fetchError && (
        <div className="rounded-lg border border-error/30 bg-error-bg p-4 text-sm text-error">{fetchError}</div>
      )}

      {/* Card grid */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-border-default bg-bg-raised py-16 text-center">
          <Inbox className="mb-2 h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-tertiary">
            {tab === 'all' ? 'No signups yet.' : `No ${tab} signups.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((s) => (
              <SellerCard
                key={s.id}
                s={s}
                gameMeta={gameMeta}
                busy={busyId === s.id}
                inviting={invitingId === s.id}
                onCopy={copy}
                onChangeStatus={changeStatus}
                onInvite={sendInvite}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

/* ── One founder card ─────────────────────────────────────────────── */

function SellerCard({
  s,
  gameMeta,
  busy,
  inviting,
  onCopy,
  onChangeStatus,
  onInvite,
}: {
  s: EarlySellerSignup
  gameMeta: Record<string, GameMeta>
  busy: boolean
  inviting: boolean
  onCopy: (text: string, label: string) => void
  onChangeStatus: (id: string, status: EarlySellerStatus) => void
  onInvite: (id: string) => void
}) {
  const games = s.games ?? []
  const volume = s.monthly_volume ? VOLUME_LABEL[s.monthly_volume] ?? s.monthly_volume : null
  const initial = (s.username || '?').charAt(0).toUpperCase()

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col rounded-xl border border-border-default bg-bg-raised p-4 transition-colors hover:border-border-strong"
    >
      {/* Header: identity + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-overlay text-[15px] font-bold text-text-primary ring-1 ring-border-subtle">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-text-primary">@{s.username}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-text-tertiary">
              <Clock className="h-3 w-3" />
              {fmtDate(s.created_at)}
            </div>
          </div>
        </div>
        <StatusBadge status={s.status} />
      </div>

      {/* Contact — click to copy */}
      <div className="mt-3.5 space-y-1">
        <button
          onClick={() => onCopy(s.email, 'Email')}
          className="group flex w-full items-center gap-1.5 text-left text-[13px] text-text-secondary hover:text-text-primary"
          title="Copy email"
        >
          <MailCheck className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <span className="truncate">{s.email}</span>
          <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
        </button>
        {s.discord && (
          <button
            onClick={() => onCopy(s.discord!, 'Discord')}
            className="group flex w-full items-center gap-1.5 text-left text-[12.5px] text-text-tertiary hover:text-text-secondary"
            title="Copy Discord"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[#5865F2]" />
            <span className="truncate">{s.discord}</span>
            <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
          </button>
        )}
      </div>

      {/* Games */}
      <div className="mt-3.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">
          <Gamepad2 className="h-3.5 w-3.5" /> Games
        </div>
        {games.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {games.map((g, i) => {
              const { label, icon, custom } = resolveGame(g, gameMeta)
              return (
                <span
                  key={`${g}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-overlay py-1 pl-1 pr-2 text-[12px] font-medium text-text-secondary"
                >
                  {icon ? (
                    <Image src={icon} alt="" width={16} height={16} className="h-4 w-4 rounded object-contain" />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-bg-overlay-2">
                      <Sparkles className="h-2.5 w-2.5 text-lime-text" />
                    </span>
                  )}
                  {label}
                  {custom && <span className="text-[9px] uppercase tracking-wide text-text-tertiary">custom</span>}
                </span>
              )
            })}
          </div>
        ) : (
          <span className="text-[12.5px] text-text-tertiary">—</span>
        )}
      </div>

      {/* Volume + experience/note */}
      <div className="mt-3.5 grid grid-cols-1 gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-bg-overlay px-3 py-2">
          <TrendingUp className="h-4 w-4 shrink-0 text-success" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Monthly Volume</div>
            <div className="text-[13px] font-semibold text-text-primary">{volume ?? 'Not shared'}</div>
          </div>
        </div>
        {(s.sells || s.note) && (
          <div className="rounded-lg bg-bg-overlay px-3 py-2">
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Experience / Note
            </div>
            {s.sells && <p className="text-[12.5px] leading-snug text-text-secondary">{s.sells}</p>}
            {s.note && <p className="mt-0.5 text-[12px] leading-snug text-text-tertiary">{s.note}</p>}
          </div>
        )}
      </div>

      {/* Actions — pinned to the bottom */}
      <div className="mt-auto flex items-center gap-2 pt-4">
        <select
          value={s.status}
          disabled={busy}
          onChange={(e) => onChangeStatus(s.id, e.target.value as EarlySellerStatus)}
          className="flex-1 rounded-lg border border-border-default bg-bg-overlay px-2.5 py-2 text-[12.5px] font-medium text-text-primary focus:border-lime focus:outline-none disabled:opacity-40"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{STATUS_LABEL[opt]}</option>
          ))}
        </select>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />}
        <button
          onClick={() => onInvite(s.id)}
          disabled={inviting}
          title="Send Founding HQ magic-link invite"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-overlay px-3 py-2 text-[12.5px] font-semibold text-text-secondary transition-colors hover:bg-bg-overlay-2 hover:text-lime-text disabled:opacity-40"
        >
          {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Invite
        </button>
      </div>
    </motion.div>
  )
}
