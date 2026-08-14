'use client'

/**
 * Founding-seller waitlist admin table.
 *
 * Lists every early_seller_signups row with status-filter tabs, a per-row
 * status dropdown (new → contacted → approved / rejected), copy-to-clipboard
 * on email/discord, and a CSV export of the current view. Built on the admin
 * kit (PageHeader / StatCard / StatusBadge / TABLE) to match the other admin
 * list pages.
 */

import { useMemo, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Users, UserCheck, UserPlus, MailCheck, Copy, Download, Loader2, Inbox, Send,
} from 'lucide-react'
import {
  getEarlySellerSignups,
  updateEarlySellerStatus,
  type EarlySellerSignup,
  type EarlySellerStatus,
} from '@/lib/actions/early-seller'
import { sendFoundingInvite, sendFoundingInvitesToNew } from '@/lib/actions/founding-invite'
import { PageHeader, StatCard, StatusBadge, TABLE } from '../components/kit'

const STATUS_OPTIONS: EarlySellerStatus[] = ['new', 'contacted', 'approved', 'rejected']
const STATUS_LABEL: Record<EarlySellerStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  approved: 'Approved',
  rejected: 'Rejected',
}

type Tab = 'all' | EarlySellerStatus

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function toCsv(rows: EarlySellerSignup[]): string {
  const head = ['Username', 'Email', 'Discord', 'Sells', 'Note', 'Status', 'Date']
  const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map((r) =>
    [r.username, r.email, r.discord, r.sells, r.note, r.status, r.created_at]
      .map((v) => esc(v as string | null))
      .join(','),
  )
  return [head.join(','), ...lines].join('\n')
}

export default function EarlySellersClient({
  initialSignups,
  fetchError,
}: {
  initialSignups: EarlySellerSignup[]
  fetchError?: string
}) {
  const [signups, setSignups] = useState<EarlySellerSignup[]>(initialSignups)
  const [tab, setTab] = useState<Tab>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [batchBusy, setBatchBusy] = useState(false)
  const [, startRefresh] = useTransition()

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
    // Optimistic update.
    const prev = signups
    setSignups((cur) => cur.map((s) => (s.id === id ? { ...s, status } : s)))
    const res = await updateEarlySellerStatus(id, status)
    setBusyId(null)
    if (res.ok) {
      toast.success(`Marked as ${STATUS_LABEL[status]}`)
    } else {
      setSignups(prev) // roll back
      toast.error(res.error ?? 'Failed to update')
    }
  }

  async function sendInvite(id: string) {
    setInvitingId(id)
    const res = await sendFoundingInvite(id)
    setInvitingId(null)
    if (res.ok) {
      toast.success('Founding HQ invite sent')
      // The action advances 'new' → 'contacted'; reflect it locally.
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

  function refresh() {
    startRefresh(async () => {
      const res = await getEarlySellerSignups()
      if (res.ok) setSignups(res.signups ?? [])
      else toast.error(res.error ?? 'Failed to refresh')
    })
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error('Copy failed'),
    )
  }

  function exportCsv() {
    const csv = toCsv(visible)
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

      {/* Table */}
      <section className="overflow-hidden rounded-xl border border-border-default bg-bg-raised">
        {/* Tabs */}
        <div className="flex flex-wrap border-b border-border-subtle">
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
              <span className="ml-1.5 text-[11px] text-text-tertiary">
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        {fetchError && <div className="p-4 text-sm text-error">{fetchError}</div>}

        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                {['Seller', 'Contact', 'Sells / Note', 'Date', 'Status', 'Set Status'].map((h) => (
                  <th key={h} className={TABLE.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center">
                      <Inbox className="mx-auto mb-2 h-8 w-8 text-text-tertiary" />
                      <p className="text-sm text-text-tertiary">
                        {tab === 'all' ? 'No signups yet.' : `No ${tab} signups.`}
                      </p>
                    </td>
                  </tr>
                ) : (
                  visible.map((s) => (
                    <motion.tr key={s.id} layout initial={false} exit={{ opacity: 0 }} className={TABLE.row}>
                      {/* Seller */}
                      <td className={TABLE.tdPrimary}>@{s.username}</td>

                      {/* Contact */}
                      <td className={TABLE.td}>
                        <button
                          onClick={() => copy(s.email, 'Email')}
                          className="group inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary"
                          title="Copy email"
                        >
                          {s.email}
                          <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                        </button>
                        {s.discord && (
                          <button
                            onClick={() => copy(s.discord!, 'Discord')}
                            className="group mt-0.5 flex items-center gap-1.5 text-[12px] text-text-tertiary hover:text-text-secondary"
                            title="Copy Discord"
                          >
                            {s.discord}
                            <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                          </button>
                        )}
                      </td>

                      {/* Sells / Note */}
                      <td className={`${TABLE.td} max-w-[280px]`}>
                        {s.sells && <p className="truncate text-[13px] text-text-secondary">{s.sells}</p>}
                        {s.note && <p className="truncate text-[12px] text-text-tertiary">{s.note}</p>}
                        {!s.sells && !s.note && <span className="text-text-tertiary">—</span>}
                      </td>

                      {/* Date */}
                      <td className={`${TABLE.td} whitespace-nowrap text-[12px] text-text-tertiary`}>
                        {fmtDate(s.created_at)}
                      </td>

                      {/* Status */}
                      <td className={TABLE.td}>
                        <StatusBadge status={s.status} />
                      </td>

                      {/* Set Status */}
                      <td className={TABLE.td}>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={s.status}
                            disabled={busyId === s.id}
                            onChange={(e) => changeStatus(s.id, e.target.value as EarlySellerStatus)}
                            className="rounded-md border border-border-default bg-bg-overlay px-2 py-1.5 text-[12px] font-medium text-text-primary focus:border-lime focus:outline-none disabled:opacity-40"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{STATUS_LABEL[opt]}</option>
                            ))}
                          </select>
                          {busyId === s.id && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />
                          )}
                          <button
                            onClick={() => sendInvite(s.id)}
                            disabled={invitingId === s.id}
                            title="Send Founding HQ magic-link invite"
                            aria-label="Send Founding HQ invite"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle text-text-secondary transition-colors hover:bg-bg-overlay hover:text-lime-text disabled:opacity-40"
                          >
                            {invitingId === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
