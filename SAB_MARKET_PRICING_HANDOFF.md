# Steal a Brainrot Market Pricing Handoff

Last updated: 2026-07-25

## 1. Project and current state

- Repository: `gyanu1614/gamevault`
- Original local checkout: `/Users/gyanendra/gamevault-sab-pages`
- Working branch before final publish: `feature/sab-eldorado-prices`
- Main already contains PR #5, merge commit `ca3d8fb`, which added the SAB value pages, Itemku collection/import pipeline, market database pipeline, and public price catalog.
- The remaining local work finalizes the Eldorado collector/import behavior and the sub-dollar/public-catalog database fix.
- Current catalog size: 498 Brainrots.
- Visible default prices before the sub-dollar fix: 345.
- Visible default prices after the sub-dollar fix: 402.
- Remaining missing default prices: 96.
  - 56 have no attributable imported listings.
  - 40 only have non-default mutation listings.

The 57-price improvement came from allowing valid positive evidence below `$1.00`. The displayed public price floor is now `> 0`, but trade readiness remains a separate decision and can still require `$1.00` or stronger evidence.

## 2. System architecture

The pipeline is:

1. A source-specific collector gathers public marketplace listings.
2. The collector writes a normalized JSON feed under `data/sab-market-feeds/`.
3. `scripts/import-sab-market-json.mjs` validates the feed and groups rows by `source_slug`.
4. The importer sends authenticated POST batches to the Supabase Edge Function:
   `https://cserfvellsliylifjkos.supabase.co/functions/v1/sab-market-import`
5. The Edge Function calls `sab_import_market_listings` with the service-role client.
6. Raw rows are upserted by `(source_id, external_listing_id)`, so a repeated listing updates rather than duplicates.
7. The final batch calls `sab_publish_market_estimates()` and triggers frontend revalidation.
8. The website reads `public.sab_public_price_catalog`.

Security boundary:

- Browser roles may read `sab_public_price_catalog` only.
- `sab_public_price_catalog` reads through `sab_public_price_catalog_rows()`.
- `sab_public_price_catalog_rows()` must remain `SECURITY DEFINER`, owned by `postgres`, with a controlled `search_path`.
- Do not grant `anon` or `authenticated` direct access to `sab_market_raw_listings` or other private pipeline tables.

## 3. Itemku implementation

### Collector

File: `scripts/collect-itemku-sab.mjs`

- Uses Playwright Chromium.
- Starts from `https://www.itemku.com/en/g/steal-a-brainrot/item`.
- Reads product cards, product IDs, titles, URLs, and USD prices.
- Produces `active_listing` records with status `active`.
- Deduplicates by Itemku product ID.
- Stops when the expected result count is reached or two pages produce no new product IDs.
- Stops on HTTP 403 or 429 rather than attempting to bypass marketplace controls.
- Writes `data/sab-market-feeds/itemku-latest.json`.
- `--send` invokes the shared JSON importer.

Package commands:

```bash
npm run sab:itemku:collect
npm run sab:itemku:send
```

### Existing daily automation

File: `.github/workflows/sab-itemku-daily.yml`

- Already scheduled daily with cron `23 9 * * *`.
- GitHub Actions cron is UTC, so it runs at 09:23 UTC.
- Also supports manual `workflow_dispatch` with a maximum-page input.
- Uses Node.js 22.
- Installs Playwright Chromium.
- Runs `npm ci` followed by `npm run sab:itemku:send`.
- Uses GitHub Actions secret `SAB_MARKET_IMPORT_SECRET`.
- Uploads `data/sab-market-feeds/itemku-latest.json` as a 14-day workflow artifact.
- Concurrency group prevents overlapping Itemku runs.

Therefore Itemku price collection is already automatic daily once this workflow is present on the default branch and Actions are enabled.

## 4. Eldorado implementation

### Final collector

File to keep: `scripts/collect-eldorado-sab-api-v6.mjs`

Obsolete/debug collectors should not be committed:

- `scripts/collect-eldorado-sab-api.mjs`
- `scripts/collect-eldorado-sab-api-v2.mjs`
- `scripts/collect-eldorado-sab-api-v3.mjs`
- `scripts/collect-eldorado-sab-api-v4.mjs`
- `scripts/collect-eldorado-sab-api-v5.mjs`
- `scripts/debug-eldorado-page.mjs`
- `scripts/debug-eldorado-search-api.mjs`

V6 behavior:

