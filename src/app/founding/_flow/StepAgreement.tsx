'use client'

/**
 * Step 4 — the Seller Agency Agreement: the text (from documents.ts, the
 * same source as /seller-agreement), the typed legal name, a drawn
 * signature and an explicit accept. Finish calls the one RPC that makes the
 * account a seller.
 */
import { useState } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react/dist/ssr/ArrowSquareOut'
import { Checkbox } from '@/components/ui/checkbox'
import { LegalBlockView } from '@/components/legal/LegalBlocks'
import type { LegalDoc } from '@/lib/legal/documents'
import { typedNameSchema } from '@/lib/founding/onboarding'
import { signFoundingAgreement } from '@/lib/actions/founding-onboarding'
import { SignaturePad } from './SignaturePad'
import { Field, FormError, INPUT_CLS, PrimaryButton, StepActions, StepCard } from './ui'

export function StepAgreement({
  doc,
  version,
  defaultName,
  onBack,
  onFinished,
}: {
  doc: Pick<LegalDoc, 'title' | 'sections'>
  version: string
  defaultName: string | null
  onBack: () => void
  onFinished: (shopSlug: string | null) => Promise<void>
}) {
  const [typedName, setTypedName] = useState(defaultName ?? '')
  const [signature, setSignature] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const name = typedNameSchema.safeParse(typedName)
    if (!name.success) return setError(name.error.issues[0]?.message ?? 'Enter your full name.')
    if (!signature) return setError('Draw your signature in the box.')
    if (!agreed) return setError('Tick the box to accept the agreement.')
    setBusy(true)
    try {
      const res = await signFoundingAgreement({ typedName: name.data, signatureDataUrl: signature, agreed })
      if (!res.success) return setError(res.error ?? 'Could not finish. Try again.')
      await onFinished(res.shopSlug ?? null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepCard
      title="Seller Agreement"
      lead="You appoint DropMarket to sell on your behalf and collect payment for you. Read it, sign it, and you're live."
    >
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-body-sm font-medium text-text-primary">{doc.title} <span className="text-text-tertiary">· {version}</span></p>
            <a href="/seller-agreement" target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-caption font-normal text-text-secondary underline-offset-2 hover:text-text-primary hover:underline">
              Open In A New Tab <ArrowSquareOut weight="bold" className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
          <div
            tabIndex={0}
            className="mt-2 max-h-[300px] overflow-y-auto rounded-md bg-bg-well px-4 py-4 text-body-sm [&_p]:text-body-sm [&_p]:leading-[1.65] [&_li]:text-body-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-soft"
            aria-label="Agreement text"
          >
            {doc.sections.map((s, i) => (
              <section key={i} className={i > 0 ? 'mt-5' : ''}>
                {s.h && <h3 className="mb-2 text-body-sm font-semibold text-text-primary">{s.h}</h3>}
                <div className="flex flex-col gap-2.5">
                  {s.blocks.map((b, j) => <LegalBlockView key={j} block={b} />)}
                </div>
              </section>
            ))}
          </div>
        </div>

        <Field label="Your Full Legal Name" htmlFor="f-name" hint="As it appears on your ID. Used on the agreement.">
          <input id="f-name" value={typedName} onChange={(e) => setTypedName(e.target.value)} className={INPUT_CLS} autoComplete="name" placeholder="First Last" />
        </Field>

        <Field label="Your Signature" hint="Draw with your finger or mouse.">
          <SignaturePad onChange={setSignature} disabled={busy} />
        </Field>

        <label htmlFor="f-agree" className="flex cursor-pointer items-start gap-3 py-1">
          <Checkbox id="f-agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
          <span className="text-body-sm text-text-secondary">
            <span className="font-medium text-text-primary">I&apos;ve read and agree to the Seller Agency Agreement ({version}).</span>{' '}
            My signature, the time and my IP address are recorded with this agreement.
          </span>
        </label>

        <FormError message={error} />
        <StepActions onBack={onBack}>
          <PrimaryButton busy={busy} disabled={!signature || !agreed}>Sign And Start Selling</PrimaryButton>
        </StepActions>
      </form>
    </StepCard>
  )
}
