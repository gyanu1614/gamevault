/**
 * Privacy & Data moved into Settings (owner, 2026-09-28). The old URL stays
 * so links in emails and bookmarks still land on it.
 */
import { redirect } from 'next/navigation'

export const metadata = { title: 'Privacy & Data' }

export default function PrivacyPage() {
  redirect('/account/settings?tab=privacy')
}
