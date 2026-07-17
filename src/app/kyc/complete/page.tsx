/**
 * /kyc/complete — landing for the Didit hosted-verification NEW TAB. The
 * seller application (with all its wizard state) lives in the ORIGINAL tab,
 * so this page only confirms the hand-off and sends them back. Didit appends
 * ?verificationSessionId=…&status=… — cosmetic here; the wizard verifies the
 * decision server-side via checkKycSession.
 */

import Image from 'next/image'
import { CheckCircle2 } from 'lucide-react'

export default function KycCompletePage() {
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
          <CheckCircle2 className="h-6 w-6" style={{ color: '#1B5E3A' }} />
        </div>
        <h1 className="text-xl font-semibold" style={{ color: '#14432A' }}>
          Verification Submitted
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: '#5B6157' }}>
          You can close this tab now. Head back to your application tab and
          press <span className="font-semibold">Check Status</span> to continue.
        </p>
      </div>
    </div>
  )
}
