'use client'

/**
 * P6.5 — Admin GDPR Request Management Client
 *
 * Built on the admin kit. Content is visible straight from the server
 * HTML; only user-triggered transitions (dialogs, row exit) animate.
 *
 * Sections:
 *  1. Warning banner for deletion requests
 *  2. Numbers strip + status tabs (pending / all)
 *  3. Requests: cards below lg, table from lg
 *  4. Complete / Reject actions — "Delete Account" asks for confirmation
 *     first (it permanently deletes the auth user).
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { CheckCircle, CircleNotch, DownloadSimple, Trash, WarningOctagon, X } from '@phosphor-icons/react'
import { processGdprRequest, getGdprRequests } from '@/lib/actions/gdpr'
import type { GdprRequest } from '@/lib/actions/gdpr'
import { StatStrip, accountInputCls } from '@/components/account/AccountSurface'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  AdminEmpty,
  AdminLoadingRows,
  PageHeader,
  StatusBadge,
  TABLE,
  adminBtn,
  adminBtnSm,
} from '../components/kit'

type Req = GdprRequest & { username?: string | null; email?: string | null }

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// ── Request pieces ─────────────────────────────────────────────────────────

function TypeChip({ req }: { req: Req }) {
  const isDel = req.type === 'deletion'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
        isDel ? 'bg-error-bg text-error' : 'bg-info-bg text-info',
      )}
    >
      {isDel ? <Trash aria-hidden weight="bold" className="h-3 w-3" /> : <DownloadSimple aria-hidden weight="bold" className="h-3 w-3" />}
      {isDel ? 'Deletion' : 'Export'}
    </span>
  )
}

function RequestActions({ req, onComplete, onReject, loading }: {
  req:        Req
  onComplete: (req: Req) => void
  onReject:   (id: string) => void
  loading:    string | null
}) {
  const busy  = loading === req.id
  const isDel = req.type === 'deletion'
  if (req.status !== 'pending' && req.status !== 'processing') {
    return (
      <span className="text-[12.5px] text-text-tertiary">
        {req.completed_at ? `Done ${fmtDate(req.completed_at)}` : '—'}
      </span>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => onComplete(req)}
        className={isDel ? adminBtnSm.danger : adminBtnSm.primary}
      >
        {busy ? (
          <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />
        ) : isDel ? (
          <Trash aria-hidden weight="bold" className="h-3.5 w-3.5" />
        ) : (
          <CheckCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
        )}
        {isDel ? 'Delete Account' : 'Mark Done'}
      </button>
      <button type="button" disabled={busy} onClick={() => onReject(req.id)} className={adminBtnSm.secondary}>
        <X aria-hidden weight="bold" className="h-3.5 w-3.5" />
        Reject
      </button>
    </div>
  )
}

function StatusCell({ req }: { req: Req }) {
  return (
    <div className="min-w-0">
      <StatusBadge status={req.status} />
      {req.rejection_reason && (
        <p className="mt-1 max-w-[220px] truncate text-[12px] text-text-tertiary" title={req.rejection_reason}>
          {req.rejection_reason}
        </p>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

type Tab = 'pending' | 'all'

interface Props {
  initialRequests: GdprRequest[]
  fetchError?:     string
}

export default function GdprAdminClient({ initialRequests, fetchError }: Props) {
  const [requests,     setRequests]     = useState<GdprRequest[]>(initialRequests)
  const [activeTab,    setActiveTab]    = useState<Tab>('pending')
  const [loading,      setLoading]      = useState<string | null>(null)
  const [tabLoading,   setTabLoading]   = useState(false)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  /** A deletion request waiting for the admin to confirm. */
  const [deleteTarget, setDeleteTarget] = useState<Req | null>(null)

  // ── Tab change ────────────────────────────────────────────────────────────

  const handleTabChange = async (tab: Tab) => {
    setActiveTab(tab)
    setTabLoading(true)
    const result = await getGdprRequests(tab === 'pending' ? 'pending' : 'all')
    setTabLoading(false)
    if (result.success) setRequests(result.requests ?? [])
    else toast.error('Failed to load requests')
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  const handleComplete = async (reqId: string) => {
    setLoading(reqId)
    const result = await processGdprRequest(reqId, 'completed')
    setLoading(null)
    if (result.success) {
      toast.success('Request marked as completed')
      setRequests(prev => prev.filter(r => r.id !== reqId))
    } else {
      toast.error(result.error ?? 'Processing failed')
    }
  }

  /** Exports complete straight away; deletions go through the confirm dialog. */
  const requestComplete = (req: Req) => {
    if (req.type === 'deletion') setDeleteTarget(req)
    else handleComplete(req.id)
  }

  // ── Reject ────────────────────────────────────────────────────────────────

  const handleReject = async () => {
    if (!rejectTarget) return
    setLoading(rejectTarget)
    const result = await processGdprRequest(rejectTarget, 'rejected', { rejectionReason: rejectReason })
    setLoading(null)
    setRejectTarget(null)
    if (result.success) {
      toast.success('Request rejected')
      setRequests(prev => prev.filter(r => r.id !== rejectTarget))
    } else {
      toast.error(result.error ?? 'Rejection failed')
    }
  }

  const deletionCount = requests.filter(r => r.type === 'deletion').length
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const rows = requests as Req[]

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="GDPR Requests"
        description="Data export and account deletion requests."
        className="mb-0 sm:mb-0"
      />

      {deletionCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg bg-error-bg p-4">
          <WarningOctagon aria-hidden weight="bold" className="mt-0.5 h-5 w-5 shrink-0 text-error" />
          <div>
            <p className="text-[13.5px] font-semibold text-error">
              {deletionCount} Account Deletion Request{deletionCount !== 1 ? 's' : ''}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-secondary">
              Completing a deletion request is irreversible. Verify: no active orders, seller balance = 0,
              no pending payouts. The auth user will be permanently deleted.
            </p>
          </div>
        </div>
      )}

      <StatStrip
        stats={[
          { label: 'Pending', value: <span className={pendingCount > 0 ? 'text-warning' : undefined}>{pendingCount}</span> },
          { label: 'Deletions', value: <span className={deletionCount > 0 ? 'text-error' : undefined}>{deletionCount}</span> },
          { label: 'Exports', value: requests.filter(r => r.type === 'export').length },
          { label: 'Processing', value: requests.filter(r => r.status === 'processing').length },
        ]}
      />

      <SegmentedTabs<Tab>
        tabs={[
          { id: 'pending', label: 'Pending' },
          { id: 'all', label: 'All Requests' },
        ]}
        value={activeTab}
        onChange={handleTabChange}
        layoutId="gdpr-tabs"
        ariaLabel="GDPR requests"
      />

      <div role="tabpanel" id={`gdpr-tabs-panel-${activeTab}`} aria-labelledby={`gdpr-tabs-tab-${activeTab}`} className="space-y-3">
        {fetchError && <p className="rounded-lg bg-error-bg px-4 py-3 text-[13px] text-error">{fetchError}</p>}

        {tabLoading ? (
          <AdminLoadingRows rows={4} />
        ) : rows.length === 0 ? (
          <AdminEmpty
            icon={CheckCircle}
            tone="success"
            title={activeTab === 'pending' ? 'No Pending Requests' : 'No GDPR Requests'}
            hint="Export and deletion requests from users show up here."
          />
        ) : (
          <>
            {/* Phones and tablets: cards */}
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
              <AnimatePresence initial={false}>
                {rows.map(req => (
                  <motion.li key={req.id} layout initial={false} exit={{ opacity: 0 }} className="rounded-lg bg-bg-raised p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-text-primary">{req.username ? `@${req.username}` : '—'}</p>
                        <p className="truncate text-[12px] text-text-tertiary">{req.email}</p>
                      </div>
                      <TypeChip req={req} />
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <StatusCell req={req} />
                      <span className="shrink-0 text-[12px] text-text-tertiary">{fmtDate(req.requested_at)}</span>
                    </div>
                    <div className="mt-3.5 border-t border-white/[0.06] pt-3.5">
                      <RequestActions
                        req={req}
                        onComplete={requestComplete}
                        onReject={id => { setRejectTarget(id); setRejectReason('') }}
                        loading={loading}
                      />
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            {/* Wide screens: table */}
            <div className="hidden overflow-hidden rounded-lg bg-bg-raised lg:block">
              <div className={TABLE.wrap}>
                <table className={TABLE.table}>
                  <thead>
                    <tr>
                      {['Type', 'User', 'Requested', 'Status'].map(h => (
                        <th key={h} className={TABLE.th}>{h}</th>
                      ))}
                      <th className={cn(TABLE.th, 'text-right')}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="[&>tr:last-child>td]:border-b-0">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {rows.map(req => (
                        <motion.tr key={req.id} layout initial={false} exit={{ opacity: 0 }} className={TABLE.row}>
                          <td className={TABLE.td}><TypeChip req={req} /></td>
                          <td className={TABLE.td}>
                            <p className="text-[13.5px] font-semibold text-text-primary">{req.username ? `@${req.username}` : '—'}</p>
                            <p className="text-[12px] text-text-tertiary">{req.email}</p>
                          </td>
                          <td className={cn(TABLE.td, 'whitespace-nowrap text-[12.5px] text-text-tertiary')}>{fmtDate(req.requested_at)}</td>
                          <td className={TABLE.td}><StatusCell req={req} /></td>
                          <td className={TABLE.td}>
                            <div className="flex justify-end">
                              <RequestActions
                                req={req}
                                onComplete={requestComplete}
                                onReject={id => { setRejectTarget(id); setRejectReason('') }}
                                loading={loading}
                              />
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-[460px] border-0 p-5 sm:p-6">
          <div className="pr-8">
            <DialogTitle className="text-[18px] font-bold leading-tight">Reject Request</DialogTitle>
            <DialogDescription className="mt-1.5 leading-relaxed">
              Tell the user why the request can&apos;t be completed yet.
            </DialogDescription>
          </div>
          <div>
            <label htmlFor="gdpr-reject-reason" className="mb-1.5 block text-[13px] font-medium text-text-secondary">
              Rejection Reason <span className="text-error">*</span>
            </label>
            <textarea
              id="gdpr-reject-reason"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Active orders pending, outstanding seller balance…"
              rows={4}
              className={cn(accountInputCls, 'resize-none')}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setRejectTarget(null)} className={adminBtn.secondary}>
              Cancel
            </button>
            <button type="button" onClick={handleReject} disabled={!rejectReason.trim()} className={adminBtn.danger}>
              Reject Request
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete-account confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-[460px] border-0 p-5 sm:p-6">
          <div className="pr-8">
            <DialogTitle className="text-[18px] font-bold leading-tight">Delete This Account?</DialogTitle>
            <DialogDescription className="mt-1.5 leading-relaxed">
              {deleteTarget?.username ? `@${deleteTarget.username}` : 'This user'}
              {deleteTarget?.email ? ` (${deleteTarget.email})` : ''} is permanently deleted. This cannot be undone.
            </DialogDescription>
          </div>
          <ul className="space-y-1.5 rounded-md bg-bg-overlay px-4 py-3 text-[13px] text-text-secondary">
            <li>No active orders</li>
            <li>Seller balance is $0</li>
            <li>No pending payouts</li>
          </ul>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setDeleteTarget(null)} className={adminBtn.secondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!deleteTarget) return
                const id = deleteTarget.id
                setDeleteTarget(null)
                handleComplete(id)
              }}
              className={adminBtn.danger}
            >
              <Trash aria-hidden weight="bold" className="h-4 w-4" />
              Delete Account
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
