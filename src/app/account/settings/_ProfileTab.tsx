'use client'

import { useState } from 'react'
import Link from '@/components/navigation/AppLink'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded'
import MailOutlineRounded from '@mui/icons-material/MailOutlineRounded'
import ScheduleRounded from '@mui/icons-material/ScheduleRounded'
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import { toast } from 'sonner'
import { uploadProfileAvatar, changeEmail } from '@/lib/actions/auth'
import { downscaleImageToDataUrl, ImageDecodeError } from '@/lib/utils/image-downscale'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { AccountCard, SettingsCard, Field, accountInputCls, accountBtn } from '@/components/account/AccountSurface'
import { SaveButton } from '@/components/account/SaveButton'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useFormState, useSavedFlash } from './_useFormState'
import { usernameError } from './_settings-model'

const BIO_MAX = 500
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

interface ProfileTabProps {
  email: string
  pendingEmail: string | null
  onEmailChangeStarted: (email: string) => void
  isSeller: boolean
  /** Shop name for sellers, else the username. */
  displayName: string
  shopSlug: string | null
  memberSince: string | null
  avatarUrl: string
  onAvatarChanged: (url: string) => void
  profile: { username: string; full_name: string; bio: string }
  saveProfile: (updates: { username: string; full_name: string; bio: string }) => Promise<void>
}

export function ProfileTab(props: ProfileTabProps) {
  return (
    <>
      <IdentityCard {...props} />
      <PublicProfileCard profile={props.profile} saveProfile={props.saveProfile} />
      <EmailCard
        email={props.email}
        pendingEmail={props.pendingEmail}
        onEmailChangeStarted={props.onEmailChangeStarted}
      />
    </>
  )
}

// ── Identity: avatar, name, verified mark ───────────────────────────────────

function IdentityCard({
  isSeller,
  displayName,
  shopSlug,
  memberSince,
  avatarUrl,
  onAvatarChanged,
  profile,
}: ProfileTabProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // picking the same file again should still fire
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('That file isn’t an image.')
    if (file.size > AVATAR_MAX_BYTES) return setError('Images must be 5 MB or smaller.')

    setUploading(true)
    setError(null)
    try {
      // Downscale before encoding: a raw base64 file blew the Server Action
      // 1 MB body cap for anything over ~750 KB. 512px is 6x the largest tile.
      const dataUrl = await downscaleImageToDataUrl(file, { maxDimension: 512 })
      const result = await uploadProfileAvatar(dataUrl)
      if (result.error) return setError(result.error)
      if (result.avatarUrl) {
        onAvatarChanged(result.avatarUrl)
        toast.success('Photo updated')
      }
    } catch (err) {
      setError(err instanceof ImageDecodeError ? err.message : 'Couldn’t upload that image. Try a different file.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <AccountCard className="p-5 sm:p-6">
      <div className="flex items-center gap-4 sm:gap-5">
        <label
          className={cn(
            'group relative block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full ring-1 ring-white/10',
            uploading ? 'cursor-wait' : 'cursor-pointer',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- user avatar, any host */}
          <img src={avatarUrl} alt="" width={72} height={72} className="h-full w-full object-cover" />
          <span
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/55 text-[11px] font-semibold text-white transition-opacity duration-150',
              uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
            )}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <>
                <PhotoCameraRounded style={{ fontSize: 18 }} aria-hidden />
                Change
              </>
            )}
          </span>
          <span className="sr-only">Change profile photo</span>
          <input type="file" accept="image/*" onChange={onFile} disabled={uploading} className="sr-only" />
        </label>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-[17px] font-semibold leading-tight text-text-primary">{displayName}</p>
            {isSeller && <VerifiedBadge size={17} />}
          </div>
          <p className="mt-1 truncate text-[13px] text-text-secondary">
            @{profile.username || 'username'}
            {memberSince && <span className="text-text-tertiary">{`  ·  Member since ${memberSince}`}</span>}
          </p>
          <p className={cn('mt-2 text-[12px]', error ? 'text-error' : 'text-text-tertiary')} role={error ? 'alert' : undefined}>
            {error ?? 'JPG, PNG or GIF, up to 5 MB. Click the photo to change it.'}
          </p>
        </div>

        {isSeller && shopSlug && (
          <Link href={`/shop/${shopSlug}`} className={cn(accountBtn.secondary, 'hidden sm:inline-flex')}>
            View Shop
            <ArrowOutwardRounded style={{ fontSize: 16 }} aria-hidden />
          </Link>
        )}
      </div>
    </AccountCard>
  )
}

// ── Public profile: username, full name, bio ────────────────────────────────

