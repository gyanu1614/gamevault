import { redirect } from 'next/navigation'

/**
 * /admin/settings used to hold the Profile tab plus an empty "Admin Settings"
 * placeholder. The admin's account lives on /admin/profile; keep old links
 * and bookmarks working.
 */
export default function AdminSettingsRedirect() {
  redirect('/admin/profile')
}
