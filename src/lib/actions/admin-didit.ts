'use server'

/**
 * Admin-only Didit session lookup.
 *
 * The old admin UI deep-linked to business.didit.me/sessions/{id}, which
 * 404s (console sessions live under workspace-scoped URLs). Instead we pull
 * the session decision server-side through the verification API and render
 * it in an in-app modal.
 */

import { requireAdmin } from '@/lib/actions/admin-permissions'

const SESSION_ID_PATTERN = /^[0-9a-f-]{16,64}$/i

/**
 * Known plural result arrays on the decision payload → pretty feature name.
 * For each present, non-empty array we surface the LAST item's status
 * (Didit appends retries, so the last entry is the current outcome).
 */
const FEATURE_SOURCES: Array<{ key: string; name: string }> = [
  { key: 'id_verifications', name: 'ID Verification' },
  { key: 'liveness', name: 'Liveness' },
  { key: 'passive_liveness', name: 'Liveness' },
  { key: 'face_matches', name: 'Face Match' },
  { key: 'face_searches', name: 'Face Match' },
  { key: 'ip_analyses', name: 'IP Analysis' },
  { key: 'aml_screenings', name: 'AML Screening' },
  { key: 'poa_verifications', name: 'Proof Of Address' },
]

export interface DiditSessionFeature {
  name: string
  status: string
}

export type DiditSessionDetailsResult =
  | {
      success: true
      status: string
      sessionNumber?: number
      vendorData?: string
      features: DiditSessionFeature[]
    }
  | { success: false; error: string }

export async function getDiditSessionDetails(
  sessionId: string
): Promise<DiditSessionDetailsResult> {
  await requireAdmin()

  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return { success: false, error: 'Invalid Didit session ID.' }
  }

  const apiKey = process.env.DIDIT_API_KEY
  if (!apiKey) {
    return { success: false, error: 'Didit API key is not configured on the server.' }
  }

  try {
    const res = await fetch(
      `https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/decision/`,
      {
        headers: { 'x-api-key': apiKey },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      return {
        success: false,
        error:
          res.status === 404
            ? 'Session not found on Didit — it may belong to a different workspace.'
            : `Didit responded with HTTP ${res.status}.`,
      }
    }

    const decision = (await res.json()) as Record<string, unknown>

    const features: DiditSessionFeature[] = []
    for (const { key, name } of FEATURE_SOURCES) {
      const value = decision[key]
      if (Array.isArray(value) && value.length > 0) {
        const last = value[value.length - 1] as Record<string, unknown> | null
        const status = typeof last?.status === 'string' ? last.status : 'Unknown'
        features.push({ name, status })
      }
    }

    return {
      success: true,
      status: typeof decision.status === 'string' ? decision.status : 'Unknown',
      sessionNumber:
        typeof decision.session_number === 'number' ? decision.session_number : undefined,
      vendorData: typeof decision.vendor_data === 'string' ? decision.vendor_data : undefined,
      features,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not reach Didit.',
    }
  }
}
