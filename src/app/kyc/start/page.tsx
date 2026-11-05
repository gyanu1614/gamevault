/**
 * /kyc/start: the new tab the ID check opens in. Starting here instead of in the
 * page behind means no blank tab that flashes and closes, no pop-up block, and a
 * real page to explain a failure, instead of a toast on a tab the seller just left.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SealCheckIcon } from '@phosphor-icons/react/dist/csr/SealCheck'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { Loader2 } from 'lucide-react'
import Link from '@/components/navigation/AppLink'
import { IconTile, accountBtn } from '@/components/account/AccountSurface'
import { startIdentityCheck } from '@/lib/actions/identity-check'
import { cn } from '@/lib/utils'

export default function KycStartPage() {
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const run = useCallback(async () => {
    setError(null)
    try {
      const result = await startIdentityCheck()
      if (result.ok) {
        window.location.replace(result.url)
        return
      }
      setError(result.error)
    } catch {
      setError('Please try again in a moment.')
    }
  }, [])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void run()
  }, [run])

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-bg-base p-4">
      <div className="w-full max-w-sm rounded-lg bg-bg-raised p-6 text-center">
        <IconTile tone={error ? 'attention' : 'trust'} className="mx-auto h-12 w-12">
          {error ? <WarningCircleIcon size={28} weight="duotone" /> : <SealCheckIcon size={28} weight="duotone" />}
        </IconTile>

        {error ? (
          <>
            <h1 className="mt-4 text-balance text-[18px] font-semibold text-text-primary">Verification Couldn’t Start</h1>
            <p role="alert" className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">{error}</p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={() => void run()} className={cn(accountBtn.primary, 'w-full')}>
                Try Again
              </button>
              <Link href="/account/settings?tab=seller" className={cn(accountBtn.secondary, 'w-full')}>
                Back To Settings
              </Link>
            </div>
            <p className="mt-4 text-[12.5px] text-text-tertiary">
              Need help? Email{' '}
              <a href="mailto:support@dropmarket.gg" className="font-medium text-text-secondary underline underline-offset-2 hover:text-text-primary">
                support@dropmarket.gg
              </a>
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-balance text-[18px] font-semibold text-text-primary">Starting Verification…</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">Have your ID ready.</p>
            <Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-text-tertiary" aria-hidden />
          </>
        )}
      </div>
    </main>
  )
}
