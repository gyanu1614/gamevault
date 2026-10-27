import { TrustpilotGate, TrustpilotShowcase } from '@/components/trust/TrustpilotShowcase'

/**
 * The picture stage's Trustpilot row, under the trust strip: Trustpilot's
 * real widget, shown only once the profile has 10+ reviews — no score we did
 * not earn. Server component (the review count is a cookie-free cached read),
 * handed to the client stage as a node.
 */
export function TrustpilotRow() {
  return (
    <TrustpilotGate>
      <div className="flex min-h-[52px] items-center justify-center bg-[#1A1B20] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <TrustpilotShowcase />
      </div>
    </TrustpilotGate>
  )
}