- Uses Eldorado's public offers endpoint under `/api/v1/item-management/offers`.
- Structured lookup first tries known SEO/filter mappings.
- Then tries a generated `tradeEnvironmentValue2` value.
- Then uses the exact Search Items API fallback.
- Validates the exact Brainrot name.
- Validates the marketplace income band against the catalog base income multiplied by the mutation multiplier, or a verified override.
- Selects only the range containing the expected income.
- Collects up to 10 samples per variant.
- Stops on HTTP 403 or 429; no bypass behavior.
- Uses a progress file for resumable local collection.
- `selected 0` means the progress file has exhausted its target set; it does not mean every Brainrot has a published value.

Important title fix:

Eldorado's long descriptions originally produced synthetic titles up to 500 characters and caused intermittent Edge Function JSON/import failures. The final collector sends compact titles such as:

```js
const title = compact(
  `${brainrot.name} ${candidate.mutation.name} Brainrot`,
).slice(0, 100);
```

Price comes from Eldorado's structured price field, not from description text.

### Eldorado local import wrapper

File: `scripts/import-eldorado-with-secret.sh`

- Keeps the import secret outside source control.
- Loads `SAB_MARKET_IMPORT_SECRET` locally and invokes the shared JSON importer.
- Never print, commit, paste, or log the secret.

Recommended import settings:

```bash
SAB_MARKET_IMPORT_BATCH_SIZE=50 \
SAB_MARKET_IMPORT_BATCH_DELAY_MS=1000 \
./scripts/import-eldorado-with-secret.sh
```

The local importer changes add:

- configurable batch size
- delay between batches
- up to five attempts
- retry delays of 3, 6, 9, and 12 seconds
- HTTP status in errors
- `x-defer-publication: true` on intermediate batches
- publication and frontend revalidation only on the final batch

The Edge Function local change understands the deferred-publication header and skips publication/revalidation until the last request.

## 5. Secret and deployment setup

### Shared import secret

Name: `SAB_MARKET_IMPORT_SECRET`

The same secret value is configured in two places:

1. Supabase Edge Function environment, where `sab-market-import` reads it.
2. GitHub repository Actions secret, used by the Itemku workflow.

The secret is already configured. Do not ask the user to set it again unless it is intentionally being rotated.

Request authentication:

```text
x-import-secret: <SAB_MARKET_IMPORT_SECRET>
```

The importer reads the value from its environment. The secret must never be hard-coded into JavaScript, shell files, workflow YAML, migration SQL, logs, or documentation.

For a deliberate rotation, update Supabase and GitHub to the same new value, then test one small import. Do not reveal the value in chat output.

### Edge Function environment

The function also relies on Supabase-provided/runtime secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Revalidation configuration:

- `SAB_MARKET_REVALIDATE_URL`
- `SAB_MARKET_REVALIDATE_SECRET`
- optional `VERCEL_AUTOMATION_BYPASS_SECRET`

Deployment command used for the function:

```bash
npx -y supabase@latest functions deploy sab-market-import \
  --project-ref cserfvellsliylifjkos
```

Do not use `supabase db push` for this project. Database SQL was applied through the Supabase SQL Editor and then preserved as a migration file in Git.

## 6. Sub-dollar and public catalog fix

Final migration:

`supabase/migrations/20260725094500_sab_sub_dollar_watchlist_prices.sql`

What it does:

- Inserts or updates default-mutation watchlist rows to use `minimum_cash_value_usd = 0.01` when positive matched listings exist.
- Avoids replacing dependent views, which previously caused PostgreSQL error `42P16: cannot drop columns from view`.
- Recreates `sab_public_price_catalog_rows()` with the existing 17-column signature.
- Keeps the function `SECURITY DEFINER` and owned by `postgres`.
- Removes temporary diagnostic grants/policies.
- Keeps raw listings private.
- Publishes estimates and reloads the PostgREST schema.

Verified outcome:

```text
missing_default_prices = 96
```

## 7. Current Git status and intended commit scope

The local branch had many generated/debug files. Only these production files belong in the final PR:

```text
scripts/collect-eldorado-sab-api-v6.mjs
scripts/import-eldorado-with-secret.sh
scripts/import-sab-market-json.mjs
supabase/functions/sab-market-import/index.ts
supabase/migrations/20260725094500_sab_sub_dollar_watchlist_prices.sql
SAB_MARKET_PRICING_HANDOFF.md
```

Do not commit:

- `.vscode/`
- `data/sab-market-feeds/`
- `*.log`
- progress files
- debug JSON/HTML/PNG files
- obsolete Eldorado collector versions
- local secret files

