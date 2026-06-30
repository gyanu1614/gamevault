/**
 * V19/P11 — Redirect to the canonical edit route under (sell) group.
 *
 * The seller wizard now lives under /sell — both /sell/new (create)
 * and /sell/edit/[id] (edit) share the same no-sidebar layout. This
 * old URL stays as a permanent redirect so any bookmarked or
 * in-product links keep working.
 */

import { permanentRedirect } from 'next/navigation'

export default async function LegacyEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  permanentRedirect(`/sell/edit/${id}`)
}
