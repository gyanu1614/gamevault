/**
 * /kyc/complete — landing for the Didit hosted-verification popup/tab. Didit
 * appends ?verificationSessionId=…&status=… here when the user finishes.
 *
 * This page's job is to get the user BACK INTO THE WIZARD with zero effort:
 * it posts the session result to the opener (the application tab, which
 * auto-verifies and flips the Identity step) and then closes itself. The
 * visible card is only a fallback for when the window can't self-close
 * (opened manually / no opener) — it offers a Return To Application link.
 * The decision itself is always re-verified SERVER-side (checkKycSession);
 * the status in the URL is never trusted.
 */

'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, Loader2 } from 'lucide-react'

export default function KycCompletePage() {
  const [selfClosing, setSelfClosing] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('verificationSessionId')
    const status = params.get('status')

    if (window.opener && sessionId) {
      // Hand the result back to the wizard tab (same-origin only).
      try {
        window.opener.postMessage(
          { type: 'didit:complete', sessionId, status },
          window.location.origin,
        )
        setSelfClosing(true)
        // Give the message a beat to land, then close this tab.
        setTimeout(() => window.close(), 900)
      } catch {
        /* opener gone — the fallback card below handles it */
      }
    }
  }, [])

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-8 text-center"
        style={{ borderColor: '#E4E5DE', backgroundColor: '#FFFFFF' }}
      >
        <div className="mb-5 flex justify-center">
          <Image
            src="/brand/logo-mark-ink.png"
            alt="DropMarket"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
        </div>
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(163,230,53,0.3)' }}
        >
          {selfClosing ? (
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#1B5E3A' }} />
          ) : (
            <CheckCircle2 className="h-6 w-6" style={{ color: '#1B5E3A' }} />
          )}
        </div>
        <h1 className="text-xl font-semibold" style={{ color: '#14432A' }}>
          {selfClosing ? 'Returning You To Your Application…' : 'Verification Complete'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: '#5B6157' }}>
          {selfClosing
            ? 'This tab will close itself — your application picks up right where you left off.'
            : 'Head back to your application to continue.'}
        </p>
        {!selfClosing && (
          <button
            type="button"
            onClick={() => {
              // Your application lives in the ORIGINAL tab — closing this one
              // lands you right back on it. Re-notify the opener first, then
              // close; only navigate if the browser refuses to close us.
              const params = new URLSearchParams(window.location.search)
              const sessionId = params.get('verificationSessionId')
              try {
                if (window.opener && sessionId) {
                  window.opener.postMessage(
                    { type: 'didit:complete', sessionId, status: params.get('status') },
                    window.location.origin,
                  )
                }
              } catch {
                /* opener gone */
              }
              window.close()
              setTimeout(() => {
                if (!window.closed) window.location.href = '/account/become-seller'
              }, 400)
            }}
            className="mt-6 inline-flex items-center justify-center rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: '#14432A' }}
          >
            Return To Application
          </button>
        )}
      </div>
    </div>
  )
}
