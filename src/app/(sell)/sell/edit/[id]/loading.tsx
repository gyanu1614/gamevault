/**
 * /sell/edit/[id] route fallback: the wizard's Details step in plain blocks,
 * the same skeleton the wizard shows while it loads the listing.
 */
import { SellWizardSkeleton } from '../../../_components/SellWizardSkeleton'

export default function SellEditLoading() {
  return <SellWizardSkeleton variant="edit" />
}
