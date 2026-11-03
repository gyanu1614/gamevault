'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ArrowSquareOut, CircleNotch, Copy } from '@phosphor-icons/react'
import {
  getDiditSessionDetails,
  type DiditSessionDetailsResult,
} from '@/lib/actions/admin-didit'
import { StatusBadge } from '../../components/kit'
import { FIELD_LABEL, diditTone } from './application-format'

// ─── Didit session details ───────────────────────────────────────────────────

export default function DiditSessionBody({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(true)
  const [details, setDetails] = useState<Extract<
    DiditSessionDetailsResult,
    { success: true }
  > | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getDiditSessionDetails(sessionId)
      .then((res) => {
        if (cancelled) return
        if (res.success) setDetails(res)
        else setError(res.error)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the session details.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const copySessionId = async () => {
    try {
      await navigator.clipboard.writeText(sessionId)
      toast.success('Session ID copied')
    } catch {
      toast.error('Could not copy the session ID')
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-8">
          <CircleNotch aria-hidden weight="bold" className="h-6 w-6 animate-spin text-text-tertiary" />
        </div>
      ) : error ? (
        <p role="alert" className="rounded-md bg-error-bg px-3.5 py-3 text-[13px] leading-relaxed text-error">
          {error}
        </p>
      ) : details ? (
        <>
          <div className="flex flex-col items-center gap-1.5 py-1">
            <StatusBadge status={details.status} tone={diditTone(details.status)} className="px-3 py-1 text-[13px]" />
            {details.sessionNumber != null && (
              <span className="text-[12px] text-text-tertiary">Session #{details.sessionNumber}</span>
            )}
          </div>

          <button
            type="button"
            onClick={copySessionId}
            aria-label="Copy session ID"
            className="flex w-full items-center justify-between gap-3 rounded-md bg-bg-overlay px-3.5 py-2.5 text-left transition-colors hover:bg-bg-overlay-2"
          >
            <code className="min-w-0 truncate font-mono text-[12px] text-text-secondary">{sessionId}</code>
            <Copy aria-hidden weight="bold" className="h-4 w-4 shrink-0 text-text-tertiary" />
          </button>

          {details.features.length > 0 && (
            <div>
              <p className={FIELD_LABEL}>Verification Checks</p>
              <div className="divide-y divide-white/[0.06] rounded-md bg-bg-overlay px-3.5">
                {details.features.map((feature, i) => (
                  <div key={`${feature.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[13px] text-text-primary">{feature.name}</span>
                    <StatusBadge status={feature.status} tone={diditTone(feature.status)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      <div className="flex justify-end">
        <a
          href="https://business.didit.me"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
        >
          Open Didit Console
          <ArrowSquareOut aria-hidden weight="bold" className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}
