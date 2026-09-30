'use client'

import { useState } from 'react'
import VisibilityRounded from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded'
import { toast } from 'sonner'
import { updatePassword } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/client'
import TwoFactorSection from '@/components/account/settings/TwoFactorSection'
import { SettingsCard, Field, accountInputCls } from '@/components/account/AccountSurface'
import { SaveButton } from '@/components/account/SaveButton'
import { cn } from '@/lib/utils'
import { useSavedFlash } from './_useFormState'

const MIN_PASSWORD = 6

export function SecurityTab({ email }: { email: string | null }) {
  return (
    <>
      <PasswordCard email={email} />
      <TwoFactorSection />
    </>
  )
}

function PasswordCard({ email }: { email: string | null }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, flashSaved] = useSavedFlash()

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD
  const mismatch = confirm.length > 0 && confirm !== next
  const ready = current && next.length >= MIN_PASSWORD && confirm === next

  const submit = async () => {
    if (!ready) return
    if (!email) {
      toast.error('Couldn’t verify your account', { description: 'Please sign in again.' })
      return
    }
    setSaving(true)
    try {
      // Supabase doesn't ask for the current password, so confirm it by
      // signing in with it before changing anything.
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: current })
      if (signInError) {
        toast.error('Your current password is incorrect.')
        return
      }
      const result = await updatePassword(next)
      if (result.error) {
        toast.error('Couldn’t update your password', { description: result.error })
        return
      }
      setCurrent('')
      setNext('')
      setConfirm('')
      flashSaved()
      toast.success('Password updated', { description: 'Use your new password next time you sign in.' })
    } catch (err) {
      toast.error('Couldn’t update your password', {
        description: err instanceof Error ? err.message : 'Try again in a moment.',
      })
    } finally {
      setSaving(false)
    }
  }

  const type = show ? 'text' : 'password'

  return (
    <SettingsCard
      title="Password"
      description="Change the password you use to sign in."
      footerHint={`Use at least ${MIN_PASSWORD} characters.`}
      footerAction={
        <SaveButton saving={saving} saved={saved} disabled={!ready} onClick={submit} label="Update Password" savingLabel="Updating…" />
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        {/* Lets password managers pair the new password with this account. */}
        <input type="email" name="username" autoComplete="username" value={email ?? ''} readOnly hidden />
        <Field label="Current Password" htmlFor="settings-current-password">
          <div className="relative">
            <input
              id="settings-current-password"
              type={type}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={cn(accountInputCls, 'pr-11')}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide passwords' : 'Show passwords'}
              aria-pressed={show}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition-colors hover:text-text-primary"
            >
              {show ? <VisibilityOffRounded style={{ fontSize: 18 }} /> : <VisibilityRounded style={{ fontSize: 18 }} />}
            </button>
          </div>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="New Password"
            htmlFor="settings-new-password"
            error={tooShort ? `Use at least ${MIN_PASSWORD} characters.` : null}
          >
            <input
              id="settings-new-password"
              type={type}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={accountInputCls}
            />
          </Field>
          <Field
            label="Confirm New Password"
            htmlFor="settings-confirm-password"
            error={mismatch ? 'Passwords don’t match.' : null}
          >
            <input
              id="settings-confirm-password"
              type={type}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={accountInputCls}
            />
          </Field>
        </div>
        {/* Enter submits the form; the visible button lives in the footer. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </SettingsCard>
  )
}
