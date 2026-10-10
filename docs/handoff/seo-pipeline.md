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

## Crons (vercel.json, daily — repo rule)

| Path | UTC | Does |
|---|---|---|
| `/api/cron/seo-evidence` | 05:10 | evidence for every value game (backstop; price runs refresh their game) |
| `/api/cron/seo-indexnow` | 05:40 | post-deploy diff + retry of unsent/failed IndexNow rows (normal sends are immediate) |
| `/api/cron/seo-gsc` | 06:20 | URL Inspection (≤1,500/day, ~4 min/run), Search Analytics, section index rate, alerts |

## Rollback

Switch the gate to report on `/admin/seo` (instant). Reverting the code is safe with the tables in
place; the tables can stay.
