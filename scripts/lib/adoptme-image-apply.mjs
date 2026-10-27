/**
 * The write half of scripts/adopt-me-image-upgrade.mjs: what --apply may do,
 * and the one place that uploads and repoints adopt_me_pets.image_url.
 * Pure checks first (planApply), so every refusal is unit-tested without
 * running --apply. Plain JS: loaded by the script (tsx) and by vitest.
 */
import { createHash } from 'node:crypto'
import { hdImagePath, isWikiSource } from './adoptme-image-upgrade.mjs'

export const REPORT_TOOL = 'adopt-me-image-upgrade'
export const REPORT_VERSION = 2
/** A dry run older than this is stale: run it again before going live. */
export const MAX_REPORT_AGE_DAYS = 7

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/**
 * Checks the --apply arguments and the dry-run report; returns the rows to
 * write, or throws with the reason.
 *  - --env=local (this worktree's stack) or --env=prod with --yes;
 *  - --report <report.json> written by this script's dry run, under 7 days old;
 *  - every file to upload is byte-for-byte the one the report lists (sha256);
 *  - rows not sourced from the Adopt Me Wiki (adoptmevalues' CDN pictures)
 *    are skipped unless --include-third-party: their owner's terms forbid
 *    scraping, and the wiki credit line must never land on them.
 * @param {{ env?: string, yes?: boolean, reportPath?: string, includeThirdParty?: boolean }} args
 * @param {any} report parsed report.json
 * @param {(file: string) => Buffer | null} fileBytes reads a file listed in the report (null when missing)
 */
export function planApply(args, report, fileBytes, now = Date.now()) {
  if (args.env !== 'local' && args.env !== 'prod') throw new Error('--apply needs --env=local or --env=prod')
  if (args.env === 'prod' && !args.yes) throw new Error('--apply --env=prod needs --yes')
  if (!args.reportPath) throw new Error('--apply needs --report <path to the dry run report.json>')
  if (report?.tool !== REPORT_TOOL || report.version !== REPORT_VERSION || report.dryRun !== true || !Array.isArray(report.rows)) {
    throw new Error(`${args.reportPath} is not a dry-run report of this script (version ${REPORT_VERSION})`)
  }
  const ageDays = (now - Date.parse(report.generatedAt)) / 86_400_000
  if (!Number.isFinite(ageDays) || ageDays < 0) throw new Error(`${args.reportPath} has no valid generatedAt: run the dry run again`)
  if (ageDays > MAX_REPORT_AGE_DAYS) throw new Error(`${args.reportPath} is ${Math.floor(ageDays)} days old: run the dry run again`)

  const rows = []
  const skipped = []
  for (const r of report.rows) {
    if (!r.out_file) continue
    if (!isWikiSource(r.source_kind) && !args.includeThirdParty) {
      skipped.push(`${r.slug} (${r.source_kind ?? 'unknown'} picture)`)
      continue
    }
    const bytes = fileBytes(r.out_file)
    if (!bytes || sha256(bytes) !== r.out_sha256) throw new Error(`${r.out_file} is missing or not the file the report lists: run the dry run again`)
    rows.push({ ...r, upload_path: hdImagePath(r.slug, r.source_kind), bytes })
  }
  return { rows, skipped }
}

/**
 * Uploads each planned picture and points the pet at it, only where
 * image_url still equals what the dry run saw (an edit made since then wins):
 * checked before the upload, and again in the UPDATE itself.
 * @returns {Promise<{ pointed: string[], changed: string[] }>}
 */
export async function applyRows({ db, bucket, publicPrefix, rows }) {
  const unchanged = (q, r) => (r.current_url == null ? q.is('image_url', null) : q.eq('image_url', r.current_url))
  const pointed = []
  const changed = []
  for (const r of rows) {
    const { data: pet, error: readErr } = await unchanged(db.from('adopt_me_pets').select('id').eq('slug', r.slug), r).maybeSingle()
    if (readErr) throw new Error(`${r.slug}: ${readErr.message}`)
    if (!pet) {
      changed.push(r.slug)
      continue
    }
    const up = await db.storage.from(bucket).upload(r.upload_path, r.bytes, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' })
    if (up.error) throw new Error(`${r.slug}: upload failed: ${up.error.message}`)
    const { data, error } = await unchanged(db.from('adopt_me_pets').update({ image_url: publicPrefix + r.upload_path }).eq('id', pet.id), r).select('id')
    if (error) throw new Error(`${r.slug}: ${error.message}`)
    if (data?.length) pointed.push(r.slug)
    else changed.push(r.slug)
  }
  return { pointed, changed }
}
