import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { ShieldCheck } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { Lightning } from '@phosphor-icons/react/dist/ssr/Lightning'
import { Headset } from '@phosphor-icons/react/dist/ssr/Headset'
import { TrustpilotGate, TrustpilotShowcase } from '@/components/trust/TrustpilotShowcase'

/** The checkout's trust blue (src/app/checkout/[id]/_surfaces.ts): security signals only. */
const TRUST_BLUE = '#6AA8FF'

const PROMISES: Array<{ Icon: PhosphorIcon; label: string; short: string }> = [
  { Icon: ShieldCheck, label: 'Money-Back Guarantee', short: 'Money-Back' },
  { Icon: Lightning, label: 'Quick Delivery', short: 'Quick Delivery' },
  { Icon: Headset, label: '24/7 Support', short: '24/7 Support' },
]

/**
 * The pet page's three promises, under the delivery instructions (owner,
 * 2026-10-28): the site's own wording (TrustBand), each icon in the
 * checkout's trust-blue tile, spread across the column. Trustpilot's real widget under them, only once
 * the profile has 10+ reviews. Server component, handed to the client page.
 */
export function TrustRow() {
  return (
    <div className="mt-6">
      <ul aria-label="Our Promises" className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-4">
        {PROMISES.map(({ Icon, label, short }) => (
          <li key={label} className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 sm:text-left">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[rgba(106,168,255,0.12)] sm:h-10 sm:w-10">
              <Icon size={20} weight="fill" color={TRUST_BLUE} />
            </span>
            <span className="text-[13px] font-semibold leading-tight text-text-primary sm:text-[length:var(--fs-card-title)]">
              {/* Short where the column is narrow: phones, and the left column on small laptops. */}
              <span className="sm:hidden lg:inline xl:hidden">{short}</span>
              <span className="hidden sm:inline lg:hidden xl:inline">{label}</span>
            </span>
          </li>
        ))}
      </ul>
      <TrustpilotGate>
        <div className="mt-5 flex justify-center">
          <TrustpilotShowcase />
        </div>
      </TrustpilotGate>
    </div>
  )
}
