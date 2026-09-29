/**
 * INFORM Disclosure moved into Settings (owner, 2026-09-28). The old URL stays
 * so notification and email links still land on it.
 */
import { redirect } from 'next/navigation'

export const metadata = { title: 'INFORM Act Disclosure' }

export default function InformDisclosurePage() {
  redirect('/account/settings?tab=inform')
}
