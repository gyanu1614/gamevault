/**
 * /admin/games-v2/[id]/templates/[categorySlug]
 *
 * Server entry for the attribute template builder. Loads the full builder
 * state (game + category + template + attributes + options + rules) and
 * renders the client builder.
 */

import { notFound } from 'next/navigation'
import { loadBuilderState } from '@/lib/actions/admin-template-builder'
import TemplateBuilder from '../../../_components/TemplateBuilder'

export const dynamic = 'force-dynamic'

export default async function TemplateBuilderPage({
  params,
}: {
  params: { id: string; categorySlug: string }
}) {
  const res = await loadBuilderState(params.id, params.categorySlug)
  if (!res.success) {
    notFound()
  }
  return <TemplateBuilder initial={res.data} />
}
