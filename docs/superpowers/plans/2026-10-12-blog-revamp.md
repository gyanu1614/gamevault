# Blog Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every game the same blog home, store posts as Tiptap block docs with an image pipeline and one server renderer, redesign the article page, and give admin a Notion-style block editor.

**Architecture:**
- `blog_posts.body` (jsonb) holds either the legacy markdown string array or `{ v: 2, doc, cover }`.
- One converter turns legacy posts into a doc; one server renderer (`@tiptap/static-renderer`) turns any doc into React for the article page and the admin preview.
- Images are processed once at upload with sharp into AVIF and WebP widths with stored dimensions.

**Tech Stack:** Next.js 14.2 App Router, Supabase (anon reads, service-role admin writes), Tiptap 3.31 (MIT), sharp 0.35, Tailwind, vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-blog-revamp-design.md`

## Global Constraints

- **pnpm only.**
- **No DB migration in this plan.**
- **Public pages:**
  - Public pages stay ISR: no `cookies()`, no `searchParams` (`scripts/check-public-route-caching.mjs`).
  - Public reads use `createAnonClient` / tagged anon clients.
  - No editor code in public bundles.
- **Files:** ≤ ~300 lines each; split above that.
- **Design rules (memory: ui-section-design-lessons, card-surface-system):**
  - Cards `#1D1E23`; no card-in-card; MUI or Phosphor icons.
  - Title Case labels, sentence-case tips; Inter only; neutral focus rings.
  - No glow, no emoji, no fake data.
  - Inputs ≥ 16px on touch.
- **Copy (memory: human-written-copy, seo-first-copy):** plain and numbers-first, no AI filler.
- **Images:**
  - Widths `[480, 960, 1440, 1920]`, never upscaled.
  - AVIF stepped to a byte budget, plus WebP q78.
  - 24px WebP blur.
  - Paths `blog/{hash}/{w}.{avif|webp}` with `cacheControl: '31536000'`.
- **Article reading column:** `max-w-[700px]`. Wide images 960px.

---

## Part 1: Shared blog home

### Task 1: One blog-hub rule + theme blog copy

**Files:**
- Modify: `src/lib/content/theme.ts` (all games `pages.blog: true`; add optional `blogTitle?`, `blogLead?` to `GameContentTheme`)
- Modify: `src/lib/blog/hub-params.ts` (`isBlogHubGame` unchanged in meaning; all themed games now included)
- Modify: `src/test/guards/content-hub-config.guard.test.ts` (MM2 / Steal an Egg `blog: true`)
- Modify: `src/lib/blog/hub-params.test.ts` if needed

**Interfaces:**
- Produces: `blogHubCopy(gameSlug, gameName): { title: string; lead: string }`, exported from `theme.ts`.

**Steps:**
- [ ] Test (`src/lib/content/theme.blog.test.ts`):
  - `blogHubCopy('murder-mystery-2','Murder Mystery 2').title === 'MM2 Guides'`. A theme with `blogTitle` wins; otherwise `${shortName ?? name} Guides`.
  - The lead is never equal to `heroLead` for MM2.
  - `contentHubSlugsFor('blog')` contains every key of THEMES.
- [ ] Run → FAIL.
- [ ] Implement: `pages.blog: true` everywhere, `blogTitle` / `blogLead` for SAB, AM, MM2 and SAE, and `blogHubCopy()`.
- [ ] Update the guard test and run both → PASS.

### Task 2: Generic Live Values for value-pipeline games

**Files:**
- Modify: `src/app/(marketplace)/[gameSlug]/blog/_hubData.ts` (`getHubTopValues`: add the generic branch)
- Create: `src/app/(marketplace)/[gameSlug]/blog/_genericTopValues.ts` (≤ 80 lines)
- Test: `src/app/(marketplace)/[gameSlug]/blog/_genericTopValues.test.ts`

**Interfaces:**
- Consumes: `getValueItems(gameSlug)` from `@/lib/values/data` (`ValueItem` with `price?.cheapestUsd`, `imageUrl`, `name`, `slug`).
- Produces: `topValuesFromItems(items: ValueItem[], limit: number): HubTeaserItem[]`, which is pure.

**Steps:**
- [ ] Test the pure picker:
  - Priced items only.
  - Sorted by `cheapestUsd` desc.
  - Mapped to `HubTeaserItem { slug, name, imageUrl, valueLabel, href: /{game}/values/{slug} }` (match the existing `HubTeaserItem` fields exactly).
  - Capped at `limit`.
- [ ] Implement, and wire `getHubTopValues` so any game other than adopt-me / steal-a-brainrot calls `getValueItems` then `topValuesFromItems`. Errors → `[]`.

### Task 3: Hub page uses the shared copy; empty hub noindex + links

**Files:**
- Modify: `src/app/(marketplace)/[gameSlug]/blog/page.tsx`

