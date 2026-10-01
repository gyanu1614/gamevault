'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleNotch, ShieldCheck } from '@phosphor-icons/react'
import { verifyMFAChallenge } from '@/lib/actions/admin-mfa'
import { accountBtn } from '@/components/account/AccountSurface'
import { CodeInput } from '@/components/ui/code-input'
import { cn } from '@/lib/utils'
import { GateHeader, codeErrorMessage } from './GateHeader'

interface VerifyFormProps {
  factorId: string
}

export function VerifyForm({ factorId }: VerifyFormProps) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const verify = async (value: string) => {
    if (value.length !== 6 || loading) return
    setLoading(true)
    setError(null)

    const result = await verifyMFAChallenge(factorId, value)

    if (result.success) {
      toast.success('Verified')
      router.push('/admin')
      router.refresh()
      return
    }
    setError(codeErrorMessage(result.error))
    setAttempt((n) => n + 1)
    setCode('')
    setLoading(false)
    // The field was disabled while checking; put the cursor back in it.
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void verify(code)
      }}
    >
      <GateHeader icon={<ShieldCheck weight="bold" className="h-[22px] w-[22px]" aria-hidden />} title="Two-Factor Verification">
        Enter the 6-digit code from your authenticator app to open the admin panel.
      </GateHeader>

      <CodeInput
        ref={inputRef}
        value={code}
        onChange={(v) => {
          setCode(v)
          if (error) setError(null)
        }}
        onComplete={verify}
        disabled={loading}
        autoFocus
        invalid={!!error}
        invalidKey={attempt}
      />

      <p role="alert" className={cn('mt-2.5 min-h-[18px] text-[12.5px] text-error', !error && 'invisible')}>
        {error ?? ' '}
      </p>

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className={cn(accountBtn.primary, 'mt-3 h-11 w-full text-[14px]')}
      >
        {loading && <CircleNotch weight="bold" className="h-4 w-4 animate-spin" aria-hidden />}
        {loading ? 'Verifying…' : 'Verify'}
      </button>
    </form>
  )
}
