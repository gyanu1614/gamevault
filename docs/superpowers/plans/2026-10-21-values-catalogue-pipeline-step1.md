# Values Catalogue Pipeline, Step 1 (core + Steal a Brainrot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily, insert-only pipeline that adds newly released Steal a Brainrot brainrots from the Fandom wiki: images, facts, refresh, Discord. The shared core is built so later games are one adapter each.

**Architecture:**
- **Core:** pure planning (`plan.ts`) between thin I/O modules: wiki client, store, images, notify. The orchestrator `run.ts` has every dependency injected, so it is unit-tested with fakes.
- **Per game:** one adapter (`games/steal-a-brainrot.ts`) owns the wiki parse and the `sab_brainrots` writes.
- **Runtime:** a tsx CLI runs in a GitHub matrix workflow, one job per game.

**Tech Stack:** TypeScript, Supabase (supabase-js, Postgres migration), MediaWiki API, sharp (WebP), vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-21-values-catalogue-pipeline-design.md`

## Global Constraints

- **pnpm only:** `pnpm install` in this worktree first. Never npm.
- **Insert-only:** the pipeline never updates or deletes an existing item row. Its only updates fill `image_path` / `image_status` on rows it added itself.
- **Wiki etiquette:** at least 1 s between wiki API calls, UA `DropMarketBot/1.0 (+https://dropmarket.gg; values catalogue, 1 req/s)`, batches of 50.
- **Imports:** catalogue modules use relative imports only (no `@/`). Tests may use `@/`.
- **New tables:** RLS on, no policies, plus `revoke all … from anon, authenticated` (table-posture guard).
- **Migration timestamp:** the real current second, `date +%Y%m%d%H%M%S`, never a round number.
- **Tests:** run on the local stack only (`pnpm db:up`, `.env.test`). Never with the prod `.env.local`. Integration rows use the file's fixture namespace and are cleaned up.
- **Files:** each under about 400 lines. Comments match the repo's density (a header block per file, short why-comments).
- **Prod runs** (dry or write) are the owner's call. The first SAB write needs `--allow-large`, about 100 brainrots missed since July.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_catalogue_pipeline.sql` | `catalogue_refs`, `catalogue_runs` |
| `src/lib/catalogue/types.ts` | contracts: WikiPage, ParsedItem, adapter, report |
| `src/lib/catalogue/plan.ts` | pure: slug, candidates, adopt/insert/ignore, guards |
| `src/lib/catalogue/wiki.ts` | MediaWiki client (paced, retried, paged, batched) |
| `src/lib/catalogue/store.ts` | refs + runs reads and writes |
| `src/lib/catalogue/images.ts` | wiki file → 512 px WebP → bucket |
| `src/lib/catalogue/notify.ts` | Discord text |
| `src/lib/catalogue/run.ts` | orchestrator |
| `src/lib/catalogue/registry.ts` | CATALOGUE_GAMES |
| `src/lib/catalogue/games/steal-a-brainrot.ts` | SAB adapter |
| `src/lib/catalogue/games/__fixtures__/sab-pages.json` | saved wiki pages for tests |
| `scripts/catalogue.mjs` + `package.json` script | CLI |
| `.github/workflows/values-catalogue-daily.yml` | daily matrix job |
| tests next to each module + `src/test/guards/values-catalogue-workflow.guard.test.ts` + `src/test/guards/catalogue-store.guard.integration.test.ts` | |

---

### Task 1: Migration for refs and runs

**Files:**
- Create: `supabase/migrations/<ts>_catalogue_pipeline.sql` (`ts=$(date +%Y%m%d%H%M%S)`)

**Interfaces:**
- Produces:
  - `catalogue_refs(game_slug, page_id, wiki_title, item_slug, status, first_seen_at, checked_at)`, primary key `(game_slug, page_id)`;
  - `catalogue_runs(id, game_slug, started_at, finished_at, trigger, status, listed, candidates, adopted, added_slugs, ignored, images_fixed, message, details)`.

- [ ] **Step 1: Write the migration**

```sql
-- Values catalogue pipeline (docs/superpowers/specs/2026-10-21-values-catalogue-pipeline-design.md).
-- catalogue_refs: every wiki page the daily run has decided about (an item we
-- hold, or not an item), keyed by the wiki's page id so a rename never makes a
-- duplicate and a page is read once. catalogue_runs: one row per game per run,
-- for /admin and the health check. Service role only.

create table if not exists public.catalogue_refs (
  game_slug     text        not null,
  page_id       bigint      not null,
  wiki_title    text        not null,
  item_slug     text,
  status        text        not null check (status in ('item', 'ignored')),
  first_seen_at timestamptz not null default now(),
  checked_at    timestamptz not null default now(),
  primary key (game_slug, page_id)
);

comment on table public.catalogue_refs is
  'Values catalogue pipeline: wiki pages already decided about (item_slug set = an item we hold).';

create table if not exists public.catalogue_runs (
  id           bigserial   primary key,
  game_slug    text        not null,
  started_at   timestamptz not null,
  finished_at  timestamptz not null default now(),
  trigger      text        not null check (trigger in ('schedule', 'manual')),
  status       text        not null check (status in ('ok', 'nothing_new', 'blocked', 'failed')),
  listed       integer     not null default 0,
  candidates   integer     not null default 0,
  adopted      integer     not null default 0,
  added_slugs  text[]      not null default '{}',
  ignored      integer     not null default 0,
  images_fixed integer     not null default 0,
  message      text,
  details      jsonb       not null default '{}'::jsonb
);

create index if not exists catalogue_runs_game_started_idx
  on public.catalogue_runs (game_slug, started_at desc);

alter table public.catalogue_refs enable row level security;
alter table public.catalogue_runs enable row level security;
revoke all on table public.catalogue_refs from anon, authenticated;
revoke all on table public.catalogue_runs from anon, authenticated;
revoke all on sequence public.catalogue_runs_id_seq from anon, authenticated;
```

- [ ] **Step 2: Apply it locally and check posture**

```bash
pnpm db:up && pnpm test:reset
pnpm vitest run src/test/guards/table-posture.guard.integration.test.ts src/test/guards/private-tables-rls.guard.integration.test.ts src/test/guards/log-tables-rls.guard.integration.test.ts
```

Expected: all PASS. If a guard pins a list of log tables, add both tables there, with the reason "service-role-only pipeline log".

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*_catalogue_pipeline.sql
git commit -m "feat(catalogue): refs + runs tables"
```

---

### Task 2: Contracts and pure planning

**Files:**
- Create: `src/lib/catalogue/types.ts`, `src/lib/catalogue/plan.ts`
- Test: `src/lib/catalogue/plan.test.ts`

**Interfaces:**
- Produces: everything in `types.ts` (below), plus:
  - `slugifyTitle(title): string`
  - `candidatePages({listed, recent, refs, now}): ListedPage[]`
  - `planCatalogue(pages: ParsedPage[], known: KnownItem[]): CataloguePlan`
  - `guardRun({candidates, parseErrors, toInsert, cap, allowLarge}): Verdict`
  - constants `RECENT_WINDOW_DAYS = 3`, `RECHECK_IGNORED_DAYS = 30`, `DEFAULT_INSERT_CAP = 50`

- [ ] **Step 1: Write `types.ts`**

```ts
/**
 * Values catalogue pipeline: the contracts (spec:
 * docs/superpowers/specs/2026-10-21-values-catalogue-pipeline-design.md).
 *
 * One shared run (run.ts) adds newly released items from each game's Fandom
 * wiki; a game is one adapter (games/<game>.ts) behind these types. Relative
 * imports only: the tsx CLI (scripts/catalogue.mjs) and vitest load these
 * files the same way.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type Db = SupabaseClient

/** A wiki page as the run reads it: latest revision only. */
export interface WikiPage {
  pageId: number
  title: string
  revisionId: number | null
  content: string
  /** "Category:Secret Brainrots" … */
  categories: string[]
}

/** One listing; the union of a game's listings is every item page. */
export interface WikiListQuery {
  list: 'categorymembers' | 'embeddedin'
  /** "Category:Pets" / "Template:Brainrot Infobox". */
  title: string
}

export interface ListedPage {
  pageId: number
  title: string
}

export interface RecentPage extends ListedPage {
  /** Created (not just edited) inside the window. */
  isNew: boolean
}

export interface WikiClient {
  listPages(q: WikiListQuery): Promise<ListedPage[]>
  /** Main-namespace pages created or edited since `sinceIso`. */
  recentChanges(sinceIso: string): Promise<RecentPage[]>
  fetchPages(pageIds: number[]): Promise<WikiPage[]>
  wikitext(title: string): Promise<string>
  /** File name → URL of its `width`-px rendition; files the wiki lacks are absent. */
  imageUrls(files: string[], width: number): Promise<Map<string, string>>
  /** API calls made so far (for the run report). */
  requests(): number
}

/** The stored How To Get object (src/lib/values/how-to-get.ts reads it back). */
export interface StoredHowToGet {
  status: 'obtainable' | 'unobtainable' | 'unknown' | 'seasonal'
  method: string
  costs?: string
  odds?: string
  released?: string
  note?: string
  sources: string[]
  confidence: 'high' | 'medium' | 'low'
  checked_at: string
}

export interface ParsedItem {
  pageId: number
  revisionId: number | null
  wikiTitle: string
  pageUrl: string
  slug: string
  name: string
  rarity: string | null
  /** Wiki file name without "File:" ("Slushi Huski.png"). */
  imageFile: string | null
  releasedAt: string | null
  origin: string | null
  howToGet: StoredHowToGet | null
  /** Game-specific columns (SAB: income, cost, obtainability, categories). */
  extra: Record<string, unknown>
}

/** An item we already hold, as the matcher needs it. */
export interface KnownItem {
  slug: string
  name: string
  pageId: number | null
}

export interface CatalogueRef {
  pageId: number
  wikiTitle: string
  itemSlug: string | null
  status: 'item' | 'ignored'
  firstSeenAt: string
  checkedAt: string
}

export interface ImageTarget {
  bucket: string
  path: string
}

export interface ImageStore {
  /** Copies one wiki file to our storage as a 512 px WebP. Never throws. */
  copy(file: string, target: ImageTarget): Promise<boolean>
}

export type ParseContext = { checkedAt: string } & Record<string, unknown>

export interface CatalogueAdapter {
  gameSlug: string
  /** Plural noun for messages: "brainrots", "pets", "items". */
  label: string
  /** "stealabrainrot.fandom.com". */
  wikiHost: string
  listQueries: WikiListQuery[]
  /** New items one run may add before it stops and asks (default 50). */
  insertCap?: number
  /** Once-per-run wiki reads the parser needs (SAB: the Update Log). */
  prepare?(wiki: WikiClient): Promise<Record<string, unknown>>
  /** One page → an item, or null when the page is not one. Pure. */
  parse(page: WikiPage, ctx: ParseContext): ParsedItem | null
  loadKnown(db: Db): Promise<KnownItem[]>
  /** Insert-only (on conflict do nothing); returns the slugs actually inserted. */
  insert(db: Db, items: ParsedItem[], images: ImageStore): Promise<string[]>
  /** Retries images for rows this pipeline added without one; returns the slugs fixed. */
  fixMissingImages?(db: Db, images: ImageStore): Promise<string[]>
}

export interface CatalogueGame {
  /** CLI / workflow key, same as PRICING_GAMES ("sab"). */
  key: string
  /** "Steal a Brainrot". */
  name: string
  adapter: CatalogueAdapter
}

export type RunStatus = 'ok' | 'nothing_new' | 'blocked' | 'failed'

export interface RunReport {
  gameSlug: string
  status: RunStatus
  listed: number
  candidates: number
  adopted: number
  /** Inserted (write) or would be inserted (dry run). */
  added: { slug: string; name: string }[]
  ignored: number
  imagesFixed: number
  parseErrors: string[]
  message: string | null
  wikiRequests: number
}
```

- [ ] **Step 2: Write the failing test `plan.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { candidatePages, guardRun, planCatalogue, slugifyTitle } from './plan'
import type { CatalogueRef, ParsedItem } from './types'

const NOW = new Date('2026-10-21T12:00:00Z')
const ref = (pageId: number, status: 'item' | 'ignored', checkedAt = '2026-10-20T00:00:00Z'): CatalogueRef => ({
  pageId, wikiTitle: `P${pageId}`, itemSlug: status === 'item' ? `p${pageId}` : null, status, firstSeenAt: checkedAt, checkedAt,
})
const item = (pageId: number, name: string): ParsedItem => ({
  pageId, revisionId: 1, wikiTitle: name, pageUrl: `https://w/${pageId}`, slug: slugifyTitle(name), name,
  rarity: 'Secret', imageFile: null, releasedAt: null, origin: null, howToGet: null, extra: {},
})

describe('slugifyTitle', () => {
  it('matches the existing slug style', () => {
    expect(slugifyTitle('La Vacca Prese Presente')).toBe('la-vacca-prese-presente')
    expect(slugifyTitle("Traveler's Gun")).toBe('travelers-gun')
    expect(slugifyTitle('Wolf (2026)')).toBe('wolf-2026')
  })
})

describe('candidatePages', () => {
  const listed = [{ pageId: 1, title: 'A' }, { pageId: 2, title: 'B' }, { pageId: 3, title: 'C' }]
  it('reads pages we never decided about, never pages already matched to an item', () => {
    const refs = new Map([[1, ref(1, 'item')]])
    expect(candidatePages({ listed, recent: [], refs, now: NOW }).map((p) => p.pageId)).toEqual([2, 3])
  })
  it('adds pages created or edited recently that no listing has yet (uncategorised new pages)', () => {
    const out = candidatePages({ listed, recent: [{ pageId: 9, title: 'Embergun', isNew: true }], refs: new Map(), now: NOW })
    expect(out.map((p) => p.pageId)).toEqual([1, 2, 3, 9])
  })
  it('re-reads an ignored page when it was edited recently or not checked for 30 days', () => {
    const refs = new Map([
      [1, ref(1, 'ignored')],
      [2, ref(2, 'ignored', '2026-09-01T00:00:00Z')],
      [3, ref(3, 'ignored')],
    ])
    const out = candidatePages({ listed, recent: [{ pageId: 1, title: 'A', isNew: false }], refs, now: NOW })
    expect(out.map((p) => p.pageId)).toEqual([1, 2])
  })
})

describe('planCatalogue', () => {
  const known = [
    { slug: 'tralalero-tralala', name: 'Tralalero Tralala', pageId: 10 },
    { slug: 'los-tralaleritos', name: 'Los Tralaleritos', pageId: null },
  ]
  it('adopts by page id, slug or name; inserts the rest; ignores non-items', () => {
    const plan = planCatalogue(
      [
        { pageId: 10, title: 'Tralalero Tralala (renamed)', item: item(10, 'Tralalero Tralala Renamed') },
        { pageId: 11, title: 'Los Tralaleritos', item: item(11, 'Los Tralaleritos') },
        { pageId: 12, title: 'Slushi Huski', item: item(12, 'Slushi Huski') },
        { pageId: 13, title: 'Slushi Huski/Gallery', item: null },
      ],
      known,
    )
    expect(plan.adopt).toEqual([
      { pageId: 10, title: 'Tralalero Tralala (renamed)', slug: 'tralalero-tralala' },
      { pageId: 11, title: 'Los Tralaleritos', slug: 'los-tralaleritos' },
    ])
    expect(plan.insert.map((i) => i.slug)).toEqual(['slushi-huski'])
    expect(plan.ignore).toEqual([{ pageId: 13, title: 'Slushi Huski/Gallery' }])
  })
  it('never inserts two pages with the same slug in one run', () => {
    const plan = planCatalogue([{ pageId: 1, title: 'X', item: item(1, 'Cobra') }, { pageId: 2, title: 'Y', item: item(2, 'Cobra') }], [])
    expect(plan.insert).toHaveLength(1)
    expect(plan.ignore).toEqual([{ pageId: 2, title: 'Y' }])
  })
})

describe('guardRun', () => {
  const base = { candidates: 100, parseErrors: 0, toInsert: 5, cap: 50, allowLarge: false }
  it('passes a normal run', () => expect(guardRun(base)).toEqual({ ok: true }))
  it('stops when many pages fail to parse (format change)', () => {
    expect(guardRun({ ...base, parseErrors: 21 })).toMatchObject({ ok: false })
    expect(guardRun({ ...base, candidates: 5, parseErrors: 2 })).toEqual({ ok: true })
  })
  it('stops over the cap unless allowed by hand', () => {
    expect(guardRun({ ...base, toInsert: 51 })).toMatchObject({ ok: false })
    expect(guardRun({ ...base, toInsert: 51, allowLarge: true })).toEqual({ ok: true })
  })
})
```

- [ ] **Step 3: Run it and see it fail**

Run: `pnpm vitest run src/lib/catalogue/plan.test.ts`
Expected: FAIL, because `./plan` does not exist.

- [ ] **Step 4: Write `plan.ts`**

```ts
/**
 * The catalogue run's decisions, pure: which wiki pages to read, which parsed
 * pages are items we already hold (adopt: record the page, insert nothing),
 * which are new, and when a run must stop and ask instead of writing.
 */
import { comparableName } from '../values/normalisers/eldorado-structured'
import type { CatalogueRef, KnownItem, ListedPage, ParsedItem, RecentPage } from './types'

/** Recent-changes window: covers two missed daily runs. */
export const RECENT_WINDOW_DAYS = 3
/** An ignored page is looked at again after this long even without an edit. */
export const RECHECK_IGNORED_DAYS = 30
export const DEFAULT_INSERT_CAP = 50

/** "Traveler's Gun" → "travelers-gun"; the slug style every values table uses. */
export const slugifyTitle = (title: string) => comparableName(title).replace(/ /g, '-')
const nameKey = (name: string) => comparableName(name).replace(/ /g, '')

/**
 * Pages to read this run: every listed or recently changed page we never
 * decided about, plus ignored pages edited in the window (a stub can gain its
 * infobox) or unchecked for 30 days. Pages matched to an item are never re-read.
 */
export function candidatePages(input: {
  listed: ListedPage[]
  recent: RecentPage[]
  refs: Map<number, CatalogueRef>
  now: Date
}): ListedPage[] {
  const all = new Map<number, string>()
  for (const p of input.listed) all.set(p.pageId, p.title)
  for (const p of input.recent) if (!all.has(p.pageId)) all.set(p.pageId, p.title)
  const edited = new Set(input.recent.map((p) => p.pageId))
  const stale = input.now.getTime() - RECHECK_IGNORED_DAYS * 86_400_000
  const out: ListedPage[] = []
  for (const [pageId, title] of all) {
    const ref = input.refs.get(pageId)
    if (!ref) out.push({ pageId, title })
    else if (ref.status === 'ignored' && (edited.has(pageId) || Date.parse(ref.checkedAt) < stale)) out.push({ pageId, title })
  }
  return out.sort((a, b) => a.pageId - b.pageId)
}

export interface ParsedPage {
  pageId: number
  title: string
  item: ParsedItem | null
}

export interface CataloguePlan {
  adopt: { pageId: number; title: string; slug: string }[]
  insert: ParsedItem[]
  ignore: { pageId: number; title: string }[]
}

/** Known items match by wiki page id, then slug, then normalised name. */
export function planCatalogue(pages: ParsedPage[], known: KnownItem[]): CataloguePlan {
  const byPage = new Map<number, KnownItem>()
  const bySlug = new Map<string, KnownItem>()
  const byName = new Map<string, KnownItem>()
  for (const k of known) {
    if (k.pageId != null) byPage.set(k.pageId, k)
    bySlug.set(k.slug, k)
    byName.set(nameKey(k.name), k)
  }
  const plan: CataloguePlan = { adopt: [], insert: [], ignore: [] }
  const taken = new Set<string>()
  for (const p of pages) {
    if (!p.item) {
      plan.ignore.push({ pageId: p.pageId, title: p.title })
      continue
    }
    const hit = byPage.get(p.pageId) ?? bySlug.get(p.item.slug) ?? byName.get(nameKey(p.item.name))
    if (hit) plan.adopt.push({ pageId: p.pageId, title: p.title, slug: hit.slug })
    else if (taken.has(p.item.slug)) plan.ignore.push({ pageId: p.pageId, title: p.title })
    else {
      taken.add(p.item.slug)
      plan.insert.push(p.item)
    }
  }
  return plan
}

export type Verdict = { ok: true } | { ok: false; reason: string }

export function guardRun(input: { candidates: number; parseErrors: number; toInsert: number; cap: number; allowLarge: boolean }): Verdict {
  if (input.parseErrors >= 3 && input.parseErrors > input.candidates * 0.2) {
    return { ok: false, reason: `${input.parseErrors} of ${input.candidates} wiki pages failed to parse, so the wiki's page format may have changed` }
  }
  if (input.toInsert > input.cap && !input.allowLarge) {
    return { ok: false, reason: `${input.toInsert} new items is over the safety cap of ${input.cap}; check a dry run, then run once by hand with --allow-large` }
  }
  return { ok: true }
}
```

- [ ] **Step 5: Run the test and see it pass**

Run: `pnpm vitest run src/lib/catalogue/plan.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalogue/types.ts src/lib/catalogue/plan.ts src/lib/catalogue/plan.test.ts
git commit -m "feat(catalogue): contracts + pure run planning"
```

---

### Task 3: MediaWiki client

**Files:**
- Create: `src/lib/catalogue/wiki.ts`
- Test: `src/lib/catalogue/wiki.test.ts`

**Interfaces:**
- Consumes: `WikiClient`, `WikiListQuery`, `WikiPage` from `types.ts`
- Produces:
  - `createWikiClient(options: WikiClientOptions): WikiClient`
  - `WIKI_USER_AGENT`
  - `class WikiError`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { createWikiClient, WikiError } from './wiki'

/** A fake fetch answering queued bodies; records each URL's params. */
function fakeFetch(answers: Array<{ status?: number; body?: unknown } | Error>) {
  const calls: URLSearchParams[] = []
  const impl = async (url: string | URL | Request) => {
    calls.push(new URL(String(url)).searchParams)
    const a = answers.shift()
    if (!a) throw new Error('no answer queued')
    if (a instanceof Error) throw a
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status ?? 200 })
  }
  return { impl: impl as typeof fetch, calls }
}
const clock = () => {
  let t = 0
  const sleeps: number[] = []
  return { now: () => t, sleep: async (ms: number) => { sleeps.push(ms); t += ms }, sleeps }
}

describe('createWikiClient', () => {
  it('pages through continue and spaces calls by the minimum interval', async () => {
    const f = fakeFetch([
      { body: { query: { embeddedin: [{ pageid: 1, title: 'A' }] }, continue: { eicontinue: 'x', continue: '-||' } } },
      { body: { query: { embeddedin: [{ pageid: 2, title: 'B' }] } } },
    ])
    const c = clock()
    const wiki = createWikiClient({ host: 'w.test', fetchImpl: f.impl, now: c.now, sleep: c.sleep, minIntervalMs: 1000 })
    expect(await wiki.listPages({ list: 'embeddedin', title: 'Template:Brainrot Infobox' })).toEqual([{ pageId: 1, title: 'A' }, { pageId: 2, title: 'B' }])
    expect(f.calls[0].get('eititle')).toBe('Template:Brainrot Infobox')
    expect(f.calls[1].get('eicontinue')).toBe('x')
    expect(c.sleeps).toEqual([1000])
    expect(wiki.requests()).toBe(2)
  })

  it('retries a 503 and a network error, but not a 404', async () => {
    const c = clock()
    const ok = createWikiClient({ host: 'w.test', now: c.now, sleep: c.sleep, fetchImpl: fakeFetch([{ status: 503 }, new Error('reset'), { body: { parse: { wikitext: 'hi' } } }]).impl })
    expect(await ok.wikitext('Update_Log')).toBe('hi')
    const notFound = createWikiClient({ host: 'w.test', now: c.now, sleep: c.sleep, fetchImpl: fakeFetch([{ status: 404 }]).impl })
    await expect(notFound.wikitext('X')).rejects.toBeInstanceOf(WikiError)
    const down = createWikiClient({ host: 'w.test', now: c.now, sleep: c.sleep, retries: 1, fetchImpl: fakeFetch([{ status: 500 }, { status: 500 }]).impl })
    await expect(down.wikitext('X')).rejects.toThrow(/gave up after 2 tries/)
  })

  it('fetches pages in batches of 50 and merges categories across continue', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => i + 1)
    const f = fakeFetch([
      { body: { query: { pages: [{ pageid: 1, title: 'A', revisions: [{ revid: 7, slots: { main: { content: '{{X}}' } } }], categories: [{ title: 'Category:One' }] }] }, continue: { clcontinue: '1|Two', continue: '||' } } },
      { body: { query: { pages: [{ pageid: 1, title: 'A', categories: [{ title: 'Category:Two' }] }] } } },
      { body: { query: { pages: [{ pageid: 51, title: 'Z', missing: true }] } } },
    ])
    const c = clock()
    const wiki = createWikiClient({ host: 'w.test', fetchImpl: f.impl, now: c.now, sleep: c.sleep })
    const pages = await wiki.fetchPages(ids)
    expect(pages).toEqual([{ pageId: 1, title: 'A', revisionId: 7, content: '{{X}}', categories: ['Category:One', 'Category:Two'] }])
    expect(f.calls[0].get('pageids')?.split('|')).toHaveLength(50)
    expect(f.calls[2].get('pageids')).toBe('51')
  })

  it('maps image files to their rendition URL through title normalisation', async () => {
    const f = fakeFetch([{ body: { query: {
      normalized: [{ from: 'File:Slushi_Huski.png', to: 'File:Slushi Huski.png' }],
      pages: [{ title: 'File:Slushi Huski.png', imageinfo: [{ url: 'https://img/full.png', thumburl: 'https://img/512.png' }] }, { title: 'File:Gone.png', missing: true }],
    } } }])
    const c = clock()
    const wiki = createWikiClient({ host: 'w.test', fetchImpl: f.impl, now: c.now, sleep: c.sleep })
    const urls = await wiki.imageUrls(['Slushi_Huski.png', 'Gone.png'], 512)
    expect([...urls]).toEqual([['Slushi_Huski.png', 'https://img/512.png']])
    expect(f.calls[0].get('iiurlwidth')).toBe('512')
  })

  it('folds recent changes into one entry per page, new if any change created it', async () => {
    const f = fakeFetch([{ body: { query: { recentchanges: [
      { type: 'edit', pageid: 5, title: 'Embergun' },
      { type: 'new', pageid: 5, title: 'Embergun' },
      { type: 'edit', pageid: 6, title: 'Harvester' },
    ] } } }])
    const c = clock()
    const wiki = createWikiClient({ host: 'w.test', fetchImpl: f.impl, now: c.now, sleep: c.sleep })
    expect(await wiki.recentChanges('2026-10-18T00:00:00.000Z')).toEqual([
      { pageId: 5, title: 'Embergun', isNew: true },
      { pageId: 6, title: 'Harvester', isNew: false },
    ])
    expect(f.calls[0].get('rcend')).toBe('2026-10-18T00:00:00.000Z')
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm vitest run src/lib/catalogue/wiki.test.ts`. Expected: FAIL, module missing.

- [ ] **Step 3: Write `wiki.ts`**

```ts
/**
 * MediaWiki API client for the catalogue run (Fandom wikis, CC BY-SA).
 * Polite by construction: one call at a time, at least `minIntervalMs` apart
 * (default 1 s), batches of 50, a timeout per call, and a short retry on
 * 429 / 5xx / network errors only. Anything else is a WikiError.
 */
import type { ListedPage, RecentPage, WikiClient, WikiListQuery, WikiPage } from './types'

export const WIKI_USER_AGENT = 'DropMarketBot/1.0 (+https://dropmarket.gg; values catalogue, 1 req/s)'
const BATCH = 50

export class WikiError extends Error {}

export interface WikiClientOptions {
  host: string
  fetchImpl?: typeof fetch
  minIntervalMs?: number
  timeoutMs?: number
  /** Extra attempts after a retryable failure (default 2). */
  retries?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

/** "File:Slushi_Huski.png" and "File:Slushi Huski.png" are one file. */
const fileKey = (title: string) => title.replace(/_/g, ' ').trim().toLowerCase()

export function createWikiClient(options: WikiClientOptions): WikiClient {
  const doFetch = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const now = options.now ?? Date.now
  const gap = options.minIntervalMs ?? 1000
  const retries = options.retries ?? 2
  const endpoint = `https://${options.host}/api.php`
  let last = -Infinity
  let count = 0

  async function api(params: Record<string, string>): Promise<any> {
    const url = `${endpoint}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
    for (let attempt = 0; ; attempt++) {
      const wait = last + gap - now()
      if (wait > 0) await sleep(wait)
      last = now()
      count++
      let status = 0
      try {
        const res = await doFetch(url, { headers: { 'User-Agent': WIKI_USER_AGENT }, signal: AbortSignal.timeout(options.timeoutMs ?? 30_000) })
        status = res.status
        if (res.ok) {
          const body = await res.json()
          if (body?.error) throw new WikiError(`${options.host}: ${body.error.code} ${body.error.info ?? ''}`.trim())
          return body
        }
        if (status !== 429 && status < 500) throw new WikiError(`${options.host}: HTTP ${status}`)
      } catch (e) {
        if (e instanceof WikiError) throw e
      }
      if (attempt >= retries) throw new WikiError(`${options.host}: gave up after ${attempt + 1} tries (last: ${status ? `HTTP ${status}` : 'network error'})`)
      await sleep(2000 * (attempt + 1))
    }
  }

  async function paged(params: Record<string, string>, take: (body: any) => void): Promise<void> {
    let cont: Record<string, string> = {}
    for (;;) {
      const body = await api({ ...params, ...cont })
      take(body)
      if (!body.continue) return
      cont = body.continue
    }
  }

  return {
    requests: () => count,

    async listPages(q: WikiListQuery) {
      const out: ListedPage[] = []
      const params =
        q.list === 'categorymembers'
          ? { action: 'query', list: 'categorymembers', cmtitle: q.title, cmlimit: '500', cmtype: 'page', cmnamespace: '0' }
          : { action: 'query', list: 'embeddedin', eititle: q.title, eilimit: '500', einamespace: '0' }
      await paged(params, (b) => {
        for (const m of b.query?.[q.list] ?? []) out.push({ pageId: m.pageid, title: m.title })
      })
      return out
    },

    async recentChanges(sinceIso: string) {
      const byId = new Map<number, RecentPage>()
      const params = { action: 'query', list: 'recentchanges', rcnamespace: '0', rctype: 'new|edit', rcprop: 'title|ids', rclimit: '500', rcend: sinceIso }
      await paged(params, (b) => {
        for (const c of b.query?.recentchanges ?? []) {
          const isNew = (byId.get(c.pageid)?.isNew ?? false) || c.type === 'new'
          byId.set(c.pageid, { pageId: c.pageid, title: c.title, isNew })
        }
      })
      return [...byId.values()]
    },

    async fetchPages(pageIds: number[]) {
      const pages = new Map<number, WikiPage>()
      for (let i = 0; i < pageIds.length; i += BATCH) {
        const params = { action: 'query', prop: 'revisions|categories', rvprop: 'content|ids', rvslots: 'main', cllimit: 'max', pageids: pageIds.slice(i, i + BATCH).join('|') }
        await paged(params, (b) => {
          for (const p of b.query?.pages ?? []) {
            if (p.missing || p.invalid) continue
            const page = pages.get(p.pageid) ?? { pageId: p.pageid, title: p.title, revisionId: null, content: '', categories: [] }
            const rev = p.revisions?.[0]
            if (rev && !page.content) {
              page.content = rev.slots?.main?.content ?? ''
              page.revisionId = rev.revid ?? null
            }
            for (const c of p.categories ?? []) if (!page.categories.includes(c.title)) page.categories.push(c.title)
            pages.set(p.pageid, page)
          }
        })
      }
      return [...pages.values()]
    },

    async wikitext(title: string) {
      const b = await api({ action: 'parse', page: title, prop: 'wikitext' })
      return b.parse?.wikitext ?? ''
    },

    async imageUrls(files: string[], width: number) {
      const out = new Map<string, string>()
      for (let i = 0; i < files.length; i += BATCH) {
        const chunk = files.slice(i, i + BATCH)
        const b = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(width), titles: chunk.map((f) => `File:${f}`).join('|') })
        const back = new Map<string, string>(chunk.map((f) => [fileKey(`File:${f}`), f]))
        for (const n of b.query?.normalized ?? []) {
          const requested = back.get(fileKey(n.from))
          if (requested) back.set(fileKey(n.to), requested)
        }
        for (const p of b.query?.pages ?? []) {
          const info = p.imageinfo?.[0]
          const file = back.get(fileKey(p.title))
          if (info && file) out.set(file, info.thumburl ?? info.url)
        }
      }
      return out
    },
  }
}
```

- [ ] **Step 4: Run the test and see it pass**

Run: `pnpm vitest run src/lib/catalogue/wiki.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalogue/wiki.ts src/lib/catalogue/wiki.test.ts
git commit -m "feat(catalogue): paced MediaWiki client"
```

---

### Task 4: Steal a Brainrot parse (pure) with saved wiki pages

**Files:**
- Create:
  - `src/lib/catalogue/games/steal-a-brainrot.ts` (parse part plus the adapter shell; the DB methods are added in Task 7)
  - `src/lib/catalogue/games/__fixtures__/sab-pages.json`
- Test: `src/lib/catalogue/games/steal-a-brainrot.test.ts`

**Interfaces:**
- Consumes:
  - `templateBody`, `templateParams`, `plainText` (`src/lib/wiki/markup.ts`)
  - `buildSabFacts`, `parseObtainment`, `parseUpdateLog`, `statusOf` (`src/lib/sab/wiki-facts.ts`)
  - `slugifyTitle`
- Produces:
  - `sabRarity(raw): string | null`
  - `parseAmount(raw): number | null`
  - `parseSabPage(page, updates, checkedAt): ParsedItem | null`
  - `sabRow(item, imagePath, verifiedAt)`
  - `stealABrainrot: CatalogueAdapter`
  - `PIPELINE_MARK = 'catalogue-pipeline'`

- [ ] **Step 1: Save the fixtures (a real new brainrot, a DLC one, a gallery subpage)**

```bash
curl -s -A "DropMarketBot/1.0 (+https://dropmarket.gg)" "https://stealabrainrot.fandom.com/api.php?action=query&format=json&formatversion=2&prop=revisions|categories&rvprop=content|ids&rvslots=main&cllimit=max&titles=Slushi_Huski|Cobra_Gelato|Slushi_Huski/Gallery" \
 | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const q=JSON.parse(s).query.pages;const out=q.map(p=>({pageId:p.pageid,title:p.title,revisionId:p.revisions[0].revid,content:p.revisions[0].slots.main.content,categories:(p.categories??[]).map(c=>c.title)}));require("fs").writeFileSync("src/lib/catalogue/games/__fixtures__/sab-pages.json",JSON.stringify(out,null,2)+"\n")})'
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import pages from './__fixtures__/sab-pages.json'
import { parseAmount, parseSabPage, sabRarity, sabRow, stealABrainrot } from './steal-a-brainrot'
import type { WikiPage } from '../types'

const page = (title: string) => (pages as WikiPage[]).find((p) => p.title === title)!
const UPDATES = new Map([[40, '2026-10-18']])

describe('SAB field parsers', () => {
  it('maps infobox rarities to our labels', () => {
    expect(sabRarity('Brainrot god')).toBe('Brainrot God')
    expect(sabRarity('[[Secret]]')).toBe('Secret')
    expect(sabRarity('Celestial')).toBeNull()
  })
  it('reads K/M/B amounts', () => {
    expect(parseAmount('322.5K')).toBe(322_500)
    expect(parseAmount('$23.5B')).toBe(23_500_000_000)
    expect(parseAmount('78M')).toBe(78_000_000)
    expect(parseAmount('Unknown')).toBeNull()
  })
})

describe('parseSabPage', () => {
  it('turns a brainrot page into an item with facts, image and stats', () => {
    const item = parseSabPage(page('Slushi Huski'), UPDATES, '2026-10-21')!
    expect(item).toMatchObject({
      slug: 'slushi-huski', name: 'Slushi Huski', rarity: 'Brainrot God', imageFile: 'Slushi Huski.png',
      pageUrl: 'https://stealabrainrot.fandom.com/wiki/Slushi_Huski',
      extra: { income: 322_500, cost: 78_000_000, obtainability: 'obtainable' },
    })
    expect(item.howToGet?.method).toMatch(/MerchShop DLC|Official Merch Code/)
  })
  it('skips subpages, pages without the infobox, unknown rarities and unreleased brainrots', () => {
    expect(parseSabPage(page('Slushi Huski/Gallery'), UPDATES, '2026-10-21')).toBeNull()
    const base = page('Cobra Gelato')
    expect(parseSabPage({ ...base, content: 'no infobox' }, UPDATES, '2026-10-21')).toBeNull()
    expect(parseSabPage({ ...base, content: base.content.replace('rarity=Secret', 'rarity=Celestial') }, UPDATES, '2026-10-21')).toBeNull()
    expect(parseSabPage({ ...base, content: base.content.replace('{{Obtainment|', '{{Obtainment|Upcoming=yes|') }, UPDATES, '2026-10-21')).toBeNull()
  })
})

describe('sabRow', () => {
  it('shapes a row like the July wiki import and marks it as pipeline-added', () => {
    const item = parseSabPage(page('Cobra Gelato'), UPDATES, '2026-10-21')!
    expect(sabRow(item, 'cobra-gelato.webp', '2026-10-21T00:00:00Z')).toMatchObject({
      slug: 'cobra-gelato', name: 'Cobra Gelato', rarity: 'Secret', image_path: 'cobra-gelato.webp', image_status: 'approved',
      source_name: 'Steal a Brainrot Wiki', source_page_id: 32151, needs_review: false, is_active: true,
      source_payload: { image_file: 'Cobra Gelato.png', imported_by: 'catalogue-pipeline' },
    })
    expect(sabRow(item, null, '2026-10-21T00:00:00Z')).toMatchObject({ image_path: null, image_status: 'missing' })
  })
  it('lists every brainrot page through the infobox', () => {
    expect(stealABrainrot.listQueries).toEqual([{ list: 'embeddedin', title: 'Template:Brainrot Infobox' }])
  })
})
```

- [ ] **Step 3: Run it and see it fail**

Run: `pnpm vitest run src/lib/catalogue/games/steal-a-brainrot.test.ts`. Expected: FAIL, module missing.

- [ ] **Step 4: Write `steal-a-brainrot.ts` (parse, row and adapter; DB methods filled in by Task 7)**

```ts
/**
 * Steal a Brainrot catalogue adapter: every page on stealabrainrot.fandom.com
 * that uses the Brainrot Infobox → a sab_brainrots row shaped like the July
 * 2026 wiki import (source fields; `<slug>.webp` in the sab-brainrots bucket).
 * Facts (released, origin, How To Get) come from src/lib/sab/wiki-facts.ts,
 * the parser the value pages already use. A row without a copied image stays
 * `image_status='missing'`, which the public catalogue view hides.
 */
import { buildSabFacts, parseObtainment, parseUpdateLog, statusOf, type SabHowToGetStatus } from '../../sab/wiki-facts'
import { plainText, templateBody, templateParams } from '../../wiki/markup'
import { slugifyTitle } from '../plan'
import type { CatalogueAdapter, ParsedItem, WikiPage } from '../types'

const HOST = 'stealabrainrot.fandom.com'
const BUCKET = 'sab-brainrots'
const SOURCE_NAME = 'Steal a Brainrot Wiki'
/** source_payload.imported_by on rows this pipeline added. */
export const PIPELINE_MARK = 'catalogue-pipeline'
const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Brainrot God', 'Secret', 'OG'] as const

/** Infobox rarity → our label ("Brainrot god" → "Brainrot God"); null when unknown. */
export function sabRarity(raw: string | undefined): string | null {
  const text = plainText(raw ?? '').trim().toLowerCase()
  return RARITIES.find((r) => r.toLowerCase() === text) ?? null
}

const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, q: 1e15, qa: 1e15, qi: 1e18 }

/** "322.5K" → 322500, "$23.5B" → 23500000000; null when it isn't a plain amount. */
export function parseAmount(raw: string | undefined): number | null {
  const m = plainText(raw ?? '').replace(/[$,\s]/g, '').match(/^(\d+(?:\.\d+)?)(qa|qi|[kmbtq])?(?:\/s)?$/i)
  if (!m) return null
  return Math.round(Number(m[1]) * (m[2] ? SUFFIX[m[2].toLowerCase()] : 1))
}

const OBTAINABILITY: Record<SabHowToGetStatus, 'obtainable' | 'limited' | 'unobtainable' | 'unknown'> = {
  obtainable: 'obtainable',
  seasonal: 'limited',
  unobtainable: 'unobtainable',
  unknown: 'unknown',
}

const pageUrl = (title: string) => `https://${HOST}/wiki/${encodeURI(title.replace(/ /g, '_'))}`

/**
 * A brainrot page → its item. Null for subpages (/Gallery), pages without the
 * infobox or a known rarity, and announced-but-unreleased brainrots; the run
 * records those as ignored and looks again when the page is edited.
 */
export function parseSabPage(page: WikiPage, updates: Map<number, string>, checkedAt: string): ParsedItem | null {
  if (page.title.includes('/')) return null
  const body = templateBody(page.content, 'Brainrot Infobox')
  if (body == null) return null
  const info = templateParams(body)
  const rarity = sabRarity(info.rarity)
  if (!rarity || parseObtainment(page.content)?.upcoming) return null
  const slug = slugifyTitle(page.title)
  const url = pageUrl(page.title)
  const categories = page.categories.map((c) => c.replace(/^Category:/, ''))
  const facts = buildSabFacts({ slug, pageUrl: url, text: page.content, categories, updates, checkedAt })
  const image = plainText(info.image1 ?? info.image ?? '').replace(/^file:/i, '').trim()
  return {
    pageId: page.pageId,
    revisionId: page.revisionId,
    wikiTitle: page.title,
    pageUrl: url,
    slug,
    name: page.title,
    rarity,
    imageFile: image || null,
    releasedAt: facts.released_at,
    origin: facts.origin,
    howToGet: facts.how_to_get,
    extra: {
      income: parseAmount(info.income),
      cost: parseAmount(info.cost),
      obtainability: OBTAINABILITY[facts.how_to_get?.status ?? statusOf(info.status)],
      categories,
    },
  }
}

/** The sab_brainrots row for a new brainrot. */
export function sabRow(item: ParsedItem, imagePath: string | null, verifiedAt: string) {
  return {
    name: item.name,
    slug: item.slug,
    rarity: item.rarity,
    base_income_per_second: item.extra.income ?? null,
    ingame_cost: item.extra.cost ?? null,
    obtainability: item.extra.obtainability ?? 'unknown',
    image_path: imagePath,
    image_alt_text: `${item.name} Steal a Brainrot`,
    image_status: imagePath ? 'approved' : 'missing',
    source_name: SOURCE_NAME,
    source_url: item.pageUrl,
    source_page_id: item.pageId,
    source_revision_id: item.revisionId,
    source_payload: { source_categories: item.extra.categories ?? [], image_file: item.imageFile, imported_by: PIPELINE_MARK },
    released_at: item.releasedAt,
    origin: item.origin,
    how_to_get: item.howToGet,
    needs_review: false,
    is_active: true,
    game_data_last_verified_at: verifiedAt,
  }
}

export const stealABrainrot: CatalogueAdapter = {
  gameSlug: 'steal-a-brainrot',
  label: 'brainrots',
  wikiHost: HOST,
  listQueries: [{ list: 'embeddedin', title: 'Template:Brainrot Infobox' }],
  async prepare(wiki) {
    const updates = parseUpdateLog(await wiki.wikitext('Update_Log'))
    // Under 10 updates means the page changed shape; fail loudly rather than add brainrots without dates.
    if (updates.size < 10) throw new Error(`Update Log parsed to ${updates.size} updates, so the page changed shape`)
    return { updates }
  },
  parse: (page, ctx) => parseSabPage(page, ctx.updates as Map<number, string>, ctx.checkedAt),
  loadKnown: async () => {
    throw new Error('steal-a-brainrot loadKnown: Task 7')
  },
  insert: async () => {
    throw new Error('steal-a-brainrot insert: Task 7')
  },
}

export { BUCKET as SAB_BUCKET }
```

- [ ] **Step 5: Run the test and see it pass**

Run: `pnpm vitest run src/lib/catalogue/games/steal-a-brainrot.test.ts`. Expected: PASS.

If the How To Get assertion fails because `parseSource` names the DLC differently, read `item.howToGet` and pin the actual method string. The point of the check is that a How To Get exists.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalogue/games
git commit -m "feat(catalogue): Steal a Brainrot wiki page parser"
```

---

### Task 5: Discord text and the image copier

**Files:**
- Create: `src/lib/catalogue/notify.ts`, `src/lib/catalogue/images.ts`
- Test: `src/lib/catalogue/notify.test.ts`, `src/lib/catalogue/images.test.ts`

**Interfaces:**
- Consumes: `CatalogueGame`, `RunReport`, `WikiClient`, `ImageStore`, `Db`, `WIKI_USER_AGENT`
- Produces:
  - `runMessage(game, report, siteUrl): string | null`
  - `createImageStore({ db, wiki, fetchImpl?, sleep?, log? }): ImageStore`
  - `IMAGE_WIDTH = 512`

- [ ] **Step 1: Write the failing tests**

`notify.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { runMessage } from './notify'
import type { CatalogueGame, RunReport } from './types'

const game = { key: 'sab', name: 'Steal a Brainrot', adapter: { gameSlug: 'steal-a-brainrot', label: 'brainrots' } } as CatalogueGame
const report = (over: Partial<RunReport>): RunReport => ({
  gameSlug: 'steal-a-brainrot', status: 'ok', listed: 0, candidates: 0, adopted: 0, added: [], ignored: 0, imagesFixed: 0, parseErrors: [], message: null, wikiRequests: 0, ...over,
})

describe('runMessage', () => {
  it('lists added items as links, singular for one', () => {
    expect(runMessage(game, report({ added: [{ slug: 'slushi-huski', name: 'Slushi Huski' }] }), 'https://dropmarket.gg')).toBe(
      '🆕 **Steal a Brainrot**: 1 new brainrot added: [Slushi Huski](<https://dropmarket.gg/steal-a-brainrot/values/slushi-huski>).',
    )
  })
  it('caps the list at 12 names', () => {
    const added = Array.from({ length: 15 }, (_, i) => ({ slug: `b${i}`, name: `B${i}` }))
    expect(runMessage(game, report({ added }), 'https://x')).toMatch(/15 new brainrots added: .* and 3 more\.$/)
  })
  it('says why a blocked run stopped, and stays quiet when nothing is new', () => {
    expect(runMessage(game, report({ status: 'blocked', message: '120 new items is over the safety cap of 50' }), 'https://x')).toBe(
      '⚠️ **Steal a Brainrot** catalogue run stopped: 120 new items is over the safety cap of 50. Nothing was written.',
    )
    expect(runMessage(game, report({ status: 'nothing_new' }), 'https://x')).toBeNull()
  })
})
```

`images.test.ts`:

```ts
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { createImageStore } from './images'
import type { Db, WikiClient } from './types'

const png = () => sharp({ create: { width: 900, height: 900, channels: 3, background: '#ff0000' } }).png().toBuffer()
const wiki = (urls: Record<string, string>) => ({ imageUrls: async (files: string[]) => new Map(files.filter((f) => urls[f]).map((f) => [f, urls[f]])) }) as unknown as WikiClient
function fakeDb(fail = false) {
  const uploads: { bucket: string; path: string; bytes: Buffer; opts: any }[] = []
  const db = { storage: { from: (bucket: string) => ({ upload: async (path: string, bytes: Buffer, opts: any) => {
    uploads.push({ bucket, path, bytes, opts })
    return { error: fail ? { message: 'denied' } : null }
  } }) } } as unknown as Db
  return { db, uploads }
}
const noSleep = async () => {}

describe('createImageStore', () => {
  it('downloads the rendition, converts to a 512 px WebP and uploads it', async () => {
    const body = await png()
    const { db, uploads } = fakeDb()
    const store = createImageStore({ db, wiki: wiki({ 'A.png': 'https://img/a.png' }), sleep: noSleep, log: () => {}, fetchImpl: (async () => new Response(body)) as typeof fetch })
    expect(await store.copy('A.png', { bucket: 'sab-brainrots', path: 'a.webp' })).toBe(true)
    expect(uploads[0]).toMatchObject({ bucket: 'sab-brainrots', path: 'a.webp', opts: { contentType: 'image/webp', upsert: true } })
    const meta = await sharp(uploads[0].bytes).metadata()
    expect([meta.format, meta.width]).toEqual(['webp', 512])
  })
  it('returns false, never throws, when the file, download or upload fails', async () => {
    const quiet = { sleep: noSleep, log: () => {} }
    expect(await createImageStore({ ...quiet, db: fakeDb().db, wiki: wiki({}) }).copy('Gone.png', { bucket: 'b', path: 'p' })).toBe(false)
    const notFound = (async () => new Response('', { status: 404 })) as typeof fetch
    expect(await createImageStore({ ...quiet, db: fakeDb().db, wiki: wiki({ 'A.png': 'https://img/a' }), fetchImpl: notFound }).copy('A.png', { bucket: 'b', path: 'p' })).toBe(false)
    const body = await png()
    const ok = (async () => new Response(body)) as typeof fetch
    expect(await createImageStore({ ...quiet, db: fakeDb(true).db, wiki: wiki({ 'A.png': 'https://img/a' }), fetchImpl: ok }).copy('A.png', { bucket: 'b', path: 'p' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run src/lib/catalogue/notify.test.ts src/lib/catalogue/images.test.ts`. Expected: FAIL, modules missing.

- [ ] **Step 3: Write `notify.ts`**

```ts
/**
 * The Discord post for a catalogue run. Only two runs speak: one that added
 * items (owner wants to see them) and one that stopped itself (someone must
 * look). Failures are posted by the workflow's failure step, which also
 * covers crashes and timeouts this code never sees.
 */
import type { CatalogueGame, RunReport } from './types'

const MAX_NAMES = 12

export function runMessage(game: CatalogueGame, report: RunReport, siteUrl: string): string | null {
  const title = `**${game.name}**`
  if (report.status === 'blocked') return `⚠️ ${title} catalogue run stopped: ${report.message}. Nothing was written.`
  const n = report.added.length
  if (!n) return null
  // <url> stops Discord from unfurling a preview card per link.
  const links = report.added.slice(0, MAX_NAMES).map((a) => `[${a.name}](<${siteUrl}/${game.adapter.gameSlug}/values/${a.slug}>)`)
  const more = n > MAX_NAMES ? ` and ${n - MAX_NAMES} more` : ''
  const noun = n === 1 ? game.adapter.label.replace(/s$/, '') : game.adapter.label
  return `🆕 ${title}: ${n} new ${noun} added: ${links.join(', ')}${more}.`
}
```

- [ ] **Step 4: Write `images.ts`**

```ts
/**
 * Copies a wiki image into our storage: the file's 512 px rendition from the
 * wiki's CDN → WebP (sharp) → the game's bucket. Never throws; a failed copy
 * returns false and the item is inserted without an image (hidden until a later
 * run's fixMissingImages succeeds).
 */
import sharp from 'sharp'
import { WIKI_USER_AGENT } from './wiki'
import type { Db, ImageStore, ImageTarget, WikiClient } from './types'

export const IMAGE_WIDTH = 512

export function createImageStore(options: {
  db: Db
  wiki: WikiClient
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  log?: (message: string) => void
}): ImageStore {
  const doFetch = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const log = options.log ?? console.warn
  return {
    async copy(file: string, target: ImageTarget) {
      try {
        const url = (await options.wiki.imageUrls([file], IMAGE_WIDTH)).get(file)
        if (!url) {
          log(`image: the wiki has no file "${file}"`)
          return false
        }
        await sleep(500) // the CDN is not the API, but stay polite
        const res = await doFetch(url, { headers: { 'User-Agent': WIKI_USER_AGENT }, signal: AbortSignal.timeout(30_000) })
        if (!res.ok) {
          log(`image: ${file} answered HTTP ${res.status}`)
          return false
        }
        const webp = await sharp(Buffer.from(await res.arrayBuffer()))
          .resize({ width: IMAGE_WIDTH, withoutEnlargement: true })
          .webp({ quality: 86 })
          .toBuffer()
        const { error } = await options.db.storage
          .from(target.bucket)
          .upload(target.path, webp, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' })
        if (error) {
          log(`image: upload ${target.bucket}/${target.path} failed: ${error.message}`)
          return false
        }
        return true
      } catch (e) {
        log(`image: ${file} failed: ${(e as Error).message}`)
        return false
      }
    },
  }
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `pnpm vitest run src/lib/catalogue/notify.test.ts src/lib/catalogue/images.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalogue/notify.ts src/lib/catalogue/notify.test.ts src/lib/catalogue/images.ts src/lib/catalogue/images.test.ts
git commit -m "feat(catalogue): Discord run text + wiki image copier"
```

---

### Task 6: Store and orchestrator

**Files:**
- Create: `src/lib/catalogue/store.ts`, `src/lib/catalogue/run.ts`
- Test: `src/lib/catalogue/run.test.ts`

**Interfaces:**
- Consumes: plan.ts, notify.ts, types.ts
- Produces:
  - `loadRefs`, `saveRefs`, `recordRun`, `pruneRuns`
  - `type CatalogueStore`, `dbStore`, `type RefWrite`
  - `runCatalogue(game, deps: RunDeps, opts: RunOptions): Promise<RunReport>`

- [ ] **Step 1: Write `store.ts`**

```ts
/**
 * catalogue_refs + catalogue_runs (service role). Kept apart from run.ts so
 * the orchestrator's tests swap in an in-memory store.
 */
import type { CatalogueRef, Db, RunReport } from './types'

const PAGE = 1000
export const RUN_RETENTION_DAYS = 180

export async function loadRefs(db: Db, gameSlug: string): Promise<Map<number, CatalogueRef>> {
  const out = new Map<number, CatalogueRef>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('catalogue_refs')
      .select('page_id,wiki_title,item_slug,status,first_seen_at,checked_at')
      .eq('game_slug', gameSlug)
      .order('page_id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`catalogue_refs: ${error.message}`)
    for (const r of data ?? []) {
      out.set(Number(r.page_id), {
        pageId: Number(r.page_id),
        wikiTitle: r.wiki_title,
        itemSlug: r.item_slug,
        status: r.status,
        firstSeenAt: r.first_seen_at,
        checkedAt: r.checked_at,
      })
    }
    if (!data || data.length < PAGE) return out
  }
}

export interface RefWrite {
  pageId: number
  wikiTitle: string
  itemSlug: string | null
  status: 'item' | 'ignored'
}

/** first_seen_at is never sent, so it keeps its insert-time default on update. */
export async function saveRefs(db: Db, gameSlug: string, refs: RefWrite[], now: Date): Promise<void> {
  const rows = refs.map((r) => ({
    game_slug: gameSlug,
    page_id: r.pageId,
    wiki_title: r.wikiTitle,
    item_slug: r.itemSlug,
    status: r.status,
    checked_at: now.toISOString(),
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('catalogue_refs').upsert(rows.slice(i, i + 500), { onConflict: 'game_slug,page_id' })
    if (error) throw new Error(`catalogue_refs upsert: ${error.message}`)
  }
}

export interface RunRow {
  report: RunReport
  startedAt: Date
  finishedAt: Date
  trigger: 'schedule' | 'manual'
}

export async function recordRun(db: Db, row: RunRow): Promise<void> {
  const r = row.report
  const { error } = await db.from('catalogue_runs').insert({
    game_slug: r.gameSlug,
    started_at: row.startedAt.toISOString(),
    finished_at: row.finishedAt.toISOString(),
    trigger: row.trigger,
    status: r.status,
    listed: r.listed,
    candidates: r.candidates,
    adopted: r.adopted,
    added_slugs: r.added.map((a) => a.slug),
    ignored: r.ignored,
    images_fixed: r.imagesFixed,
    message: r.message,
    details: { parse_errors: r.parseErrors.slice(0, 20), wiki_requests: r.wikiRequests },
  })
  if (error) throw new Error(`catalogue_runs insert: ${error.message}`)
}

export async function pruneRuns(db: Db, now: Date): Promise<void> {
  const before = new Date(now.getTime() - RUN_RETENTION_DAYS * 86_400_000).toISOString()
  const { error } = await db.from('catalogue_runs').delete().lt('started_at', before)
  if (error) throw new Error(`catalogue_runs prune: ${error.message}`)
}

export interface CatalogueStore {
  loadRefs: typeof loadRefs
  saveRefs: typeof saveRefs
  recordRun: typeof recordRun
  pruneRuns: typeof pruneRuns
}

export const dbStore: CatalogueStore = { loadRefs, saveRefs, recordRun, pruneRuns }
```

- [ ] **Step 2: Write the failing `run.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { runCatalogue, type RunDeps } from './run'
import type { CatalogueStore, RefWrite, RunRow } from './store'
import type { CatalogueAdapter, CatalogueGame, CatalogueRef, Db, KnownItem, ParsedItem, WikiClient, WikiPage } from './types'

const NOW = new Date('2026-10-21T12:00:00Z')
const db = {} as Db

function memStore(refs: CatalogueRef[] = []) {
  const map = new Map(refs.map((r) => [r.pageId, r]))
  const runs: RunRow[] = []
  const store: CatalogueStore = {
    loadRefs: async () => new Map(map),
    saveRefs: async (_db, _g, rows: RefWrite[], now) => {
      for (const r of rows) map.set(r.pageId, { ...r, firstSeenAt: map.get(r.pageId)?.firstSeenAt ?? now.toISOString(), checkedAt: now.toISOString() })
    },
    recordRun: async (_db, row) => void runs.push(row),
    pruneRuns: async () => {},
  }
  return { store, map, runs }
}

const pages: WikiPage[] = [
  { pageId: 1, title: 'Tralalero Tralala', revisionId: 1, content: 'item', categories: [] },
  { pageId: 2, title: 'Slushi Huski', revisionId: 1, content: 'item', categories: [] },
  { pageId: 3, title: 'Slushi Huski/Gallery', revisionId: 1, content: 'gallery', categories: [] },
]
function fakeWiki(list = pages): WikiClient {
  let n = 0
  return {
    listPages: async () => (n++, list.map((p) => ({ pageId: p.pageId, title: p.title }))),
    recentChanges: async () => (n++, []),
    fetchPages: async (ids) => (n++, list.filter((p) => ids.includes(p.pageId))),
    wikitext: async () => '',
    imageUrls: async () => new Map(),
    requests: () => n,
  }
}
function fakeAdapter(over: Partial<CatalogueAdapter> = {}) {
  const inserted: ParsedItem[][] = []
  const adapter: CatalogueAdapter = {
    gameSlug: 'steal-a-brainrot',
    label: 'brainrots',
    wikiHost: 'w.test',
    listQueries: [{ list: 'embeddedin', title: 'Template:X' }],
    parse: (p) =>
      p.content === 'item'
        ? { pageId: p.pageId, revisionId: 1, wikiTitle: p.title, pageUrl: 'u', slug: p.title.toLowerCase().replace(/ /g, '-'), name: p.title, rarity: 'Secret', imageFile: null, releasedAt: null, origin: null, howToGet: null, extra: {} }
        : null,
    loadKnown: async (): Promise<KnownItem[]> => [{ slug: 'tralalero-tralala', name: 'Tralalero Tralala', pageId: null }],
    insert: async (_db, items) => (inserted.push(items), items.map((i) => i.slug)),
    ...over,
  }
  return { adapter, inserted }
}
const game = (adapter: CatalogueAdapter): CatalogueGame => ({ key: 'sab', name: 'Steal a Brainrot', adapter })
const opts = { write: true, allowLarge: false, trigger: 'schedule' as const, siteUrl: 'https://dropmarket.test' }
function deps(store: CatalogueStore, extra: Partial<RunDeps> = {}): RunDeps {
  return { db, wiki: fakeWiki(), images: { copy: async () => true }, revalidate: vi.fn(async () => {}), notify: vi.fn(async () => true), store, now: () => NOW, log: () => {}, ...extra }
}

describe('runCatalogue', () => {
  it('first run: adopts what we hold, inserts the new item, ignores the gallery, refreshes and announces', async () => {
    const { store, map, runs } = memStore()
    const { adapter, inserted } = fakeAdapter()
    const d = deps(store)
    const report = await runCatalogue(game(adapter), d, opts)
    expect(report).toMatchObject({ status: 'ok', listed: 3, candidates: 3, adopted: 1, ignored: 1, added: [{ slug: 'slushi-huski', name: 'Slushi Huski' }] })
    expect(inserted).toHaveLength(1)
    expect([...map.values()].map((r) => [r.pageId, r.status, r.itemSlug])).toEqual([
      [1, 'item', 'tralalero-tralala'],
      [2, 'item', 'slushi-huski'],
      [3, 'ignored', null],
    ])
    expect(d.revalidate).toHaveBeenCalledWith('steal-a-brainrot', ['slushi-huski'])
    expect(d.notify).toHaveBeenCalledWith(expect.stringContaining('[Slushi Huski]'))
    expect(runs.map((r) => r.report.status)).toEqual(['ok'])
  })

  it('second run reads nothing, writes nothing new and stays quiet', async () => {
    const { store, runs } = memStore()
    const { adapter, inserted } = fakeAdapter()
    await runCatalogue(game(adapter), deps(store), opts)
    const d = deps(store)
    const report = await runCatalogue(game(adapter), d, opts)
    expect(report).toMatchObject({ status: 'nothing_new', candidates: 0, added: [] })
    expect(inserted).toHaveLength(1)
    expect(d.notify).not.toHaveBeenCalled()
    expect(d.revalidate).not.toHaveBeenCalled()
    expect(runs.map((r) => r.report.status)).toEqual(['ok', 'nothing_new'])
  })

  it('a dry run plans but writes, records and announces nothing', async () => {
    const { store, map, runs } = memStore()
    const { adapter, inserted } = fakeAdapter()
    const d = deps(store)
    const report = await runCatalogue(game(adapter), d, { ...opts, write: false })
    expect(report.added).toEqual([{ slug: 'slushi-huski', name: 'Slushi Huski' }])
    expect([inserted.length, map.size, runs.length]).toEqual([0, 0, 0])
    expect(d.notify).not.toHaveBeenCalled()
  })

  it('stops over the cap: records a blocked run, alerts, inserts nothing', async () => {
    const { store, map, runs } = memStore()
    const { adapter, inserted } = fakeAdapter({ insertCap: 0 })
    const d = deps(store)
    const report = await runCatalogue(game(adapter), d, opts)
    expect(report.status).toBe('blocked')
    expect([inserted.length, map.size]).toEqual([0, 0])
    expect(runs[0].report.status).toBe('blocked')
    expect(d.notify).toHaveBeenCalledWith(expect.stringContaining('stopped'))
  })

  it('stops when parsing breaks on many pages (wiki format change)', async () => {
    const { store } = memStore()
    const many = Array.from({ length: 10 }, (_, i) => ({ pageId: i + 1, title: `P${i}`, revisionId: 1, content: 'x', categories: [] }))
    const { adapter, inserted } = fakeAdapter({ parse: () => { throw new Error('boom') } })
    const report = await runCatalogue(game(adapter), deps(store, { wiki: fakeWiki(many) }), opts)
    expect(report).toMatchObject({ status: 'blocked' })
    expect(report.parseErrors).toHaveLength(10)
    expect(inserted).toHaveLength(0)
  })

  it('records a failed run and rethrows so the workflow alerts', async () => {
    const { store, runs } = memStore()
    const { adapter } = fakeAdapter({ insert: async () => { throw new Error('sab_brainrots insert: denied') } })
    await expect(runCatalogue(game(adapter), deps(store), opts)).rejects.toThrow(/denied/)
    expect(runs[0].report).toMatchObject({ status: 'failed', message: 'sab_brainrots insert: denied' })
  })

  it('revalidates rows whose missing image was fixed, too', async () => {
    const { store } = memStore()
    const { adapter } = fakeAdapter({ fixMissingImages: async () => ['old-brainrot'] })
    const d = deps(store)
    const report = await runCatalogue(game(adapter), d, opts)
    expect(report.imagesFixed).toBe(1)
    expect(d.revalidate).toHaveBeenCalledWith('steal-a-brainrot', ['slushi-huski', 'old-brainrot'])
  })
})
```

- [ ] **Step 3: Run it and see it fail**

Run: `pnpm vitest run src/lib/catalogue/run.test.ts`. Expected: FAIL, `./run` missing.

- [ ] **Step 4: Write `run.ts`**

```ts
/**
 * One catalogue run for one game: list the wiki's item pages → read only the
 * pages we never decided about → parse → adopt / insert / ignore → guards →
 * insert-only write → refs → images → refresh → run row + Discord.
 * Every dependency is injected (run.test.ts runs it on fakes); the CLI wires
 * the real ones (scripts/catalogue.mjs).
 */
import { runMessage } from './notify'
import { candidatePages, DEFAULT_INSERT_CAP, guardRun, planCatalogue, RECENT_WINDOW_DAYS, type ParsedPage } from './plan'
import { dbStore, type CatalogueStore, type RefWrite } from './store'
import type { CatalogueGame, Db, ImageStore, RunReport, WikiClient } from './types'

export interface RunDeps {
  db: Db
  wiki: WikiClient
  images: ImageStore
  /** POSTs changed slugs to values-revalidate; null skips it (local runs). */
  revalidate: ((gameSlug: string, slugs: string[]) => Promise<void>) | null
  notify: (text: string) => Promise<boolean>
  store?: CatalogueStore
  now?: () => Date
  log?: (message: string) => void
}

export interface RunOptions {
  write: boolean
  /** Lifts the insert cap: manual first runs and big backlogs only. */
  allowLarge: boolean
  trigger: 'schedule' | 'manual'
  siteUrl: string
}

export async function runCatalogue(game: CatalogueGame, deps: RunDeps, opts: RunOptions): Promise<RunReport> {
  const { adapter } = game
  const store = deps.store ?? dbStore
  const now = deps.now ?? (() => new Date())
  const log = deps.log ?? console.log
  const startedAt = now()
  const report: RunReport = {
    gameSlug: adapter.gameSlug, status: 'nothing_new', listed: 0, candidates: 0, adopted: 0,
    added: [], ignored: 0, imagesFixed: 0, parseErrors: [], message: null, wikiRequests: 0,
  }

  const finish = async (): Promise<RunReport> => {
    report.wikiRequests = deps.wiki.requests()
    if (!opts.write) return report
    await store.recordRun(deps.db, { report, startedAt, finishedAt: now(), trigger: opts.trigger })
    await store.pruneRuns(deps.db, startedAt)
    const text = runMessage(game, report, opts.siteUrl)
    if (text) await deps.notify(text)
    return report
  }

  try {
    const listed = new Map<number, { pageId: number; title: string }>()
    for (const q of adapter.listQueries) for (const p of await deps.wiki.listPages(q)) listed.set(p.pageId, p)
    report.listed = listed.size
    const since = new Date(startedAt.getTime() - RECENT_WINDOW_DAYS * 86_400_000).toISOString()
    const recent = await deps.wiki.recentChanges(since)
    const refs = await store.loadRefs(deps.db, adapter.gameSlug)
    const candidates = candidatePages({ listed: [...listed.values()], recent, refs, now: startedAt })
    report.candidates = candidates.length
    log(`${game.name}: ${listed.size} listed, ${recent.length} changed recently, ${refs.size} decided → ${candidates.length} to read`)

    const refWrites: RefWrite[] = []
    if (candidates.length) {
      const ctx = { checkedAt: startedAt.toISOString().slice(0, 10), ...(adapter.prepare ? await adapter.prepare(deps.wiki) : {}) }
      const parsed: ParsedPage[] = []
      for (const page of await deps.wiki.fetchPages(candidates.map((c) => c.pageId))) {
        try {
          parsed.push({ pageId: page.pageId, title: page.title, item: adapter.parse(page, ctx) })
        } catch (e) {
          report.parseErrors.push(`${page.title}: ${(e as Error).message}`)
        }
      }
      const plan = planCatalogue(parsed, await adapter.loadKnown(deps.db))
      report.adopted = plan.adopt.length
      report.ignored = plan.ignore.length
      report.added = plan.insert.map((i) => ({ slug: i.slug, name: i.name }))
      const verdict = guardRun({
        candidates: candidates.length, parseErrors: report.parseErrors.length, toInsert: plan.insert.length,
        cap: adapter.insertCap ?? DEFAULT_INSERT_CAP, allowLarge: opts.allowLarge,
      })
      if (!verdict.ok) {
        report.status = 'blocked'
        report.message = verdict.reason
        return await finish()
      }
      if (!opts.write) {
        report.status = plan.insert.length ? 'ok' : 'nothing_new'
        return await finish()
      }
      const inserted = new Set(plan.insert.length ? await adapter.insert(deps.db, plan.insert, deps.images) : [])
      report.added = report.added.filter((a) => inserted.has(a.slug))
      refWrites.push(
        ...plan.adopt.map((a) => ({ pageId: a.pageId, wikiTitle: a.title, itemSlug: a.slug, status: 'item' as const })),
        // A slug that already existed (insert conflict) is still an item we hold.
        ...plan.insert.map((i) => ({ pageId: i.pageId, wikiTitle: i.wikiTitle, itemSlug: i.slug, status: 'item' as const })),
        ...plan.ignore.map((g) => ({ pageId: g.pageId, wikiTitle: g.title, itemSlug: null, status: 'ignored' as const })),
      )
    }
    if (!opts.write) return await finish()
    if (refWrites.length) await store.saveRefs(deps.db, adapter.gameSlug, refWrites, startedAt)
    const fixed = adapter.fixMissingImages ? await adapter.fixMissingImages(deps.db, deps.images) : []
    report.imagesFixed = fixed.length
    const changed = [...report.added.map((a) => a.slug), ...fixed]
    if (changed.length && deps.revalidate) await deps.revalidate(adapter.gameSlug, changed)
    report.status = report.added.length ? 'ok' : 'nothing_new'
    return await finish()
  } catch (e) {
    report.status = 'failed'
    report.message = (e as Error).message
    report.wikiRequests = deps.wiki.requests()
    if (opts.write) await store.recordRun(deps.db, { report, startedAt, finishedAt: now(), trigger: opts.trigger }).catch(() => {})
    throw e
  }
}
```

- [ ] **Step 5: Run the test and see it pass**

Run: `pnpm vitest run src/lib/catalogue/run.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalogue/store.ts src/lib/catalogue/run.ts src/lib/catalogue/run.test.ts
git commit -m "feat(catalogue): run orchestrator + refs/runs store"
```

---

### Task 7: SAB database methods + store integration test (local stack)

**Files:**
- Modify: `src/lib/catalogue/games/steal-a-brainrot.ts` (replace the `loadKnown` / `insert` stubs; add `fixMissingImages`)
- Test: `src/test/guards/catalogue-store.guard.integration.test.ts`

**Interfaces:**
- Consumes: `sabRow`, `PIPELINE_MARK`, `SAB_BUCKET`, store.ts
- Produces: the full `stealABrainrot` adapter

- [ ] **Step 1: Write the failing integration test**

```ts
/**
 * Catalogue pipeline against the local stack: refs/runs round-trips and the
 * SAB adapter's insert-only writes. Rows use this file's fixture namespace
 * (guard-test-<key>…) and are all removed in afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL as SUPABASE_URL, SVC } from './throwaway'
import { fixtureNamespace } from './fixture-namespace'
import { loadRefs, pruneRuns, recordRun, saveRefs } from '@/lib/catalogue/store'
import { PIPELINE_MARK, stealABrainrot } from '@/lib/catalogue/games/steal-a-brainrot'
import type { ParsedItem } from '@/lib/catalogue/types'

const ns = fixtureNamespace()
const GAME = `guard-test-${ns.tag}`
const slug = (s: string) => `guard-test-${ns.tag}-${s}`
let svc: SupabaseClient

const item = (s: string, imageFile: string | null = 'X.png'): ParsedItem => ({
  pageId: 990_000 + s.length, revisionId: 1, wikiTitle: slug(s), pageUrl: 'https://stealabrainrot.fandom.com/wiki/X',
  slug: slug(s), name: slug(s), rarity: 'Secret', imageFile, releasedAt: '2026-10-18', origin: 'Red Carpet', howToGet: null,
  extra: { income: 1000, cost: 5000, obtainability: 'obtainable', categories: [] },
})

describe.skipIf(!hasEnv)('catalogue pipeline: store + SAB adapter (guard)', () => {
  beforeAll(() => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
  })
  afterAll(async () => {
    await svc.from('catalogue_refs').delete().like('game_slug', `guard-test-${ns.key}%`)
    await svc.from('catalogue_runs').delete().like('game_slug', `guard-test-${ns.key}%`)
    await svc.from('sab_brainrots').delete().like('slug', `guard-test-${ns.key}%`)
    const left = await svc.from('sab_brainrots').select('slug').like('slug', `guard-test-${ns.key}%`)
    expect(left.data).toEqual([])
  })

  it('saves refs and keeps first_seen_at when a ref is updated', async () => {
    await saveRefs(svc, GAME, [{ pageId: 1, wikiTitle: 'A', itemSlug: null, status: 'ignored' }], new Date('2026-10-01T00:00:00Z'))
    const first = (await loadRefs(svc, GAME)).get(1)!
    await saveRefs(svc, GAME, [{ pageId: 1, wikiTitle: 'A', itemSlug: 'a', status: 'item' }], new Date('2026-10-21T00:00:00Z'))
    const again = (await loadRefs(svc, GAME)).get(1)!
    expect(again).toMatchObject({ status: 'item', itemSlug: 'a', firstSeenAt: first.firstSeenAt })
    expect(Date.parse(again.checkedAt)).toBe(Date.parse('2026-10-21T00:00:00Z'))
  })

  it('records runs and prunes old ones', async () => {
    const report = { gameSlug: GAME, status: 'ok' as const, listed: 3, candidates: 2, adopted: 1, added: [{ slug: 'x', name: 'X' }], ignored: 1, imagesFixed: 0, parseErrors: [], message: null, wikiRequests: 4 }
    await recordRun(svc, { report, startedAt: new Date('2025-01-01T00:00:00Z'), finishedAt: new Date('2025-01-01T00:01:00Z'), trigger: 'manual' })
    await recordRun(svc, { report, startedAt: new Date(), finishedAt: new Date(), trigger: 'schedule' })
    await pruneRuns(svc, new Date())
    const { data } = await svc.from('catalogue_runs').select('trigger,added_slugs,details').eq('game_slug', GAME)
    expect(data).toEqual([{ trigger: 'schedule', added_slugs: ['x'], details: { parse_errors: [], wiki_requests: 4 } }])
  })

  it('inserts only new brainrots, never rewrites an existing one, and returns what it inserted', async () => {
    const images = { copy: async (file: string) => file === 'X.png' }
    expect(await stealABrainrot.insert(svc, [item('a'), item('bb', null)], images)).toEqual([slug('a'), slug('bb')])
    await svc.from('sab_brainrots').update({ rarity: 'OG' }).eq('slug', slug('a'))
    expect(await stealABrainrot.insert(svc, [item('a')], images)).toEqual([])
    const { data } = await svc.from('sab_brainrots').select('slug,rarity,image_status,image_path,needs_review,source_payload').like('slug', `guard-test-${ns.key}%`).order('slug')
    expect(data).toMatchObject([
      { slug: slug('a'), rarity: 'OG', image_status: 'approved', image_path: `${slug('a')}.webp`, needs_review: false },
      { slug: slug('bb'), image_status: 'missing', image_path: null, source_payload: { imported_by: PIPELINE_MARK } },
    ])
    const known = await stealABrainrot.loadKnown(svc)
    expect(known.find((k) => k.slug === slug('a'))).toMatchObject({ pageId: 990_001 })
  })

  it('fixes a missing image on a pipeline-added row once the copy works', async () => {
    await svc.from('sab_brainrots').update({ source_payload: { imported_by: PIPELINE_MARK, image_file: 'Y.png' } }).eq('slug', slug('bb'))
    const fixed = await stealABrainrot.fixMissingImages!(svc, { copy: async () => true })
    expect(fixed).toContain(slug('bb'))
    const { data } = await svc.from('sab_brainrots').select('image_status,image_path').eq('slug', slug('bb')).single()
    expect(data).toEqual({ image_status: 'approved', image_path: `${slug('bb')}.webp` })
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm vitest run src/test/guards/catalogue-store.guard.integration.test.ts`
Expected: FAIL in the insert test ("steal-a-brainrot insert: Task 7"). The store tests pass.

- [ ] **Step 3: Replace the SAB stubs**

Replace the `loadKnown` / `insert` stubs in `stealABrainrot` with the code below, and add `fixMissingImages`:

```ts
  async loadKnown(db) {
    const out: KnownItem[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('sab_brainrots').select('slug,name,source_page_id').order('slug').range(from, from + 999)
      if (error) throw new Error(`sab_brainrots: ${error.message}`)
      for (const r of data ?? []) out.push({ slug: r.slug, name: r.name, pageId: r.source_page_id == null ? null : Number(r.source_page_id) })
      if (!data || data.length < 1000) return out
    }
  },
  async insert(db, items, images) {
    const verifiedAt = new Date().toISOString()
    const rows = []
    for (const item of items) {
      const path = `${item.slug}.webp`
      const copied = item.imageFile ? await images.copy(item.imageFile, { bucket: BUCKET, path }) : false
      rows.push(sabRow(item, copied ? path : null, verifiedAt))
    }
    // ON CONFLICT (slug) DO NOTHING: an existing brainrot is never rewritten, and only inserted rows come back.
    const { data, error } = await db.from('sab_brainrots').upsert(rows, { onConflict: 'slug', ignoreDuplicates: true }).select('slug')
    if (error) throw new Error(`sab_brainrots insert: ${error.message}`)
    return (data ?? []).map((r) => r.slug as string)
  },
  async fixMissingImages(db, images) {
    const { data, error } = await db
      .from('sab_brainrots')
      .select('id,slug,source_payload')
      .eq('image_status', 'missing')
      .eq('source_payload->>imported_by', PIPELINE_MARK)
      .limit(25)
    if (error) throw new Error(`sab_brainrots missing images: ${error.message}`)
    const fixed: string[] = []
    for (const row of data ?? []) {
      const file = (row.source_payload as { image_file?: string | null } | null)?.image_file
      const path = `${row.slug}.webp`
      if (!file || !(await images.copy(file, { bucket: BUCKET, path }))) continue
      const { error: upErr } = await db.from('sab_brainrots').update({ image_path: path, image_status: 'approved' }).eq('id', row.id)
      if (upErr) throw new Error(`sab_brainrots image ${row.slug}: ${upErr.message}`)
      fixed.push(row.slug)
    }
    return fixed
  },
```

Also add `KnownItem` to the type import line.

- [ ] **Step 4: Run the integration test and the SAB unit test**

Run: `pnpm vitest run src/test/guards/catalogue-store.guard.integration.test.ts src/lib/catalogue/games/steal-a-brainrot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalogue/games/steal-a-brainrot.ts src/test/guards/catalogue-store.guard.integration.test.ts
git commit -m "feat(catalogue): SAB insert-only writes + image retry, integration-tested"
```

---

### Task 8: Registry, CLI, workflow, guard test, docs

**Files:**
- Create:
  - `src/lib/catalogue/registry.ts`
  - `scripts/catalogue.mjs`
  - `.github/workflows/values-catalogue-daily.yml`
  - `src/test/guards/values-catalogue-workflow.guard.test.ts`
- Modify:
  - `package.json` (script `"catalogue": "tsx scripts/catalogue.mjs"`, next to `"values:images"`)
  - `CLAUDE.md` (new short section)

**Interfaces:**
- Consumes: everything above; `postOpsAlert` (`src/lib/ops/discord-alert.ts`), `httpRevalidator` (`src/lib/pricing/publish.ts`), `valuesDbClient` (`scripts/lib/values-db.mjs`)
- Produces:
  - `CATALOGUE_GAMES`
  - `findCatalogueGame(key)`
  - CLI `pnpm catalogue --game=<key> [--write] [--env=local|prod --yes] [--allow-large] [--only=<key>] [--trigger=schedule]`

- [ ] **Step 1: Write the failing guard test**

```ts
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOGUE_GAMES } from '@/lib/catalogue/registry'

const yml = readFileSync('.github/workflows/values-catalogue-daily.yml', 'utf8')

describe('values catalogue workflow (guard)', () => {
  it('runs one matrix job per registered game', () => {
    const keys = yml.match(/^\s*game: \[([^\]]*)\]/m)?.[1].split(',').map((s) => s.trim()).filter(Boolean) ?? []
    expect(keys.sort()).toEqual(CATALOGUE_GAMES.map((g) => g.key).sort())
  })
  it('keeps games isolated and alerts when a job fails or times out', () => {
    expect(yml).toMatch(/fail-fast: false/)
    expect(yml).toMatch(/if: \$\{\{ failure\(\) \|\| cancelled\(\) \}\}/)
    expect(yml).toMatch(/DISCORD_OPS_WEBHOOK_URL/)
  })
  it('every game adapter has its own parse test', () => {
    for (const g of CATALOGUE_GAMES) expect(existsSync(`src/lib/catalogue/games/${g.adapter.gameSlug}.test.ts`), g.key).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm vitest run src/test/guards/values-catalogue-workflow.guard.test.ts`. Expected: FAIL (no registry, no workflow).

- [ ] **Step 3: Write `registry.ts`**

```ts
/**
 * Every game the daily catalogue job runs. Adding a game = an adapter in
 * games/, its parse test, one line here, and its key in the workflow matrix
 * (.github/workflows/values-catalogue-daily.yml, pinned by a guard test).
 */
import { stealABrainrot } from './games/steal-a-brainrot'
import type { CatalogueGame } from './types'

export const CATALOGUE_GAMES: readonly CatalogueGame[] = [
  { key: 'sab', name: 'Steal a Brainrot', adapter: stealABrainrot },
]

export function findCatalogueGame(key: string): CatalogueGame {
  const game = CATALOGUE_GAMES.find((g) => g.key === key)
  if (!game) throw new Error(`unknown catalogue game "${key}" (known: ${CATALOGUE_GAMES.map((g) => g.key).join(', ')})`)
  return game
}
```

- [ ] **Step 4: Write `scripts/catalogue.mjs`**

```js
#!/usr/bin/env node
/**
 * Values catalogue: add newly released items from each game's Fandom wiki
 * (src/lib/catalogue/; spec docs/superpowers/specs/2026-10-21-values-catalogue-pipeline-design.md).
 *
 *   pnpm catalogue --game=sab --env=local                  # dry run, local stack
 *   pnpm catalogue --game=sab --env=prod --yes             # dry run against prod (reads only)
 *   pnpm catalogue --game=sab --write --env=prod --yes     # owner only
 *   pnpm catalogue --game=sab --write --env=prod --yes --allow-large   # first run / big backlog
 *   (GitHub) pnpm catalogue --game=sab --write --trigger=schedule
 *
 * Insert-only: existing rows are never changed. A run that would add more than
 * the game's cap, or cannot parse the wiki, stops and posts to Discord instead.
 * Exit 1 only on a failure (the workflow's failure step then alerts).
 */
import fs from 'node:fs'
import process from 'node:process'
import { findCatalogueGame } from '../src/lib/catalogue/registry.ts'
import { createWikiClient } from '../src/lib/catalogue/wiki.ts'
import { createImageStore } from '../src/lib/catalogue/images.ts'
import { runCatalogue } from '../src/lib/catalogue/run.ts'
import { postOpsAlert } from '../src/lib/ops/discord-alert.ts'
import { httpRevalidator } from '../src/lib/pricing/publish.ts'
import { valuesDbClient } from './lib/values-db.mjs'

const argv = process.argv.slice(2)
const val = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
const flag = (name) => argv.includes(`--${name}`)

function print(game, r, write) {
  const lines = [
    `### ${game.name} catalogue: ${r.status}${write ? '' : ' (dry run)'}`,
    `listed ${r.listed} · read ${r.candidates} · already ours ${r.adopted} · not items ${r.ignored} · images fixed ${r.imagesFixed} · wiki requests ${r.wikiRequests}`,
    r.message ? `**${r.message}**` : null,
    r.added.length ? `${write && r.status === 'ok' ? 'Added' : 'Would add'} ${r.added.length}: ${r.added.map((a) => a.name).join(', ')}` : 'Nothing new.',
    r.parseErrors.length ? `Parse errors: ${r.parseErrors.slice(0, 10).join('; ')}` : null,
  ].filter(Boolean)
  console.log(lines.join('\n'))
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n\n')}\n`)
}

async function main() {
  const key = val('game')
  if (!key) throw new Error('--game=<key> is required')
  const only = val('only')
  if (only && only !== key) return console.log(`skipped (--only=${only})`)
  const game = findCatalogueGame(key)
  const write = flag('write')
  const { db, url } = valuesDbClient({ env: val('env') ?? undefined, yes: flag('yes') })
  const isProd = !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(url)
  const siteUrl = process.env.PUBLIC_API_URL || 'https://dropmarket.gg'
  const secret = process.env.VALUES_REVALIDATE_SECRET
  const revalidator = write && isProd && secret ? httpRevalidator({ baseUrl: siteUrl, secret }) : null
  console.log(`${write ? 'Writing to' : 'Dry run against'} ${url}${write && !revalidator ? ' (pages will not be refreshed)' : ''}`)

  const wiki = createWikiClient({ host: game.adapter.wikiHost })
  const report = await runCatalogue(
    game,
    {
      db,
      wiki,
      images: createImageStore({ db, wiki }),
      revalidate: revalidator ? (gameSlug, changedSlugs) => revalidator({ gameSlug, changedSlugs }) : null,
      notify: (text) => (isProd ? postOpsAlert(text) : Promise.resolve(false)),
    },
    { write, allowLarge: flag('allow-large'), trigger: val('trigger') === 'schedule' ? 'schedule' : 'manual', siteUrl },
  )
  print(game, report, write)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
```

Add to `package.json` scripts, after `"values:images"`:

```json
    "catalogue": "tsx scripts/catalogue.mjs",
```

- [ ] **Step 5: Write the workflow**

```yaml
# Values Catalogue Daily: adds newly released items from each game's Fandom
# wiki (src/lib/catalogue/; spec docs/superpowers/specs/2026-10-21-values-catalogue-pipeline-design.md).
#
# One job per game with fail-fast off, so one wiki or adapter breaking never
# stops another game. Insert-only. A run over its cap or unable to parse the
# wiki stops itself and posts to Discord; a crash, error or timeout is posted
# by the last step below. Light (a few wiki requests, two small reads, writes
# only for new items), so it is not on the DB-heavy list in
# src/test/routes/db-heavy-schedule.test.ts. GitHub starts schedules 5–7 h late.
name: Values Catalogue Daily

on:
  schedule:
    - cron: "5 13 * * *"
  workflow_dispatch:
    inputs:
      game:
        description: "One game key (blank = every game)"
        required: false
        default: ""

concurrency:
  group: values-catalogue
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  catalogue:
    name: Catalogue (${{ matrix.game }})
    runs-on: ubuntu-latest
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        # The CATALOGUE_GAMES keys (src/lib/catalogue/registry.ts); values-catalogue-workflow.guard.test.ts pins them.
        game: [sab]
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      PUBLIC_API_URL: ${{ secrets.PUBLIC_API_URL }}
      VALUES_REVALIDATE_SECRET: ${{ secrets.VALUES_REVALIDATE_SECRET }}
      DISCORD_OPS_WEBHOOK_URL: ${{ secrets.DISCORD_OPS_WEBHOOK_URL }}
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version: "22"
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Add new items from the wiki (insert-only)
        run: >-
          pnpm catalogue --game=${{ matrix.game }} --only="${{ inputs.game }}" --write
          --trigger=${{ github.event_name == 'schedule' && 'schedule' || 'manual' }}

      # Runs on failure OR cancellation (a timeout kill is a cancellation) and
      # never fails the job itself, so it cannot hide the original error.
      - name: Alert on failure
        if: ${{ failure() || cancelled() }}
        env:
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
          GAME: ${{ matrix.game }}
          OUTCOME: ${{ job.status }}
        run: |
          set -uo pipefail
          if [ -z "${DISCORD_OPS_WEBHOOK_URL:-}" ]; then
            echo "::warning::DISCORD_OPS_WEBHOOK_URL is not set; the catalogue job failed and nobody was told."
            exit 0
          fi
          payload="$(jq -nc \
            --arg content "🔴 **Values catalogue (${GAME}) ${OUTCOME}**: no new items were added for this game today. Run: ${RUN_URL}" \
            '{content: $content, allowed_mentions: {parse: []}}')"
          code="$(curl -sS -o /tmp/alert.out -w '%{http_code}' \
            -X POST -H 'content-type: application/json' \
            --data "$payload" "$DISCORD_OPS_WEBHOOK_URL" || echo 000)"
          if [ "$code" != "204" ] && [ "$code" != "200" ]; then
            echo "::warning::Discord alert POST returned HTTP $code"
          fi
          exit 0
```

- [ ] **Step 6: CLAUDE.md section** (add after "Trend radar…")

```markdown
## Values catalogue pipeline (from migration <ts>_catalogue_pipeline)
- New items (pets, guns, brainrots) reach the values hubs ONLY through `pnpm catalogue` (`src/lib/catalogue/`): one shared run, one adapter per game in `games/`, registry `CATALOGUE_GAMES`, daily workflow `values-catalogue-daily.yml` (matrix, one job per game, fail-fast off).
- Insert-only: the run never updates or deletes an existing item row (it only fills an image on rows it added). `catalogue_refs` (game, wiki page id) is the dedupe key; `catalogue_runs` is the run log /admin and the health check read.
- A run over `insertCap` (default 50) or with >20% unparseable pages stops itself and posts to Discord; a big backlog is a manual `--allow-large` run after a dry run.
- Adding a game: adapter + `games/<game-slug>.test.ts` (saved wiki pages) + registry line + workflow matrix key — the guard test fails until all four exist. Never edit another game's adapter for it.
```

- [ ] **Step 7: Run the guard test, the schedule test and the whole catalogue suite**

Run: `pnpm vitest run src/test/guards/values-catalogue-workflow.guard.test.ts src/test/routes/db-heavy-schedule.test.ts src/lib/catalogue`
Expected: PASS. If the schedule test enumerates every scheduled workflow, add this file to its light list, citing the header comment.

- [ ] **Step 8: Local dry run against the local stack (no prod)**

Run: `pnpm catalogue --game=sab --env=local`
Expected:
- the local DB holds only seeded games, so every wiki brainrot shows as new;
- the run is `blocked` over the cap of 50 (this proves the guard), and nothing is written;
- around 15 wiki requests.

- [ ] **Step 9: Commit**

```bash
git add src/lib/catalogue/registry.ts scripts/catalogue.mjs package.json .github/workflows/values-catalogue-daily.yml src/test/guards/values-catalogue-workflow.guard.test.ts CLAUDE.md
git commit -m "feat(catalogue): CLI, daily matrix workflow, registry guard"
```

---

### Task 9: Verify, then hand over

- [ ] **Step 1: Full gate on the local stack**

```bash
pnpm type-check
pnpm exec eslint src/lib/catalogue scripts/catalogue.mjs src/test/guards/catalogue-store.guard.integration.test.ts src/test/guards/values-catalogue-workflow.guard.test.ts
pnpm test:full
```

Expected:
- type-check clean;
- ESLint clean on the changed files;
- the full suite passes. Note any failure that also fails on `origin/main`.

- [ ] **Step 2: Stop the local stack**: `pnpm db:down`.

- [ ] **Step 3: PR** titled "Values catalogue pipeline: core + Steal a Brainrot (step 1)". Flag the migration in the PR body: db push before the deploy.

- [ ] **Step 4: Owner steps after merge, db push and RELEASE** (prod; the owner runs these or approves them):
  1. `pnpm catalogue --game=sab --env=prod --yes`: a dry run that lists what would be added (about 100 brainrots since July).
  2. `pnpm catalogue --game=sab --write --env=prod --yes --allow-large`: the first run. It adopts the 498 brainrots we hold and adds the missed ones with images.
  3. From then on, the daily workflow adds new ones automatically.
