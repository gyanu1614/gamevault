'use client'

/**
 * Two-factor authentication (TOTP) for the Security tab.
 *
 * The tab was already labelled "Password & 2FA" but only ever offered a
 * password change. Supabase MFA was in the codebase, wired for the admin
 * console only — this surfaces the same mechanism for every account.
 */

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Check, Copy, Loader2, Smartphone } from 'lucide-react'
import {
  confirmMfaEnrollment,
  disableMfa,
  getMfaStatus,
  startMfaEnrollment,
  type AccountMfaFactor,
} from '@/lib/actions/mfa'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { SettingsCard, accountBtn, accountInputCls } from '@/components/account/AccountSurface'

const codeInputCls = cn(
  accountInputCls,
  'text-center font-mono text-lg font-semibold tracking-[0.4em] placeholder:font-sans placeholder:tracking-normal sm:text-lg',
)

export default function TwoFactorSection() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [factor, setFactor] = useState<AccountMfaFactor | null>(null)

  // Enrolment dialog
  const [setupOpen, setSetupOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)

  // Disable dialog
  const [disableOpen, setDisableOpen] = useState(false)
  const [disableCode, setDisableCode] = useState('')
  const [disabling, setDisabling] = useState(false)

  const refresh = useCallback(async () => {
    const result = await getMfaStatus()
    if (result.success && result.status) {
      setEnabled(result.status.enabled)
      setFactor(result.status.factors[0] ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const openSetup = async () => {
    setStarting(true)
    setCode('')
    setSecretCopied(false)
    const result = await startMfaEnrollment()
    setStarting(false)

    if (!result.success) {
      toast.error(result.error || 'Could not start two-factor setup.')
      return
    }
    setQrCode(result.qrCode ?? null)
    setSecret(result.secret ?? null)
    setFactorId(result.factorId ?? null)
    setSetupOpen(true)
  }

  const confirm = async () => {
    if (!factorId) return
    setSubmitting(true)
    const result = await confirmMfaEnrollment(factorId, code)
    setSubmitting(false)

    if (!result.success) {
      toast.error(result.error || 'That code didn’t match.')
      return
    }
    setSetupOpen(false)
    toast.success('Two-factor authentication is on', {
      description: 'You’ll be asked for a code the next time you sign in.',
    })
    void refresh()
  }

  const confirmDisable = async () => {
    if (!factor) return
    setDisabling(true)
    const result = await disableMfa(factor.id, disableCode)
    setDisabling(false)

    if (!result.success) {
      toast.error(result.error || 'Could not turn off two-factor.')
      return
    }
    setDisableOpen(false)
    setDisableCode('')
    toast.success('Two-factor authentication is off')
    void refresh()
  }

  const copySecret = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setSecretCopied(true)
      setTimeout(() => setSecretCopied(false), 2000)
    } catch {
      toast.error('Couldn’t copy — select the code and copy it manually.')
    }
  }

  return (
    <SettingsCard
      title="Two-Factor Authentication"
      description="Ask for a 6-digit code from an authenticator app when you sign in, on top of your password."
      aside={
        loading ? (
          <span className="skeleton block h-6 w-12 rounded-full" aria-hidden />
        ) : (
          <span
            className={cn(
              'inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold',
              enabled ? 'bg-success-bg text-success' : 'bg-white/[0.06] text-text-secondary',
            )}
          >
            {enabled ? 'On' : 'Off'}
          </span>
        )
      }
      footerHint={enabled ? 'Authenticator app connected.' : 'Works with Google Authenticator, 1Password, Authy and other TOTP apps.'}
      footerAction={
        loading ? null : enabled ? (
          <button type="button" onClick={() => setDisableOpen(true)} className={accountBtn.secondary}>
            Turn Off
          </button>
        ) : (
          <button type="button" onClick={openSetup} disabled={starting} className={accountBtn.primary}>
            {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Smartphone className="h-3.5 w-3.5" aria-hidden />}
            Turn On
          </button>
        )
      }
    >
      {/* ── Enrolment ── */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-[420px] p-5 sm:p-6">
          <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Scan this with Google Authenticator, 1Password, Authy or any TOTP app, then enter
            the 6-digit code it shows.
          </DialogDescription>

          <div className="mt-4 space-y-4">
            {qrCode && (
              <div className="flex justify-center">
                {/* Supabase returns the QR as an SVG data URI. */}
                <div className="rounded-lg bg-white p-3">
                  <Image
                    src={qrCode}
                    alt="Two-factor QR code"
                    width={168}
                    height={168}
                    unoptimized
                  />
                </div>
              </div>
            )}

            {secret && (
              <div>
                <p className="mb-1.5 text-xs text-text-tertiary">Can’t scan? Enter this key instead:</p>
                <button
                  onClick={copySecret}
                  className="flex w-full items-center justify-between gap-3 rounded-md bg-bg-overlay px-3.5 py-2.5 text-left transition-colors hover:bg-bg-overlay-2"
                >
                  <code className="min-w-0 break-all font-mono text-xs text-text-secondary">{secret}</code>
                  {secretCopied
                    ? <Check className="h-4 w-4 shrink-0 text-lime-text" />
                    : <Copy className="h-4 w-4 shrink-0 text-text-tertiary" />}
                </button>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Verification Code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                aria-label="Verification code"
                placeholder="000000"
                className={codeInputCls}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSetupOpen(false)} className={accountBtn.secondary}>
                Cancel
              </button>
              <button type="button" onClick={confirm} disabled={submitting || code.length !== 6} className={accountBtn.primary}>
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Verify & Enable
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Disable ── */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="max-w-[420px] p-5 sm:p-6">
          <DialogTitle>Turn Off Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Your account will be protected by your password alone. Enter a current code to
            confirm it’s you.
          </DialogDescription>

          <div className="mt-4 space-y-4">
            <input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              spellCheck={false}
              aria-label="Verification code"
              placeholder="000000"
              className={codeInputCls}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDisableOpen(false)} className={accountBtn.secondary}>
                Keep It On
              </button>
              <button type="button" onClick={confirmDisable} disabled={disabling || disableCode.length !== 6} className={accountBtn.danger}>
                {disabling && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Turn Off
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  )
}
