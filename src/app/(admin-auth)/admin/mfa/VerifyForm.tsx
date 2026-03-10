'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { verifyMFAChallenge } from '@/lib/actions/admin-mfa'
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface VerifyFormProps {
  factorId: string
  factorName: string
}

export function VerifyForm({ factorId, factorName }: VerifyFormProps) {
  const router = useRouter()
  const [code,        setCode]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return

    setLoading(true)
    setError(null)

    const result = await verifyMFAChallenge(factorId, code.trim())

    if (result.success) {
      toast.success('MFA verified — access granted')
      router.push('/admin')
      router.refresh()
    } else {
      setError(result.error || 'Invalid code — please try again')
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Enter TOTP code</p>
          <p className="text-xs text-gray-500">From: {factorName}</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">
          6-digit code from your authenticator app
        </label>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={handleCodeChange}
          placeholder="123456"
          maxLength={6}
          className="w-full text-center text-3xl font-mono tracking-[0.5em] rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Verifying…
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4" />
            Verify & Enter Admin Panel
          </>
        )}
      </button>
    </form>
  )
}
