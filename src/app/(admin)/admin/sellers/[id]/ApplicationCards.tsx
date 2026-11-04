'use client'

import Link from '@/components/navigation/AppLink'
import { cn } from '@/lib/utils'
import type { SellerApplication, KYCDocument } from '@/lib/actions/admin-sellers'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { DOCUMENT_TYPE_LABELS } from '@/lib/seller-application/labels'
import {
  ArrowRight,
  ArrowSquareOut,
  CheckCircle,
  ClockCounterClockwise,
  FileArrowDown,
  GameController,
  IdentificationCard,
  NotePencil,
  ShieldCheck,
  Signature,
  User,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { accountInputCls } from '@/components/account/AccountSurface'
import { AdminPanel, IconChip, adminBtn } from '../../components/kit'
import { GameTile } from '../../components/GameTile'
import { fmtDate, fmtDateTime, isImageFile, titleFromSlug } from './application-format'

export interface GameRow {
  key: string
  name: string
  image: string | null
  cats: string[]
}

export interface TimelineItem {
  title: string
  when: string
  open?: boolean
}

// ─── Small primitives ────────────────────────────────────────────────────────

function Card({
  icon,
  title,
  sub,
  children,
  className,
}: {
  icon: PhosphorIcon
  title: string
  sub?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <AdminPanel className={className}>
      <div className="mb-4 flex items-start gap-3">
        <IconChip icon={icon} />
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-tight text-text-primary">{title}</h2>
          {sub && <p className="mt-1 text-[12.5px] leading-relaxed text-text-tertiary">{sub}</p>}
        </div>
      </div>
      {children}
    </AdminPanel>
  )
}

function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-medium text-text-tertiary">{k}</div>
      <div className={cn('mt-0.5 break-words text-[13.5px] text-text-primary', mono && 'font-mono text-[12.5px]')}>{v || '—'}</div>
    </div>
  )
}

// ─── Main column ─────────────────────────────────────────────────────────────

