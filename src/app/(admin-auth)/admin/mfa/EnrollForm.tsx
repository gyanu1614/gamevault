'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { Check, CircleNotch, Copy, QrCode, ShieldCheck } from '@phosphor-icons/react'
import { enrollTOTP, verifyMFAChallenge } from '@/lib/actions/admin-mfa'
import { accountBtn } from '@/components/account/AccountSurface'
import { CodeInput } from '@/components/ui/code-input'
import { cn } from '@/lib/utils'
import { GateHeader, codeErrorMessage } from './GateHeader'

type Step = 'scan' | 'verify' | 'done'

export function EnrollForm() {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState<Step>('scan')
  const [starting, setStarting] = useState(true)
  const [startError, setStartError] = useState<string | null>(null)
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEnrollment = useCallback(async () => {
    setStarting(true)
    setStartError(null)
    const result = await enrollTOTP()
    if (!result.success || !result.factorId) {
      setStartError(result.error || 'Could not start two-factor setup.')
      setStarting(false)
      return
    }
    setFactorId(result.factorId)
    setQrCode(result.qrCode ?? '')
    setSecret(result.secret ?? '')
    setStarting(false)
  }, [])

  // Start enrolment once on mount (a fresh factor; stale unverified ones are
  // removed server-side). The ref stops React's dev double-mount from racing
  // two enrolments, where the second deletes the factor the first displays.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void startEnrollment()
  }, [startEnrollment])

  const confirm = async (value: string) => {
    if (value.length !== 6 || loading) return
    setLoading(true)
    setError(null)

    const result = await verifyMFAChallenge(factorId, value)

    if (result.success) {
      setStep('done')
      toast.success('Two-factor authentication is on')
      setTimeout(() => {
        router.push('/admin')
        router.refresh()
      }, 1200)
      return
    }
    setError(codeErrorMessage(result.error))
    setAttempt((n) => n + 1)
    setCode('')
    setLoading(false)
    // The field was disabled while checking; put the cursor back in it.
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const copySecret = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Couldn’t copy. Select the key and copy it manually.')
    }
  }

  const slide = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
      }

  if (step === 'done') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center py-6 text-center"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success">
          <Check weight="bold" className="h-6 w-6" aria-hidden />
        </div>
        <p className="text-[17px] font-bold text-text-primary">Two-Factor Is On</p>
        <p className="mt-1 text-[13.5px] text-text-secondary">Opening the admin panel…</p>
      </motion.div>
    )
  }

  return (
    <div>
      {/* Step 1 of 2 — two bars, the current one filled */}
      <div className="mb-5 flex items-center gap-3" aria-label={`Step ${step === 'scan' ? 1 : 2} of 2`}>
        <div className="flex flex-1 gap-1.5">
          <span className="h-1 flex-1 rounded-full bg-text-primary" />
          <span
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              step === 'verify' ? 'bg-text-primary' : 'bg-white/[0.10]',
            )}
          />
        </div>
        <span className="text-[12px] font-medium tabular-nums text-text-tertiary">
          Step {step === 'scan' ? 1 : 2} of 2
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === 'scan' ? (
          <motion.div key="scan" {...slide} transition={{ duration: 0.2, ease: 'easeOut' }}>
            <GateHeader icon={<QrCode weight="bold" className="h-[22px] w-[22px]" aria-hidden />} title="Set Up Two-Factor">
              Admin access needs a code from an authenticator app. Scan this with Google
              Authenticator, 1Password, Authy or any TOTP app.
            </GateHeader>

            {startError ? (
              <div className="space-y-3">
                <p role="alert" className="rounded-md bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] px-3.5 py-3 text-[13px] text-error">
                  {startError}
                </p>
                <button type="button" onClick={startEnrollment} className={cn(accountBtn.secondary, 'h-11 w-full text-[14px]')}>
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-center">
                  {starting || !qrCode ? (
                    <div className="skeleton h-[192px] w-[192px] rounded-lg" aria-label="Generating QR code" />
                  ) : (
                    // Supabase returns the QR as an SVG data URI.
                    <div className="rounded-lg bg-white p-3">
                      <Image src={qrCode} alt="Two-factor QR code" width={168} height={168} unoptimized />
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <p className="mb-1.5 text-[12.5px] text-text-tertiary">Can’t scan? Enter this key instead:</p>
                  {starting || !secret ? (
                    <div className="skeleton h-10 w-full rounded-md" aria-hidden />
                  ) : (
                    <button
                      type="button"
                      onClick={copySecret}
                      aria-label="Copy setup key"
                      className="flex w-full items-center justify-between gap-3 rounded-md bg-bg-overlay px-3.5 py-2.5 text-left transition-colors hover:bg-bg-overlay-2"
                    >
                      <code className="min-w-0 break-all font-mono text-[12px] tracking-wide text-text-secondary">{secret}</code>
                      {copied ? (
                        <Check weight="bold" className="h-4 w-4 shrink-0 text-success" aria-hidden />
                      ) : (
                        <Copy weight="bold" className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
                      )}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setStep('verify')}
                  disabled={starting || !factorId}
                  className={cn(accountBtn.primary, 'mt-5 h-11 w-full text-[14px]')}
                >
                  Next
                </button>
              </>
            )}
          </motion.div>
        ) : (
          <motion.form
            key="verify"
            {...slide}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onSubmit={(e) => {
              e.preventDefault()
              void confirm(code)
            }}
          >
            <GateHeader icon={<ShieldCheck weight="bold" className="h-[22px] w-[22px]" aria-hidden />} title="Enter the Code">
              Type the 6-digit code your authenticator app now shows for DropMarket.
            </GateHeader>

            <CodeInput
              ref={inputRef}
              value={code}
              onChange={(v) => {
                setCode(v)
                if (error) setError(null)
              }}
              onComplete={confirm}
              disabled={loading}
              autoFocus
              invalid={!!error}
              invalidKey={attempt}
            />

            <p role="alert" className={cn('mt-2.5 min-h-[18px] text-[12.5px] text-error', !error && 'invisible')}>
              {error ?? ' '}
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('scan')
                  setCode('')
                  setError(null)
                }}
                disabled={loading}
                className={cn(accountBtn.secondary, 'h-11 flex-1 text-[14px]')}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className={cn(accountBtn.primary, 'h-11 flex-[2] text-[14px]')}
              >
                {loading && <CircleNotch weight="bold" className="h-4 w-4 animate-spin" aria-hidden />}
                {loading ? 'Verifying…' : 'Turn On Two-Factor'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
