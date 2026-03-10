'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { enrollTOTP, verifyMFAChallenge } from '@/lib/actions/admin-mfa'
import { QrCode, Key, ShieldCheck, Loader2, AlertCircle, Check } from 'lucide-react'
import { toast } from 'sonner'

type Step = 'loading' | 'qr' | 'verify' | 'done'

export function EnrollForm() {
  const router = useRouter()
  const [step,      setStep]      = useState<Step>('loading')
  const [factorId,  setFactorId]  = useState<string>('')
  const [qrCode,    setQrCode]    = useState<string>('')
  const [secret,    setSecret]    = useState<string>('')
  const [code,      setCode]      = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-start enrollment on mount
  useEffect(() => {
    startEnrollment()
  }, [])

  const startEnrollment = async () => {
    setStep('loading')
    setError(null)
    const result = await enrollTOTP()

    if (!result.success || !result.factorId) {
      setError(result.error || 'Failed to start enrollment')
      setStep('qr')
      return
    }

    setFactorId(result.factorId)
    setQrCode(result.qrCode ?? '')
    setSecret(result.secret ?? '')
    setStep('qr')
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return

    setLoading(true)
    setError(null)

    const result = await verifyMFAChallenge(factorId, code.trim())

    if (result.success) {
      setStep('done')
      toast.success('TOTP enrolled successfully!')
      setTimeout(() => {
        router.push('/admin')
        router.refresh()
      }, 1500)
    } else {
      setError(result.error || 'Invalid code — check your authenticator app')
      setCode('')
      inputRef.current?.focus()
    }
    setLoading(false)
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(val)
    setError(null)
  }

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        <p className="text-sm text-gray-400">Generating QR code…</p>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <Check className="w-7 h-7 text-emerald-400" />
        </div>
        <p className="text-base font-semibold text-white">TOTP Enrolled!</p>
        <p className="text-sm text-gray-400">Redirecting to admin panel…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {step === 'qr' && (
        <>
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">1</span>
            Scan QR code
            <span className="flex-1 border-t border-white/10" />
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-[10px] text-gray-500">2</span>
            Verify
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-400">
                Scan this QR code with <strong className="text-white">Google Authenticator</strong>, <strong className="text-white">Authy</strong>, or any TOTP app.
              </p>

              {qrCode && (
                <div className="flex justify-center">
                  <div className="rounded-2xl bg-white p-3">
                    <img
                      src={qrCode}
                      alt="TOTP QR code"
                      className="w-48 h-48"
                    />
                  </div>
                </div>
              )}

              {/* Manual entry */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  {showSecret ? 'Hide' : 'Show'} manual entry secret
                </button>
                {showSecret && (
                  <p className="mt-2 rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-gray-300 tracking-wider break-all select-all">
                    {secret}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep('verify')}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
              >
                I've scanned the QR code →
              </button>
            </>
          )}
        </>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerify} className="space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-[10px] text-emerald-400">✓</span>
            QR scanned
            <span className="flex-1 border-t border-white/10" />
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">2</span>
            Verify
          </div>

          <p className="text-sm text-gray-400">
            Enter the 6-digit code from your authenticator app to complete enrollment.
          </p>

          <div>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={handleCodeChange}
              placeholder="123456"
              maxLength={6}
              autoFocus
              className="w-full text-center text-3xl font-mono tracking-[0.5em] rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep('qr'); setCode(''); setError(null) }}
              className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-400 hover:bg-white/5 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Confirm Enrollment</>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