function PublicProfileCard({
  profile,
  saveProfile,
}: Pick<ProfileTabProps, 'profile' | 'saveProfile'>) {
  const form = useFormState(profile)
  const [saving, setSaving] = useState(false)
  const [saved, flashSaved] = useSavedFlash()
  const nameError = usernameError(form.values.username)
  // Only nag once they've changed it, not on a pristine form.
  const showNameError = form.values.username !== form.saved.username ? nameError : null

  const onSave = async () => {
    if (nameError) return
    setSaving(true)
    try {
      await saveProfile({
        username: form.values.username.trim(),
        full_name: form.values.full_name.trim(),
        bio: form.values.bio,
      })
      form.commit()
      flashSaved()
    } catch (err) {
      // saveProfile throws readable messages (taken username, …).
      toast.error(err instanceof Error && err.message ? err.message : 'Couldn’t save your profile. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsCard
      title="Public Profile"
      description="How other people see you on DropMarket."
      footerHint={
        <AnimatePresence initial={false}>
          {form.dirty && (
            <motion.span
              key="dirty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-text-secondary"
            >
              You have unsaved changes.
            </motion.span>
          )}
        </AnimatePresence>
      }
      footerAction={
        <>
          {form.dirty && !saving && (
            <button type="button" onClick={form.discard} className={accountBtn.secondary}>
              Discard
            </button>
          )}
          <SaveButton
            saving={saving}
            saved={saved}
            disabled={!form.dirty || !!nameError}
            onClick={onSave}
            label="Save Profile"
          />
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Username"
            htmlFor="settings-username"
            required
            error={showNameError}
            hint="3 to 30 characters: letters, numbers, hyphens and underscores."
          >
            <input
              id="settings-username"
              name="username"
              type="text"
              autoComplete="username"
              spellCheck={false}
              value={form.values.username}
              onChange={(e) => form.set('username', e.target.value)}
              className={accountInputCls}
            />
          </Field>
          <Field label="Full Name" htmlFor="settings-full-name">
            <input
              id="settings-full-name"
              name="full_name"
              type="text"
              autoComplete="name"
              value={form.values.full_name}
              onChange={(e) => form.set('full_name', e.target.value)}
              placeholder="Optional"
              className={accountInputCls}
            />
          </Field>
        </div>
        <Field label="Bio" htmlFor="settings-bio" trailing={`${form.values.bio.length}/${BIO_MAX}`}>
          <textarea
            id="settings-bio"
            name="bio"
            rows={4}
            maxLength={BIO_MAX}
            value={form.values.bio}
            onChange={(e) => form.set('bio', e.target.value)}
            placeholder="Tell buyers a little about yourself…"
            className={cn(accountInputCls, 'resize-none leading-relaxed')}
          />
        </Field>
      </div>
    </SettingsCard>
  )
}

// ── Email: read-only address + change flow ──────────────────────────────────

function EmailCard({
  email,
  pendingEmail,
  onEmailChangeStarted,
}: Pick<ProfileTabProps, 'email' | 'pendingEmail' | 'onEmailChangeStarted'>) {
  const [open, setOpen] = useState(false)
  const pending = pendingEmail && pendingEmail !== email ? pendingEmail : null

  return (
    <SettingsCard
      title="Email Address"
      description="Used to sign in and for your order updates."
      footerHint="Changing it needs a confirmation from your current and your new inbox."
      footerAction={
        <button type="button" onClick={() => setOpen(true)} className={accountBtn.secondary}>
          Change Email
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex min-h-[44px] items-center gap-3 rounded-md bg-bg-overlay px-3.5 py-2.5">
          <MailOutlineRounded style={{ fontSize: 18 }} className="shrink-0 text-text-tertiary" aria-hidden />
          <span className="min-w-0 truncate text-sm text-text-primary">{email}</span>
        </div>
        {pending && (
          <div className="flex items-start gap-2.5 rounded-md bg-warning-bg px-3.5 py-2.5 text-[13px] text-warning">
            <ScheduleRounded style={{ fontSize: 17 }} className="mt-px shrink-0" aria-hidden />
            <span className="min-w-0">
              Waiting for confirmation of <span className="break-all font-semibold">{pending}</span>. Open the link
              we sent to both inboxes.
            </span>
          </div>
        )}
      </div>

      <ChangeEmailDialog open={open} onOpenChange={setOpen} onStarted={onEmailChangeStarted} />
    </SettingsCard>
  )
}

function ChangeEmailDialog({
  open,
  onOpenChange,
  onStarted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStarted: (email: string) => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setValue('')
      setError(null)
      setSentTo(null)
    }
    onOpenChange(next)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const next = value.trim().toLowerCase()
    if (!next) return
    setError(null)
    setSending(true)
    try {
      const result = await changeEmail(next)
      if (result.error) return setError(result.error)
      setSentTo(next)
      onStarted(next)
    } catch {
      setError('Couldn’t start the email change. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[420px] gap-0 p-5 sm:p-6">
        {sentTo ? (
          <div>
            <CheckCircleRounded style={{ fontSize: 28 }} className="text-success" aria-hidden />
            <DialogTitle className="mt-3 text-base font-semibold text-text-primary">Check Both Inboxes</DialogTitle>
            <DialogDescription className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
              We sent a confirmation link to your current email and to{' '}
              <span className="break-all font-medium text-text-primary">{sentTo}</span>. The change applies once both
              are confirmed.
            </DialogDescription>
            <button type="button" onClick={() => handleOpenChange(false)} className={cn(accountBtn.primary, 'mt-5 w-full')}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <DialogTitle className="pr-8 text-base font-semibold text-text-primary">Change Email</DialogTitle>
            <DialogDescription className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
              We&apos;ll send a confirmation link to your current and your new address.
            </DialogDescription>
            <Field label="New Email" htmlFor="settings-new-email" error={error} className="mt-4">
              <input
                id="settings-new-email"
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="you@example.com"
                className={accountInputCls}
              />
            </Field>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => handleOpenChange(false)} className={accountBtn.secondary}>
                Cancel
              </button>
              <button type="submit" disabled={sending || !value.trim()} className={accountBtn.primary}>
                {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {sending ? 'Sending…' : 'Send Link'}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
