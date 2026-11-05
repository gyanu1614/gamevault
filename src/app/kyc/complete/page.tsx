/**
 * /kyc/complete: where the ID check provider's page sends a seller when they
 * finish. Opened from Settings or the withdrawal page, so it hands back to that
 * tab and closes itself; that tab re-reads the result when it regains focus. The
 * card is the fallback when the window cannot close itself. The decision is always
 * read on the server, and the status in this URL is never trusted.
 */

'use client'

import { useEffect, useState } from 'react'
import { SealCheckIcon } from '@phosphor-icons/react/dist/csr/SealCheck'
import Link from '@/components/navigation/AppLink'
import { accountBtn } from '@/components/account/AccountSurface'

export default function KycCompletePage() {
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('verificationSessionId')
    if (!window.opener || !sessionId) return
    try {
      // The retired application wizard still listens for this message.
      window.opener.postMessage({ type: 'didit:complete', sessionId, status: params.get('status') }, window.location.origin)
      setClosing(true)
      const timer = setTimeout(() => window.close(), 900)
      return () => clearTimeout(timer)
    } catch {
      /* opener gone: the card below handles it */
    }
  }, [])

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg-base p-4">
      <div className="w-full max-w-sm rounded-lg bg-bg-raised p-6 text-center">
        <span aria-hidden className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-[rgba(106,168,255,0.12)] text-[#6AA8FF]">
          <SealCheckIcon size={28} weight="duotone" />
        </span>
        <h1 className="mt-4 text-balance text-[18px] font-semibold text-text-primary">Verification Submitted</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">
          {closing ? 'Returning you to DropMarket…' : 'Your status updates in Settings once the review is complete.'}
        </p>
        {!closing && (
          <Link href="/account/settings?tab=seller" className={`${accountBtn.primary} mt-5 w-full`}>
            Back To Settings
          </Link>
        )}
      </div>
    </div>
  )
}
