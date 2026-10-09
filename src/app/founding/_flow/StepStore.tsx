'use client'

/**
 * Step 3 — store name (live uniqueness check) + logo (crop + upload).
 */
import { useEffect, useRef, useState } from 'react'
import { Check } from '@phosphor-icons/react/dist/ssr/Check'
import { CircleNotch } from '@phosphor-icons/react/dist/ssr/CircleNotch'
import { storeNameSchema } from '@/lib/founding/onboarding'
import { checkStoreNameAvailable, saveFoundingStore } from '@/lib/actions/founding-onboarding'
import { LogoPicker } from './LogoPicker'
import { Field, FormError, INPUT_CLS, PrimaryButton, StepActions, StepCard } from './ui'

type Check = { state: 'idle' } | { state: 'checking' } | { state: 'ok' } | { state: 'bad'; message: string }

export function StepStore({
  initialName,
  initialLogoUrl,
  onBack,
  onSaved,
}: {
  initialName: string | null
  initialLogoUrl: string | null
  onBack: () => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(initialName ?? '')
  const [logo, setLogo] = useState<string | null>(null)
  const [check, setCheck] = useState<Check>({ state: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  // Debounced availability check; the server validates again on save.
  useEffect(() => {
    const trimmed = name.trim()
    if (trimmed.length < 3) { setCheck({ state: 'idle' }); return }
    const local = storeNameSchema.safeParse(trimmed)
    if (!local.success) { setCheck({ state: 'bad', message: local.error.issues[0]?.message ?? 'Try another name.' }); return }
    if (trimmed === (initialName ?? '')) { setCheck({ state: 'ok' }); return }
    const mine = ++seq.current
    setCheck({ state: 'checking' })
    const t = setTimeout(async () => {
      const res = await checkStoreNameAvailable(trimmed)
      if (mine !== seq.current) return
      setCheck(res.available ? { state: 'ok' } : { state: 'bad', message: res.error ?? 'That store name is taken.' })
    }, 350)
    return () => clearTimeout(t)
  }, [name, initialName])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (check.state === 'bad') return setError(check.message)
    if (check.state !== 'ok') return setError('Pick a store name first.')
    setBusy(true)
    try {
      const res = await saveFoundingStore({ storeName: name.trim(), logoDataUrl: logo })
      if (!res.success) return setError(res.error ?? 'Could not save. Try again.')
      await onSaved()
    } finally {
      setBusy(false)
    }
  }

  const status =
    check.state === 'checking' ? (
      <span className="inline-flex items-center gap-1.5 text-text-tertiary"><CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking…</span>
    ) : check.state === 'ok' ? (
      <span className="inline-flex items-center gap-1.5 text-success"><Check weight="bold" className="h-3.5 w-3.5" aria-hidden /> Available</span>
    ) : 'This is the name buyers see on every listing. 3–50 characters.'

  return (
    <StepCard title="Set Up Your Store" lead="Pick a name buyers will remember, and a logo so your listings stand out.">
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <Field label="Store Name" htmlFor="f-store" hint={status} error={check.state === 'bad' ? check.message : null}>
          <input
            id="f-store"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT_CLS}
            placeholder="e.g. Pixel Pets Trading"
            maxLength={50}
            autoComplete="organization"
            aria-invalid={check.state === 'bad' || undefined}
          />
        </Field>

        <Field label="Store Logo" optional hint={undefined}>
          <LogoPicker value={logo} initialUrl={initialLogoUrl} storeName={name} onChange={setLogo} disabled={busy} />
        </Field>

        <FormError message={error} />
        <StepActions onBack={onBack}>
          <PrimaryButton busy={busy} disabled={check.state !== 'ok'}>Continue</PrimaryButton>
        </StepActions>
      </form>
    </StepCard>
  )
}
