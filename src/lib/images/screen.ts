/**
 * Image screening at upload (2026-10-09): every listing image, avatar and
 * store logo goes through Sightengine's check before it is stored. A hit
 * is refused with a plain reason and never reaches the bucket.
 *
 * Off when SIGHTENGINE_API_USER / SIGHTENGINE_API_SECRET are unset (local
 * stacks, tests): `screenImage` returns { ok: true, skipped: true }. On a
 * network or API error it fails OPEN (upload allowed, error logged) so an
 * outage at the vendor never blocks sellers; the admin takedown tools are
 * the backstop.
 *
 * Models: nudity-2.1 (sexual content), gore-2.0, offensive-2.0 (hate
 * symbols), weapon. Thresholds are deliberately strict for nudity and gore
 * and looser for weapons (game items are often weapons).
 */

export type ScreenResult = { ok: true; skipped?: boolean } | { ok: false; reason: string; labels: string[] }

const MODELS = 'nudity-2.1,gore-2.0,offensive-2.0,weapon'

export async function screenImage(bytes: Uint8Array, mime: string, context: 'listing' | 'avatar' = 'listing'): Promise<ScreenResult> {
  const user = process.env.SIGHTENGINE_API_USER
  const secret = process.env.SIGHTENGINE_API_SECRET
  if (!user || !secret) return { ok: true, skipped: true }
  try {
    const form = new FormData()
    form.set('media', new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }), 'upload')
    form.set('models', MODELS)
    form.set('api_user', user)
    form.set('api_secret', secret)
    const res = await fetch('https://api.sightengine.com/1.0/check.json', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`sightengine ${res.status}`)
    const data: any = await res.json()
    if (data?.status !== 'success') throw new Error(`sightengine ${data?.error?.message ?? 'bad response'}`)
    return judge(data, context)
  } catch (err) {
    console.error('[screenImage] failed open:', err)
    return { ok: true, skipped: true }
  }
}

/** Exported for tests: turns a Sightengine payload into a verdict. */
export function judge(data: any, context: 'listing' | 'avatar'): ScreenResult {
  const labels: string[] = []
  const n = data?.nudity ?? {}
  const sexual = Math.max(n.sexual_activity ?? 0, n.sexual_display ?? 0, n.erotica ?? 0)
  const suggestive = Math.max(n.very_suggestive ?? 0, n.suggestive ?? 0)
  if (sexual >= 0.5) labels.push('nudity')
  else if (suggestive >= 0.85 && context === 'avatar') labels.push('suggestive')
  const gore = data?.gore?.prob ?? 0
  if (gore >= 0.6) labels.push('gore')
  const off = data?.offensive ?? {}
  const hate = Math.max(off.nazi ?? 0, off.confederate ?? 0, off.supremacist ?? 0, off.terrorist ?? 0)
  if (hate >= 0.6) labels.push('hate symbols')
  // Weapons: only block on avatars; game listings are full of them.
  const weapon = data?.weapon?.classes ? Math.max(...Object.values<number>(data.weapon.classes)) : data?.weapon ?? 0
  if (context === 'avatar' && typeof weapon === 'number' && weapon >= 0.9) labels.push('weapon')
  if (labels.length === 0) return { ok: true }
  return { ok: false, reason: `This image was blocked (${labels.join(', ')}). No nudity, gore or hate symbols on DropMarket.`, labels }
}
