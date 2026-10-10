# SEO pipeline (growth point 28): rollout

Branch `feat/seo-pipeline`. One migration: `supabase/migrations/20261009210010_seo_pipeline.sql`
(new tables + one read-only function; touches no existing table, so old code ignores it).

## Order

1. **Merge** the PR (on the owner's word). No release yet.
2. **`db push` BEFORE the deploy.** The new code reads `seo_settings`, `seo_value_evidence` and
   `seo_index_overrides` on every value page and in the sitemap. Without them it fails open
   (everything indexable, no "Updated" date) — safe, but the owner's 5 Brainrot overrides and
   `/admin/seo` only work once the tables exist.
   ```
   cd ~/gamevault && npx --no-install supabase db push --dry-run   # lists 20261009210010_seo_pipeline
   cd ~/gamevault && npx --no-install supabase db push
   ```
   (Main checkout on `main` at origin/main first — see release-needs-db-push-first.)
3. **Env vars** in Vercel → project `gamevault` → Settings → Environment Variables, **Production only**:

   | Name | Value | Needed for |
   |---|---|---|
   | `GSC_SERVICE_ACCOUNT_KEY_B64` | the service-account key JSON, base64, one line: `base64 -i ~/.config/gsc/key.json \| tr -d '\n' \| pbcopy` (mark Sensitive) | the daily Google check (`/api/cron/seo-gsc`). Unset → the cron skips. Same key `pnpm gsc:index-report` uses; it already has access to `sc-domain:dropmarket.gg`. |
   | `DISCORD_SEO_WEBHOOK_URL` | `https://discord.com/api/webhooks/<id>/<token>` (Discord → channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy URL) | alerts. Unset → alerts are stored on `/admin/seo` but not posted. |

   No env var for the gate mode: it lives in the database (`seo_settings.gate_mode`, default
   `report`) and is switched on `/admin/seo`. `CRON_SECRET` already exists. The post-deploy step
   reads Vercel's system var `VERCEL_DEPLOYMENT_ID` (falls back to `VERCEL_GIT_COMMIT_SHA`).
4. **RELEASE** (owner's word only).
5. **Right after the deploy**, run once (fills the evidence now instead of at the next price run):
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" https://dropmarket.gg/api/cron/seo-evidence
   curl -H "Authorization: Bearer $CRON_SECRET" https://dropmarket.gg/api/cron/seo-indexnow
   curl -H "Authorization: Bearer $CRON_SECRET" "https://dropmarket.gg/api/cron/seo-gsc?test-alert=1"   # Discord test message
   curl -H "Authorization: Bearer $CRON_SECRET" https://dropmarket.gg/api/cron/seo-gsc               # first Google check
   ```
   Then check: `/sitemap.xml` lists 9 section files; a value page's source (not its visible UI,
   owner 2026-10-10) has the meta description starting "<Item> is worth about $X · from N offers
   we track · Updated <date>." and a WebPage JSON-LD with `dateModified` + the value table
   (`mainEntity.additionalProperty`); `/admin/seo` loads.
6. **Search Console / Bing:** `/sitemap.xml` keeps its URL (now an index), nothing to resubmit.
   Per-section index counts appear under Sitemaps once Google re-reads it.

## The gate stays report-only (~7 days)

Report mode hides nothing. Only the five no-price Brainrot pages the owner chose are noindexed at
once (rows in `seo_index_overrides`). After ~7 days (planned 2026-10-16, editable on `/admin/seo`)
the dry run should be down to ~243 pages; the owner presses **Switch Gate On** on `/admin/seo`.
That noindexes the failing pages, drops them from the sitemap (within the hour) and logs them for
IndexNow. **Back To Report Only** reverses it the same way. Indexed / clicked pages are never
auto-hidden; they wait on the "Pages That Need Your Call" list.

## Crons

Hourly: `.github/workflows/seo-hourly.yml` (minute 25) calls `seo-indexnow` then `seo-gsc`, so IndexNow
retries happen within the hour and the Google check covers the sitemap in about a day (1,500/day cap).
The vercel.json entries below are the daily backstop (repo rule: vercel.json stays daily).

| Path | UTC | Does |
|---|---|---|
| `/api/cron/seo-evidence` | 05:10 | evidence for every value game (backstop; price runs refresh their game) |
| `/api/cron/seo-indexnow` | 05:40 | post-deploy diff + retry of unsent/failed IndexNow rows (normal sends are immediate) |
| `/api/cron/seo-gsc` | 06:20 | URL Inspection (≤1,500/day, ~4 min/run), Search Analytics, section index rate, alerts |

## Rollback

Switch the gate to report on `/admin/seo` (instant). Reverting the code is safe with the tables in
place; the tables can stay.

## Follow-up release (PR #184)

Migration `20261010151051_seo_value_first_seen.sql` adds `seo_value_evidence.first_seen_at`
(nullable, additive). **`db push` BEFORE the deploy** (the new code selects the column; without it
pages and sitemap fail open to report mode). After the deploy, run `seo-evidence` once to backfill it.

- A value page under 7 days old passes the gate on 5+ offers alone (owner: a new game's pages are
  not hidden for being new); after its first week it needs 7 days of history too.
- A page priced for the first time is logged as `value-new:<game>`, so new item pages reach
  IndexNow on day one.
- `seo-gsc` stops on Google's "Quota exceeded" 429 instead of retrying into it.