**Steps:**
- [ ] The hero title / lead come from `blogHubCopy`.
- [ ] Metadata: `robots: { index: posts.length > 0, follow: true }`, and the title uses the blog title.
- [ ] Empty state: "Guides are on the way", with links to Values / Calculator (when the game has them) / Shop.
- [ ] List reads use a list select (Task 4).

### Task 4: List reads without body; primary-game URLs; moved-post redirect

**Files:**
- Modify: `src/lib/blog/db.ts`:
  - add `LIST_SELECT` (no body)
  - `getGamePosts` / `getAllPublishedPosts` / `getPostsTaggedForGame` use it
  - add `getPublishedPostBySlugAnyGame(slug): Promise<{ primaryGameSlug: string | null } | null>`
- Modify: `src/app/(marketplace)/[gameSlug]/blog/[slug]/page.tsx` — on a miss, if the slug exists under another game, `permanentRedirect('/{that}/blog/{slug}')`
- Modify: the `HubGuidesStrip` component and the article's related-guides block: hrefs use `primaryGameSlug ?? gameSlug`
- Test: `src/lib/blog/post-url.test.ts` for `postHref(post, fallbackGame)`

**Interfaces:**
- Produces: `postHref(post: { slug: string; primaryGameSlug: string | null }, fallbackGame?: string): string`, in `src/lib/blog/post-url.ts`. It returns `/{primary}/blog/{slug}`, else `/blog/{slug}`.

**Steps:**
- [ ] Test `postHref` → FAIL.
- [ ] Implement it.
- [ ] Use it in HubGuidesStrip, related guides, `/blog` cards and `rail.ts`.
- [ ] Redirect: test via a pure helper `movedPostTarget(found, requestedGame)` → `string | null`.
- [ ] Commit Part 1 when `tsc` and the related tests are green.

---

## Part 2: Block posts, images, article page

### Task 5: Doc types + legacy converter

**Files:**
- Create: `src/lib/blog/doc/types.ts`:
  - `BlogDoc` (Tiptap JSONContent)
  - `StoredImage { src; width; height; blur?; sources: { avif: SrcItem[]; webp: SrcItem[] } }`
  - `BodyV2 { v: 2; doc: BlogDoc; cover?: StoredImage | null }`
- Create: `src/lib/blog/doc/legacy.ts`: `legacyToDoc(blocks: string[]): BlogDoc`
- Create: `src/lib/blog/doc/body.ts`: `readBody(raw: unknown): { doc: BlogDoc; cover: StoredImage | null; legacy: boolean }`
- Test: `src/lib/blog/doc/legacy.test.ts`, `body.test.ts`

**`legacyToDoc` mapping**, from the `_articleBody.tsx` syntax:

| Legacy syntax | Doc node |
|---|---|
| `## h` | heading level 2 |
| `### h` | heading level 3 |
| paragraph with `**b**`, `*i*`, `[t](u)` | paragraph with marks |
| `- ` lines | bulletList |
| `1. ` lines | orderedList, keeping the start number |
| `> ` | blockquote |
| `---` | horizontalRule |
| table (pipe rows) | table with a header row |
| `:::tip` / `:::warning` / `:::note` / `:::takeaways` … `:::` | callout with the matching tone |
| `![alt layout](url)` | image (`layout` = wide when "wide", else column; alt minus the layout word; no sources: legacy `src` only) |
| `:::steps` | orderedList |

**Steps:**
- [ ] Tests: one per syntax above, plus a sequence test (heading + paragraph + image + list).
- [ ] Implement it. Also `readBody`: an array → legacy; `{ v: 2 }` → v2; anything else → an empty doc.

### Task 6: Image pipeline

**Files:**
- Create: `src/lib/blog/images.ts` (server-only, sharp):
  - `planWidths(sourceWidth): number[]`
  - `processBlogImage(bytes, mime, opts?: { crop?: Crop; minWidth?: number }): Promise<ProcessedBlogImage>`
- Modify: `src/lib/actions/admin-blog.ts`: `uploadBlogImage` → returns `StoredImage` (uploads every variant, content-hashed; drops `createBucket` per call)
- Test: `src/lib/blog/images.test.ts` (`planWidths`; a real sharp run on a generated 2000×1000 PNG → AVIF and WebP widths `[480, 960, 1440, 1920]`, `height` = `round(w/2)`, a blur data URL)

**`planWidths`:**
- `[480,960,1440,1920].filter(w => w <= src)`.
- If the result is empty → `[src]`.
- If `src` is not already in the list and is below 1920 and bigger than every width kept → add `src` itself.

**Steps:** test → implement → wire the action (admin only, `requireAdmin`, 6 MB cap, mime allow-list).

### Task 7: Server renderer

