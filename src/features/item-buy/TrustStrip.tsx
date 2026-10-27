import { IconHeadset, IconShieldCheck, type Icon as TablerIcon } from '@tabler/icons-react'
import { TrustpilotGate, TrustpilotShowcase } from '@/components/trust/TrustpilotShowcase'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'

/**
 * The trust strip under the trait picker (owner, 2026-10-26, GameBoost as the
 * reference). The two promises are the site's own (TrustBand: Money-Back
 * Guarantee under SafeDrop Protection, 24/7 human support); the Trustpilot
 * row is Trustpilot's real widget and appears only once the profile has 10+
 * reviews — no score we did not earn. Server component (the review count is
 * a cookie-free cached read).
 */
export function TrustStrip() {
  return (
    <div className={cn('overflow-hidden rounded-lg', MARKET_CARD)}>
      <div className="grid grid-cols-2">
        <TrustCell icon={IconShieldCheck} label="Money-Back Guarantee" />
        <TrustCell icon={IconHeadset} label="24/7 Support" className="shadow-[inset_1px_0_0_rgba(255,255,255,0.05)]" />
      </div>
      <TrustpilotGate>
        <div className="flex min-h-[52px] items-center justify-center bg-white/[0.02] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <TrustpilotShowcase />
        </div>
      </TrustpilotGate>
    </div>
  )
}

function TrustCell({ icon: Icon, label, className }: { icon: TablerIcon; label: string; className?: string }) {
  return (
    <div className={cn('flex min-h-[56px] items-center gap-3 px-4 py-3 sm:px-5', className)}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-lime-tint-bg text-lime-text">
        <Icon aria-hidden size={17} stroke={1.9} />
      </span>
      <span className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-meta)' }}>
        {label}
      </span>
    </div>
  )
}
