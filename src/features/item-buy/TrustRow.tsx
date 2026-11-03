import { TrustpilotGate, TrustpilotShowcase } from '@/components/trust/TrustpilotShowcase'

/**
 * Trustpilot's real widget under the delivery instructions, only once the
 * profile has 10+ reviews. The three promises moved into the buy box, right
 * under Buy (BuyPromises, owner 2026-11-02). Server component, handed to the
 * client page.
 */
export function TrustRow() {
  return (
    <TrustpilotGate>
      <div className="mt-6 flex justify-center">
        <TrustpilotShowcase />
      </div>
    </TrustpilotGate>
  )
}