**Files:**
- Create: `src/lib/blog/render/BlogDocView.tsx` (server component):
  - `renderToReactElement` with the node mapping
  - props `{ doc, items: Map<string, ItemCardData>, accent }`
- Create: `src/lib/blog/render/nodes/*.tsx`: Figure, ImagePair, Callout, Faq, Codes, ItemCard, Cta, YouTubeLite (client, click-to-load), Table
- Create: `src/lib/blog/render/headings.ts`:
  - `collectHeadings(doc): { id, text, level }[]`, with unique ids (`-2` suffix) and a non-ASCII fallback `section-n`
  - `docWordCount(doc)`, `readMinutes(doc)`
- Create: `src/lib/blog/render/items.ts`:
  - `collectItemRefs(doc)` → `{ gameSlug, itemSlug }[]`
  - `loadItemCards(refs)` → Map via `getValueItems` + buy data
- Test: `headings.test.ts`, `items.test.ts` (collect), `render.test.ts` (renderToStaticMarkup of a doc with every node → contains `<picture>` with an avif source, `width=`/`height=`, `<details>`, a table scroll wrapper, `rel` rules for an internal absolute link)

### Task 8: Article page redesign

**Files:**
- Modify: `src/app/(marketplace)/[gameSlug]/blog/[slug]/page.tsx`, split as below:
  - Create `_ArticleHeader.tsx`
  - Create `_ArticleCover.tsx`
  - Create `_ArticleEnd.tsx` (related guides + tools + seller band)
- Modify: `_ArticleToc.tsx`:
  - The desktop rail list gets its own `overflow-y-auto` with `max-h`.
  - The phone bar sits at `top-[var(--hub-nav-h)]` and is collapsible.
  - Uses ids from `collectHeadings`.
- Delete: `_articleBody.tsx` (replaced by `BlogDocView` + `legacyToDoc`) once nothing imports it (admin preview switched in Part 3).
- Modify: `src/lib/seo/jsonld.ts` `blogPosting` (`dateModified`, `wordCount`).

**Steps:**
- [ ] Read with `readBody`.
- [ ] Render with `BlogDocView`.
- [ ] 700px column; wide figures `lg:w-[960px] lg:max-w-none` centred inside the main grid cell (`mx-[calc(50%-480px)]` guarded with `lg:`, never over the rails).
- [ ] Per-game accent via `contentThemeVars`.
- [ ] Byline shows Updated `updatedAt` and the computed read time.
- [ ] Browser-check desktop + 390px.

---

## Part 3: Block editor

### Task 9: Tiptap install + shared extensions

**Steps:**
- [ ] `pnpm add @tiptap/react@3.31.4 @tiptap/pm@3.31.4 @tiptap/starter-kit@3.31.4 @tiptap/extension-table@3.31.4 @tiptap/extension-placeholder@3.31.4 @tiptap/extension-drag-handle-react@3.31.4 @tiptap/extension-file-handler@3.31.4 @tiptap/extension-character-count@3.31.4 @tiptap/suggestion@3.31.4 @tiptap/static-renderer@3.31.4` (check peer deps first). Check whether any needs `allowBuilds`.
- [ ] Create `src/lib/blog/doc/schema.ts`: the custom Node definitions (image, imagePair, callout, faq, codes, itemCard, cta, youtube) used by BOTH the editor and the static renderer. No React; attrs with defaults and `parseHTML` / `renderHTML`.

### Task 10: Editor UI

**Files** (`src/app/(admin)/admin/blog/_editor/`):
- `BlockEditor.tsx`
- `SlashMenu.tsx`
- `BubbleBar.tsx`
- `ImageNodeView.tsx` (layout chips, caption, alt)
- `ItemCardPicker.tsx`
- `CodesNodeView.tsx`
- `FaqNodeView.tsx`
- `CalloutNodeView.tsx`
- `templates.ts` (Guide / Codes / Tier List / News docs)

**Steps:** build, keeping each file ≤ 300 lines.

### Task 11: Editor page: side panel, preview, save / autosave, checklist

**Files:**
- Modify: `BlogEditor.tsx`, rewritten around BlockEditor with a side panel and a preview toggle.
- Create: `_editor/checklist.ts` (pure rules + tests).
- Create: `_editor/useAutosave.ts`.
- Modify: `src/lib/actions/admin-blog.ts`:
  - zod schema
  - `savePost` returns the id
  - the first publish sets `published_at`
  - revalidates the old path on rename or move
  - body is v2

**Steps:**
- [ ] Checklist tests.
- [ ] Action tests (integration, local stack): create → save twice → one row; publish → `published_at` set.

### Task 12: Verify, commit, report

- [ ] `tsc`, unit tests, `pnpm build` (local), one browser pass (desktop + 390px) on the MM2 hub, a legacy post and a v2 post built in the editor (local stack for writes).
- [ ] Commit per part.
- [ ] Update the SESSION memory.
