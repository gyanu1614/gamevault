'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { SubCard } from '@/app/(sell)/_components/sell-wizard/ui/SubCard'

// ─── TermsCard — final sub-card on Step 3; gates the Create Offer button ────

/**
 * Two checkboxes the seller must tick to enable Create Offer:
 *   - Seller Rules (community standards / what can be listed)
 *   - Terms of Service (platform-wide ToS)
 *
 * Uses the existing shadcn Checkbox (themed to lime in R8). The Create Offer
 * button is gated on (canPublish && agreeSellerRules && agreeTos) — the
 * parent SellWizard reads these two booleans into its canPublish check.
 */
export function TermsCard({
  agreeSellerRules, setAgreeSellerRules, agreeTos, setAgreeTos,
}: {
  agreeSellerRules: boolean; setAgreeSellerRules: (v: boolean) => void
  agreeTos: boolean; setAgreeTos: (v: boolean) => void
}) {
  return (
    <SubCard title="Confirm">
      <ul className="space-y-3">
        <li>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={agreeSellerRules}
              onCheckedChange={(v) => setAgreeSellerRules(v === true)}
              className="mt-0.5"
              aria-label="I agree to the Seller Rules"
            />
            <span className="text-sm text-text-primary">
              I agree to the{' '}
              <a
                href="/seller-rules"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-text underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Seller Rules
              </a>
              .
            </span>
          </label>
        </li>
        <li>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={agreeTos}
              onCheckedChange={(v) => setAgreeTos(v === true)}
              className="mt-0.5"
              aria-label="I agree to the Terms of Service"
            />
            <span className="text-sm text-text-primary">
              I agree to the{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-text underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </a>
              .
            </span>
          </label>
        </li>
      </ul>
    </SubCard>
  )
}