export function GamesCard({
  application,
  gameRows,
}: {
  application: SellerApplication
  gameRows: GameRow[]
}) {
  return (
    <Card icon={GameController} title="Games & Categories" sub="What they applied to sell, per game, from the live category map.">
      {gameRows.length === 0 && !application.other_games ? (
        <p className="text-[13px] text-text-tertiary">No games selected.</p>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {gameRows.map((row) => (
            <div key={row.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <GameTile src={row.image} name={row.name} className="h-10 w-10 text-[14px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-text-primary">{row.name}</p>
                {row.cats.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.cats.map((cat) => (
                      <span key={cat} className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                        {titleFromSlug(cat)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {row.cats.length > 0 && (
                <span className="shrink-0 text-[12px] text-text-tertiary">
                  {row.cats.length} {row.cats.length === 1 ? 'Category' : 'Categories'}
                </span>
              )}
            </div>
          ))}
          {application.other_games && (
            <div className="flex items-center gap-3 py-3 last:pb-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-warning-bg text-[15px] font-bold text-warning">+</span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-text-primary">Other Games</p>
                <p className="mt-0.5 text-[12.5px] italic text-text-tertiary">“{application.other_games}”</p>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export function DocumentsCard({
  diditSessionId,
  diditDoc,
  uploadedDocs,
  documentUrls,
  loadingUrls,
  onViewSession,
}: {
  diditSessionId: string | null
  diditDoc: KYCDocument | null
  uploadedDocs: KYCDocument[]
  documentUrls: Record<string, string>
  loadingUrls: boolean
  onViewSession: () => void
}) {
  // ── Doc tile presentation ──
  const docCaption = (doc: KYCDocument): { title: string; sub: string } => {
    const title =
      DOCUMENT_TYPE_LABELS[doc.document_type] ?? titleFromSlug(doc.document_type)
    if (
      diditSessionId &&
      ['id_front', 'id_back', 'selfie_with_id'].includes(doc.document_type)
    ) {
      return { title, sub: 'covered by Didit · optional' }
    }
    return { title, sub: `uploaded ${fmtDate(doc.uploaded_at)}` }
  }

  return (
    <Card icon={IdentificationCard} title="Identity & Documents" sub="Didit decision and uploaded evidence (signed links, click to open).">
      {diditSessionId && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-success-bg px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-success">Didit Video Verification — Approved</p>
            <p className="mt-0.5 text-[12.5px] text-text-secondary">
              Govt ID + liveness + face match passed · Session{' '}
              <span className="font-mono">{diditSessionId.slice(0, 8)}…</span>
              {diditDoc?.uploaded_at && <> · {fmtDateTime(diditDoc.uploaded_at)}</>}
            </p>
          </div>
          <button
            type="button"
            onClick={onViewSession}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-primary underline-offset-4 hover:underline"
          >
            View Session
            <ArrowSquareOut aria-hidden weight="bold" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {uploadedDocs.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {uploadedDocs.map((doc) => {
            const url = documentUrls[doc.file_path]
            const caption = docCaption(doc)
            const thumb = loadingUrls ? (
              <div className="skeleton h-[84px]" />
            ) : url && isImageFile(doc.file_name) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={caption.title} className="h-[84px] w-full object-cover" />
            ) : (
              <div className="grid h-[84px] place-items-center bg-white/[0.04] text-[12px] font-semibold text-text-tertiary">
                {url ? (/\.pdf$/i.test(doc.file_name || '') ? 'PDF' : 'File') : 'Unavailable'}
              </div>
            )
            const body = (
              <>
                <div className="overflow-hidden">{thumb}</div>
                <div className="px-3 py-2">
                  <p className="truncate text-[12.5px] font-semibold text-text-primary">{caption.title}</p>
                  <p className="truncate text-[11.5px] text-text-tertiary">{caption.sub}</p>
                </div>
              </>
            )
            return url ? (
              <a
                key={doc.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-md bg-bg-overlay transition-colors hover:bg-bg-overlay-2"
              >
                {body}
              </a>
            ) : (
              <div key={doc.id} className="overflow-hidden rounded-md bg-bg-overlay">
                {body}
              </div>
            )
          })}
        </div>
      ) : (
        !diditSessionId && <p className="text-[13px] text-text-tertiary">No documents uploaded yet.</p>
      )}
    </Card>
  )
}

export function AgreementCard({ application }: { application: SellerApplication }) {
  const consents = [
    { label: 'Terms', ok: !!application.accepted_seller_agreement },
    { label: 'Privacy', ok: !!application.accepted_privacy_policy },
    { label: 'Fee Schedule', ok: !!application.accepted_commission_structure },
    { label: 'Anti-Fraud', ok: !!application.accepted_anti_fraud_policy },
    { label: 'Data Processing', ok: !!application.accepted_data_processing },
    { label: 'Accuracy', ok: !!application.information_accurate_confirmed },
  ]

  return (
    <Card icon={Signature} title="Experience & Agreement" sub="Track record and the signed Seller Agency Agreement.">
      {application.selling_experience ? (
        <blockquote className="rounded-md bg-bg-overlay px-4 py-3 text-[13.5px] italic leading-relaxed text-text-secondary">
          “{application.selling_experience}”
        </blockquote>
      ) : (
        <p className="text-[13px] text-text-tertiary">No selling experience provided.</p>
      )}

      {application.seller_signature && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md bg-bg-overlay px-4 py-3">
          {application.seller_signature_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={application.seller_signature_image}
              alt="Drawn signature"
              className="h-14 max-w-[180px] shrink-0 rounded-md bg-white object-contain px-2 py-1"
            />
          )}
          <div className="min-w-0">
            <p
              className="text-[22px] leading-tight text-text-primary"
              style={{ fontFamily: "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', cursive" }}
            >
              {application.seller_signature}
            </p>
            <p className="mt-0.5 text-[12px] text-text-tertiary">
              Signed {fmtDateTime(application.seller_signed_at)} · Seller Agency Agreement
            </p>
          </div>
        </div>
      )}

      <a href={`/api/admin/seller-agreement/${application.id}`} className={cn(adminBtn.secondary, 'mt-3')}>
        <FileArrowDown aria-hidden weight="bold" className="h-4 w-4" />
        Download Signed Agreement (PDF)
      </a>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {consents.map((c) => (
          <span
            key={c.label}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold',
              c.ok ? 'bg-success-bg text-success' : 'bg-white/[0.05] text-text-disabled',
            )}
          >
            {c.ok && <CheckCircle aria-hidden weight="fill" className="h-3.5 w-3.5" />}
            {c.label}
          </span>
        ))}
      </div>
    </Card>
  )
}

// ─── Rail ────────────────────────────────────────────────────────────────────

export function ApplicantCard({ application }: { application: SellerApplication }) {
  return (
    <Card icon={User} title="Applicant" sub="The account behind the store.">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getAvatarUrl(application.user.avatar_url, application.user.username || application.user.email)}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-text-primary">
            {application.user.username || application.user.full_name || 'Unknown User'}
          </p>
          <p className="truncate text-[12.5px] text-text-tertiary">{application.user.email}</p>
          {application.user.created_at && (
            <p className="text-[12.5px] text-text-tertiary">
              Member since{' '}
              {new Date(application.user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>
      {/* Phone / city are no longer part of the slimmed application
          (KYC captures identity; profile details live in Settings). */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.06] pt-4">
        <KV k="Legal Name" v={application.full_legal_name || '—'} />
        <KV k="Country" v={application.country || '—'} />
        <KV k="Languages" v={application.languages_spoken?.length ? application.languages_spoken.join(', ') : '—'} />
      </div>
    </Card>
  )
}

export function TimelineCard({ timeline }: { timeline: TimelineItem[] }) {
  return (
    <Card icon={ClockCounterClockwise} title="Timeline">
      <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-white/[0.08]">
        {timeline.map((item, i) => (
          <li key={`${item.title}-${i}`} className="relative pl-6">
            <span
              aria-hidden
              className={cn(
                'absolute left-0 top-1 h-[11px] w-[11px] rounded-full ring-4 ring-bg-raised',
                item.open ? 'bg-warning' : 'bg-white/[0.3]',
              )}
            />
            <p className="text-[13.5px] font-medium text-text-primary">{item.title}</p>
            <p className="text-[12.5px] text-text-tertiary">{item.when}</p>
          </li>
        ))}
      </ol>
    </Card>
  )
}

export function AdminNotesCard({
  adminNotes,
  setAdminNotes,
}: {
  adminNotes: string
  setAdminNotes: (value: string) => void
}) {
  return (
    <Card icon={NotePencil} title="Admin Notes" sub="Internal, attached to the decision when you approve or reject.">
      <textarea
        value={adminNotes}
        onChange={(e) => setAdminNotes(e.target.value)}
        aria-label="Admin notes"
        placeholder="e.g. Selfie is blurry — ask for a re-upload…"
        rows={3}
        className={cn(accountInputCls, 'resize-none')}
      />
    </Card>
  )
}

export function SellerManagementCard({ application }: { application: SellerApplication }) {
  return (
    <Card icon={ShieldCheck} title="Seller Management" sub="Tier, wallet, payouts and restrictions live in the seller hub.">
      <Link href={`/admin/active-sellers/${application.user_id}`} className={cn(adminBtn.primary, 'w-full')}>
        Open Seller Management
        <ArrowRight aria-hidden weight="bold" className="h-4 w-4" />
      </Link>
    </Card>
  )
}
