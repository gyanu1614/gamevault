/**
 * Step 4 — one import batch: the preview an admin reads before applying, and the
 * controls for the listings it created.
 */
import { notFound } from 'next/navigation'
import { fetchImportBatch } from '@/lib/actions/admin-imports'
import BatchDetailClient from '../_components/BatchDetailClient'

export const metadata = { title: 'Import Batch' }

export default async function AdminImportBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  const res = await fetchImportBatch(batchId)
  if (!res.success) notFound()
  return <BatchDetailClient batch={res.data} />
}