The tracked file `scripts/collect-eldorado-sab.mjs` had unrelated/obsolete local changes and should be restored rather than staged.

Checks already passed locally:

```bash
node --check scripts/collect-eldorado-sab-api-v6.mjs
node --check scripts/import-sab-market-json.mjs
npx tsc --noEmit
```

## 8. Daily pricing status and plan

### Active now

- Itemku: automatic daily via GitHub Actions at 09:23 UTC.
- Marketplace imports: authenticated, published, and revalidated through the Edge Function.

### Not active yet

- Eldorado does not yet have a committed daily GitHub Actions workflow.
- V6 collection/import works manually.

### Recommended Eldorado daily design

After the V6 collector is merged and observed manually for several successful runs, add `.github/workflows/sab-eldorado-daily.yml` with these safeguards:

1. Daily schedule staggered away from Itemku.
2. `workflow_dispatch` for manual recovery.
3. A non-overlapping concurrency group.
4. Node.js 22 and `npm ci`.
5. `SAB_MARKET_IMPORT_SECRET` from GitHub Actions secrets.
6. Import batches of 50 with a 1000 ms delay.
7. Collector exits on 403/429 and does not bypass controls.
8. Import runs only when collection exits successfully.
9. Feed, progress report, and logs uploaded as short-lived artifacts.
10. Keep the run below the Actions timeout by collecting only stale/missing variants or by splitting the catalog into deterministic daily shards.

Do not blindly reuse an exhausted local progress file in CI. GitHub-hosted runners are ephemeral, so the workflow must either start a deliberate fresh target set or download/upload a controlled progress artifact.

A good next optimization is a stale-first collector mode:

- first collect Brainrots with no default estimate
- then estimates older than a chosen freshness target
- then low-confidence estimates
- finally refresh the rest in rotating shards

This avoids requesting all 498 Brainrots every day and lowers rate-limit risk.

## 9. Manual runbook

### Itemku dry run

```bash
npm run sab:itemku:collect
```

### Itemku collect and import

```bash
SAB_MARKET_IMPORT_SECRET='loaded-from-safe-secret-store' \
  npm run sab:itemku:send
```

Do not type the real value into shared logs or documentation.

### Eldorado collect

Run the V6 collector using its built-in progress/output arguments and `--samples-per-variant 10`. Do not run concurrent collectors because the progress/output files are shared.

### Eldorado import

```bash
SAB_MARKET_IMPORT_BATCH_SIZE=50 \
SAB_MARKET_IMPORT_BATCH_DELAY_MS=1000 \
./scripts/import-eldorado-with-secret.sh
```

### Verify public access as the frontend role

```sql
begin;
set local role anon;

select count(*) as visible_price_rows
from public.sab_public_price_catalog;

select count(*) as visible_default_prices
from public.sab_public_price_catalog
where mutation_slug = 'default';

rollback;
```

### Verify remaining missing defaults

```sql
select count(*) as missing_default_prices
from public.sab_brainrot_catalog brainrot
left join public.sab_public_price_catalog price
  on price.brainrot_id = brainrot.id
 and price.mutation_slug = 'default'
where price.brainrot_id is null;
```

Expected current result: `96`.

## 10. Frontend behavior

Routes:

```text
/steal-a-brainrot/values
/steal-a-brainrot/values/<brainrot-slug>
/steal-a-brainrot/value-calculator
```

The calculator looks up an exact pair:

```text
brainrot_id + mutation_id
```

Therefore:

- Default selected: show the real default price.
- Mutation with direct market evidence: show its exact mutation price.
- Mutation without evidence: do not pretend the default value is the exact mutation value.
- A future UI improvement may show the base/default value as a reference while labeling the mutation-specific price as pending.

When local frontend data appears stale:

```bash
rm -rf .next
npm run dev
```

The Edge Function revalidates the deployed frontend; it does not clear a local `.next` cache.

## 11. Guidance for another AI/account

- Read this file before changing the SAB market pipeline.
- Inspect current Git status before staging anything.
- Stage explicit paths only; never use `git add -A` in the current mixed worktree.
- Keep `.vscode/` untracked.
- Do not commit generated marketplace feeds, logs, screenshots, or progress files.
- Do not expose or request the import secret unless rotating it.
- Do not grant browser roles access to raw listings.
- Do not use `supabase db push`; SQL changes go through the SQL Editor and are preserved as migrations.
- Do not run multiple Eldorado collectors concurrently.
- Stop on 403/429; do not implement bypass behavior.
- Preserve the exact public catalog function signature unless all dependent views and frontend types are intentionally migrated together.
