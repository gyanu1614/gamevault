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
 * Built on the admin kit (PageHeader / StatStrip / SegmentedTabs /
 * StatusBadge): fill-only cards, Title Case labels, Phosphor icons.
 */

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ChatCircleText, CircleNotch, Clock, Copy, DownloadSimple, EnvelopeSimple, Tray, PaperPlaneTilt, Sparkle, TrendUp,
} from '@phosphor-icons/react'
import { StatStrip } from '@/components/account/AccountSurface'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  updateEarlySellerStatus,
  type EarlySellerSignup,
  type EarlySellerStatus,
} from '@/lib/actions/early-seller'
import { sendFoundingInvite, sendFoundingInvitesToNew } from '@/lib/actions/founding-invite'
import { AdminEmpty, PageHeader, StatusBadge, adminBtn, adminBtnSm } from '../components/kit'

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
  const [confirmBatch, setConfirmBatch] = useState(false)

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

  function askInviteAllNew() {
    if (signups.filter((s) => s.status === 'new').length === 0) {
      toast.info('No applicants are still marked New.')
      return
    }
    setConfirmBatch(true)
  }

  async function inviteAllNew() {
    setBatchBusy(true)
    const res = await sendFoundingInvitesToNew()
    setBatchBusy(false)
    setConfirmBatch(false)
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
    <div className="space-y-5">
      <PageHeader
        title="Founding Sellers"
        description="Beta waitlist — early sellers who registered for the first-100 program."
        className="mb-0 sm:mb-0"
        actions={
          <>
            <button
              type="button"
              onClick={askInviteAllNew}
              disabled={batchBusy || counts.new === 0}
              className={adminBtn.primary}
              title="Email every applicant still marked New their Founding HQ magic link"
            >
              {batchBusy ? (
                <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              ) : (
                <PaperPlaneTilt aria-hidden weight="bold" className="h-4 w-4" />
              )}
              Invite New ({counts.new})
            </button>
            <button type="button" onClick={exportCsv} disabled={visible.length === 0} className={adminBtn.secondary}>
              <DownloadSimple aria-hidden weight="bold" className="h-4 w-4" />
              Export CSV
            </button>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: 'Total', value: counts.all },
          { label: 'New', value: counts.new },
          { label: 'Contacted', value: counts.contacted },
          { label: 'Approved', value: counts.approved },
        ]}
      />

      <SegmentedTabs
        tabs={TABS.map((t) => ({
          id: t.key,
          label: (
            <>
              {t.label}
              {counts[t.key] > 0 && <TabCount n={counts[t.key]} />}
            </>
          ),
        }))}
        value={tab}
        onChange={setTab}
        layoutId="admin-founding-tabs"
        ariaLabel="Signup status"
      />

      {fetchError && (
        <p role="alert" className="rounded-lg bg-error-bg px-4 py-3 text-[13.5px] text-error">
          {fetchError}
        </p>
      )}

      {visible.length === 0 ? (
        <AdminEmpty icon={Tray} title={tab === 'all' ? 'No signups yet' : `No ${tab} signups`} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
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

      <Dialog open={confirmBatch} onOpenChange={(o) => !o && !batchBusy && setConfirmBatch(false)}>
        <DialogContent className="max-w-[440px] border-0 p-5 sm:p-6">
          <div className="pr-8">
            <DialogTitle className="text-[18px] font-bold">Invite All New Applicants?</DialogTitle>
            <DialogDescription className="mt-1.5 leading-relaxed">
              Emails the Founding HQ magic link to all {counts.new} applicants marked New and moves them to Contacted.
            </DialogDescription>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={() => setConfirmBatch(false)} disabled={batchBusy} className={cn(adminBtn.secondary, 'sm:flex-1')}>
              Cancel
            </button>
            <button type="button" onClick={inviteAllNew} disabled={batchBusy} className={cn(adminBtn.primary, 'sm:flex-1')}>
              {batchBusy ? (
                <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              ) : (
                <PaperPlaneTilt aria-hidden weight="bold" className="h-4 w-4" />
              )}
              Send {counts.new} Invite{counts.new === 1 ? '' : 's'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
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
      className="flex flex-col rounded-lg bg-bg-raised p-4 sm:p-5"
    >
      {/* Header: identity + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[15px] font-bold text-text-primary">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-text-primary">@{s.username}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[12px] text-text-tertiary">
              <Clock aria-hidden weight="bold" className="h-3 w-3" />
              {fmtDate(s.created_at)}
            </div>
          </div>
        </div>
        <StatusBadge status={s.status} />
      </div>

      {/* Contact — click to copy */}
      <div className="mt-3.5 space-y-0.5">
        <button
          type="button"
          onClick={() => onCopy(s.email, 'Email')}
          className="group -mx-1.5 flex w-[calc(100%+12px)] items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] text-text-secondary transition-colors hover:bg-white/[0.04] hover:text-text-primary"
          aria-label={`Copy email ${s.email}`}
        >
          <EnvelopeSimple aria-hidden weight="bold" className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <span className="truncate">{s.email}</span>
          <Copy aria-hidden weight="bold" className="ml-auto h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
        </button>
        {s.discord && (
          <button
            type="button"
            onClick={() => onCopy(s.discord!, 'Discord')}
            className="group -mx-1.5 flex w-[calc(100%+12px)] items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] text-text-secondary transition-colors hover:bg-white/[0.04] hover:text-text-primary"
            aria-label={`Copy Discord ${s.discord}`}
          >
            <ChatCircleText aria-hidden weight="bold" className="h-3.5 w-3.5 shrink-0 text-[#8B93F8]" />
            <span className="truncate">{s.discord}</span>
            <Copy aria-hidden weight="bold" className="ml-auto h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
          </button>
        )}
      </div>

      {/* Games */}
      <div className="mt-3.5">
        <p className="mb-1.5 text-[12px] font-medium text-text-tertiary">Games</p>
        {games.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {games.map((g, i) => {
              const { label, icon, custom } = resolveGame(g, gameMeta)
              return (
                <span
                  key={`${g}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-1 pr-2.5 text-[12px] font-medium text-text-secondary"
                >
                  {icon ? (
                    <Image src={icon} alt="" width={16} height={16} className="h-4 w-4 rounded-full object-contain" />
                  ) : (
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-white/[0.08]">
                      <Sparkle aria-hidden weight="fill" className="h-2.5 w-2.5 text-text-secondary" />
                    </span>
                  )}
                  {label}
                  {custom && <span className="text-[10.5px] text-text-tertiary">Custom</span>}
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
        <div className="flex items-center gap-2.5 rounded-md bg-bg-overlay px-3 py-2">
          <TrendUp aria-hidden weight="bold" className="h-4 w-4 shrink-0 text-success" />
          <div className="min-w-0">
            <div className="text-[12px] text-text-tertiary">Monthly Volume</div>
            <div className="text-[13.5px] font-semibold text-text-primary">{volume ?? 'Not shared'}</div>
          </div>
        </div>
        {(s.sells || s.note) && (
          <div className="rounded-md bg-bg-overlay px-3 py-2">
            <div className="mb-0.5 text-[12px] text-text-tertiary">Experience / Note</div>
            {s.sells && <p className="text-[13px] leading-snug text-text-secondary">{s.sells}</p>}
            {s.note && <p className="mt-0.5 text-[12.5px] leading-snug text-text-tertiary">{s.note}</p>}
          </div>
        )}
      </div>

      {/* Actions — pinned to the bottom */}
      <div className="mt-auto flex items-center gap-2 pt-4">
        <select
          value={s.status}
          disabled={busy}
          onChange={(e) => onChangeStatus(s.id, e.target.value as EarlySellerStatus)}
          aria-label={`Status for @${s.username}`}
          className="h-9 min-w-0 flex-1 cursor-pointer rounded-md border border-transparent bg-bg-overlay px-2.5 text-base font-medium text-text-primary transition-colors hover:border-white/[0.08] focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft disabled:opacity-40 sm:text-[13px] [&>option]:bg-bg-raised"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{STATUS_LABEL[opt]}</option>
          ))}
        </select>
        {busy && <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin text-text-tertiary" />}
        <button
          type="button"
          onClick={() => onInvite(s.id)}
          disabled={inviting}
          title="Send Founding HQ magic-link invite"
          className={cn(adminBtnSm.secondary, 'h-9')}
        >
          {inviting ? (
            <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PaperPlaneTilt aria-hidden weight="bold" className="h-3.5 w-3.5" />
          )}
          Invite
        </button>
      </div>
    </motion.div>
  )
}
