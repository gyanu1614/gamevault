'use client'

/**
 * Seller detail, right column records: Signup, Seller Agreement and
 * Wallet & Payouts (with the withdrawal approve / reject buttons).
 */

import { cn } from '@/lib/utils'
import type { SellerDetail } from '@/lib/actions/admin-seller-detail'
import { decimal, money, signedMoney } from '@/lib/seller/format-amount'
import { adminBtnSm } from '../../components/kit'
import { Badge, Section } from './SellerDetailParts'
import type { DialogKind } from './SellerDetailDialogParts'
import { CURRENCY_SYMBOL, INNER_LABEL, ROWS, fmtDate, titleCase } from './seller-detail-format'

export function SellerSignupSection({ detail }: { detail: SellerDetail }) {
  return (
    <Section title="Signup" sub="What they told us on /founding: where they are, how to reach them, what they sell.">
      {detail.onboarding ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-3">
          <div><dt className="text-text-tertiary">Full name</dt><dd className="mt-0.5 font-medium text-text-primary">{detail.onboarding.full_name ?? '—'}</dd></div>
          <div className="col-span-2"><dt className="text-text-tertiary">Address</dt><dd className="mt-0.5 font-medium text-text-primary">{[detail.onboarding.address_line, detail.onboarding.city].filter(Boolean).join(', ') || '—'}</dd></div>
          <div><dt className="text-text-tertiary">Country</dt><dd className="mt-0.5 font-medium text-text-primary">{detail.onboarding.country ?? '—'}</dd></div>
          <div><dt className="text-text-tertiary">Expected sales</dt><dd className="mt-0.5 font-medium text-text-primary">{({ under_100: 'Under $100 / mo', '100_500': '$100–500 / mo', '500_2000': '$500–2,000 / mo', '2000_plus': 'Over $2,000 / mo' } as Record<string, string>)[detail.onboarding.expected_volume ?? ''] ?? '—'}</dd></div>
          <div><dt className="text-text-tertiary">Discord</dt><dd className="mt-0.5 font-medium text-text-primary">{detail.onboarding.discord ? `@${detail.onboarding.discord.replace(/^@/, '')}` : '—'}</dd></div>
          <div><dt className="text-text-tertiary">Came from</dt><dd className="mt-0.5 font-medium text-text-primary">{detail.onboarding.source ?? '—'}</dd></div>
          <div><dt className="text-text-tertiary">Started</dt><dd className="mt-0.5 font-medium text-text-primary">{new Date(detail.onboarding.started_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</dd></div>
          <div><dt className="text-text-tertiary">Finished</dt><dd className="mt-0.5 font-medium text-text-primary">{detail.onboarding.completed_at ? new Date(detail.onboarding.completed_at).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : `Stuck at step ${detail.onboarding.current_step ?? '?'} of 4`}</dd></div>
          <div className="col-span-2 sm:col-span-3"><dt className="text-text-tertiary">Sells</dt><dd className="mt-1 flex flex-wrap gap-1.5">{detail.onboarding.sells.length ? detail.onboarding.sells.map((g) => <span key={g} className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[12px] font-medium text-text-secondary">{g}</span>) : <span className="font-medium text-text-primary">—</span>}</dd></div>
        </dl>
      ) : (
        <p className="text-[13px] text-text-tertiary">No open-signup record. This seller came through the older application flow.</p>
      )}
    </Section>
  )
}

export function SellerAgreementSection({ detail }: { detail: SellerDetail }) {
  return (
    <Section title="Seller Agreement" sub="Signed Seller Agency Agreement (open seller signup). Newest first.">
      {(detail.agreements ?? []).length === 0 ? (
        <p className="text-[13px] text-text-tertiary">
          {detail.application ? 'Signed inside the original seller application (see Application below).' : 'No e-signature on file.'}
        </p>
      ) : (
        <ul className={ROWS}>
          {(detail.agreements ?? []).map((a) => (
            <li key={a.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 text-[13px]">
                <p className="font-medium text-text-primary">
                  {a.typed_name} <span className="text-text-tertiary">· {a.version}</span>
                </p>
                <p className="mt-0.5 text-text-secondary">{new Date(a.signed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</p>
                <p className="mt-0.5 truncate text-[12px] text-text-tertiary" title={a.user_agent ?? undefined}>
                  IP {a.ip ?? '—'}{a.user_agent ? ` · ${a.user_agent.slice(0, 60)}${a.user_agent.length > 60 ? '…' : ''}` : ''}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-text-tertiary" title="SHA-256 of the agreement text as signed">{a.sha256.slice(0, 16)}…</p>
              </div>
              {a.signature_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.signature_url} alt={`Signature of ${a.typed_name}`} className="h-16 w-auto max-w-[220px] shrink-0 rounded-md bg-white object-contain p-1" />
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

export function SellerWalletSection({
  detail,
  busy,
  setDialog,
}: {
  detail: SellerDetail
  busy: boolean
  setDialog: (dialog: DialogKind) => void
}) {
  return (
    <Section title="Wallet & Payouts" sub="Balances, wallet activity and withdrawal requests.">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {[
          { label: 'Seller Balance', rows: detail.wallet.sellerBalances },
          { label: 'Store Credit', rows: detail.wallet.storeCreditBalances },
        ].map((box) => (
          <div key={box.label} className="rounded-md bg-bg-overlay px-3.5 py-3">
            <p className="text-[12px] font-medium text-text-tertiary">{box.label}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {box.rows.map((b) => (
                <span key={b.currency} className="text-[16px] font-bold tabular-nums text-text-primary">
                  {CURRENCY_SYMBOL[b.currency] ?? `${b.currency} `}
                  {decimal(b.amount)}
                  <span className="ml-1 text-[11.5px] font-semibold text-text-tertiary">{b.currency}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {detail.wallet.transactions.length > 0 && (
        <div className="mt-4">
          <p className={INNER_LABEL}>Recent Wallet Activity</p>
          <div className={ROWS}>
            {detail.wallet.transactions.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0">
                <span className="text-[13px] font-medium text-text-primary">{titleCase(t.type)}</span>
                {t.description && (
                  <span className="min-w-0 flex-1 truncate text-[12px] text-text-tertiary">{t.description}</span>
                )}
                <span className={cn('ml-auto text-[13px] font-semibold tabular-nums', t.amount < 0 ? 'text-error' : 'text-success')}>
                  {signedMoney(t.amount)}
                </span>
                <span className="w-[92px] text-right text-[12px] text-text-tertiary">{fmtDate(t.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className={INNER_LABEL}>Withdrawal Requests</p>
        {detail.withdrawals.length === 0 ? (
          <p className="text-[13px] text-text-tertiary">No withdrawal requests.</p>
        ) : (
          <div className={ROWS}>
            {detail.withdrawals.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0">
                <span className="text-[13.5px] font-semibold tabular-nums text-text-primary">{money(w.amount)}</span>
                {w.net_amount != null && w.net_amount !== w.amount && (
                  <span className="text-[12px] tabular-nums text-text-tertiary">net {money(w.net_amount)}</span>
                )}
                <span className="text-[12.5px] text-text-secondary">{w.method_name || '—'}</span>
                <Badge status={w.status} />
                <span className="text-[12px] text-text-tertiary">{fmtDate(w.created_at)}</span>
                {w.status === 'pending' && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDialog({ kind: 'withdrawal-reject', requestId: w.id, amount: w.amount })}
                      className={adminBtnSm.danger}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDialog({ kind: 'withdrawal-approve', requestId: w.id, amount: w.amount })}
                      className={adminBtnSm.secondary}
                    >
                      Approve
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
