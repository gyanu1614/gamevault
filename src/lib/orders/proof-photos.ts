/**
 * The seller's delivery photos on an order (orders.delivery_evidence_urls) as
 * paths in the private `delivery-evidence` bucket. Entries are storage paths
 * (`<orderId>/<time>-<name>`); older rows may hold a full Supabase storage
 * URL. Images only (videos cannot go to a card dispute), each path once.
 */

const IMAGE = /\.(webp|jpe?g|png|gif|avif)$/i
const IN_BUCKET = /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/(?:public|sign|authenticated)\/delivery-evidence\/([^?#]+)/

function toPath(entry: unknown): string | null {
  if (typeof entry !== 'string') return null
  const raw = entry.trim()
  if (!raw) return null
  let path = raw
  if (raw.includes('://')) {
    const m = IN_BUCKET.exec(raw)
    if (!m) return null
    try {
      path = decodeURIComponent(m[1])
    } catch {
      return null
    }
  }
  if (path.startsWith('/') || path.split('/').some((seg) => seg === '..' || seg === '')) return null
  return IMAGE.test(path) ? path : null
}

export function proofPhotoPaths(entries: unknown): string[] {
  if (!Array.isArray(entries)) return []
  return [...new Set(entries.map(toPath).filter((p): p is string => p !== null))]
}
