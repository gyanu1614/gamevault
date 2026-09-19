/**
 * Shared plumbing for the three trend-radar routes. Called by the GitHub
 * Actions workflow (.github/workflows/trend-radar.yml) with the
 * `x-trend-radar-secret` header; never by a browser.
 *
 * Every route answers 200 with a JSON summary even when the run stopped
 * early (`ok:false`, `tripped`, `failure`) so the workflow log carries the
 * reason; only auth failures and unexpected exceptions are non-200.
 */
import { authorizeInternalRequest, internalJson } from '@/lib/security/internal-route-auth'

export const SECRET_HEADER = 'x-trend-radar-secret'

export async function guard(request: Request): Promise<Response | null> {
  const auth = await authorizeInternalRequest(request, { header: SECRET_HEADER, secret: process.env.TREND_RADAR_SECRET })
  return auth.ok ? null : auth.response
}

export function isDry(request: Request): boolean {
  const v = new URL(request.url).searchParams.get('dry')
  return v === '1' || v === 'true'
}

export { internalJson }
