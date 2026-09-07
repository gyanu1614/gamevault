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
import { Check, Copy, Loader2, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react'
import {
  confirmMfaEnrollment,
  disableMfa,
  getMfaStatus,
  startMfaEnrollment,
  type AccountMfaFactor,
} from '@/lib/actions/mfa'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const codeInputCls =
  'w-full rounded-lg border border-border-subtle bg-bg-raised px-4 py-2.5 text-center text-lg font-semibold tracking-[0.4em] text-text-primary placeholder:tracking-normal placeholder:text-text-disabled focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg'

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
    <div>
      <h2 className="mb-4 text-sm font-semibold text-text-primary">Two-Factor Authentication</h2>

      <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-raised/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
              enabled
                ? 'border-lime-tint-border bg-lime/15 text-lime-text'
                : 'border-border-subtle bg-bg-overlay text-text-tertiary',
            )}
          >
            {enabled ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary">
              {loading ? 'Checking…' : enabled ? 'On — Authenticator App' : 'Off'}
            </div>
            <p className="mt-0.5 text-xs text-text-tertiary">
              {enabled
                ? 'A 6-digit code from your authenticator app is required at sign-in.'
                : 'Add a code from an authenticator app on top of your password.'}
            </p>
          </div>
        </div>

        {!loading && (
          enabled ? (
            <button
              onClick={() => setDisableOpen(true)}
              className="shrink-0 rounded-lg border border-border-subtle bg-bg-overlay px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover"
            >
              Turn Off
            </button>
          ) : (
            <button
              onClick={openSetup}
              disabled={starting}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-lime px-4 py-2.5 text-sm font-semibold text-text-inverse transition-all hover:bg-lime-hover active:scale-95 disabled:opacity-50"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Turn On
            </button>
          )
        )}
      </div>

      {/* ── Enrolment ── */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-md">
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
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-raised px-3 py-2.5 text-left transition-colors hover:bg-bg-raised-hover"
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
                placeholder="000000"
                className={codeInputCls}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSetupOpen(false)}
                className="flex-1 rounded-lg border border-border-subtle bg-bg-raised px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={submitting || code.length !== 6}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-lime px-4 py-2.5 text-sm font-semibold text-text-inverse transition-all hover:bg-lime-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify & Enable
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Disable ── */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="max-w-md">
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
              placeholder="000000"
              className={codeInputCls}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setDisableOpen(false)}
                className="flex-1 rounded-lg border border-border-subtle bg-bg-raised px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover"
              >
                Keep It On
              </button>
              <button
                onClick={confirmDisable}
                disabled={disabling || disableCode.length !== 6}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-error/40 bg-error-bg px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error-bg/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {disabling && <Loader2 className="h-4 w-4 animate-spin" />}
                Turn Off
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
