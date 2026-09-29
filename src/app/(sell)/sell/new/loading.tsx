/**
 * /sell/new route fallback: the wizard's Step 1 in plain blocks
 * (SellWizardSkeleton mirrors the real page, so nothing jumps on swap).
 */
import { SellWizardSkeleton } from '../../_components/SellWizardSkeleton'

export default function SellNewLoading() {
  return <SellWizardSkeleton variant="new" />
}
