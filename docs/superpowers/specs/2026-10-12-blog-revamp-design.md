# Blog Revamp: Shared Hubs, Block Posts, Image Pipeline, Block Editor

Date: 2026-10-12 · Branch: `feat/blog-revamp` · Owner approved option A (Tiptap 3 block posts) and the build order in chat.

## Goals

- Every game gets the same blog home (MM2 and Steal an Egg included), built from shared parts.
- Images look right everywhere: one pipeline, three layouts, stored dimensions, smallest files.
- Posts are written in a Notion-style editor, not as markdown, and published without code.
- Long-term SEO: one article template, honest dates, clean internal links, fast pages.

Research behind this: audit of our code, a live screenshot audit (`docs/handoff/blog-audit-shots/`), and a competitor/editor study (Eldorado, GameBoost, PlayerAuctions, Game8, Dexerto, value sites; Tiptap/BlockNote/Plate/Lexical).

## Not changing

- **No table migration.** `blog_posts.body` is `jsonb`; the new format lives there next to the legacy one (see Part 2). The only migration is one storage UPDATE that lets the `blog-images` bucket accept `image/avif` (`20261012230155_blog_images_avif`); it is pushed before the deploy.
- URLs stay `/{game}/blog` and `/{game}/blog/{slug}`; `/blog` stays the site-wide index.
- **Scheduling waits.** The status CHECK only allows draft / published / archived, so scheduling needs a migration and a cron. It is a later PR.

## Part 1: Shared blog home for every game

1. **One rule for "has a blog"**: `hasBlogHub(slug, postCount)` = a content-hub game (every game in `THEMES`; `pages.blog` becomes true for all) OR a game with at least one published post. The route gate, nav Guides tab, footer and sitemap all read it.
2. **Hub H1 and lead are blog copy**: `{Game} Guides` plus a one-line lead from the theme (`blogLead`, falling back to a generic line). It is never the value list's H1.
3. **Live values for every value game**:
   - `getHubTopValues` gains a generic branch over the `values_*` pipeline (`getValueItems` + prices).
   - MM2 and Steal an Egg get the Live Values strip; Adopt Me and Steal a Brainrot keep their own sources.
4. **Empty hub**:
   - Shows "Guides are on the way", plus the game's Values / Calculator / Shop links.
   - Sets `robots: noindex, follow` until the first post (thin page), and stays out of the sitemap as now.
5. **Moved posts redirect**:
   - `/{gameA}/blog/{slug}`, when the post now lives under game B, answers with `permanentRedirect` to `/{gameB}/blog/{slug}`.
   - This is generic, with no config entry per move. It is how the MM2 Halloween post moves from Adopt Me to MM2.
6. **Link fixes**:
   - Related guides and `HubGuidesStrip` build URLs from the post's primary game (tag matches 404'd).
   - Lists select only list columns (no `body`).

## Part 2: Block posts, image pipeline, article page

### Body format (no migration)

- **New posts** store `body = { v: 2, doc: TiptapDoc, cover?: StoredImage }`.
- **Legacy posts** (`body` = array of markdown strings) still render: `legacyToDoc()` converts them to the same doc at read time. There is one renderer for both.
- **Saving a legacy post** in the new editor writes v2. A one-off conversion script can come later; nothing depends on it.
- `cover_url` stays the card / OG image URL (the 1200px WebP). The full source set lives in `body.cover`.

### Blocks

| Block | Stored as | Rendered |
|---|---|---|
| Paragraph, H2, H3, bold, italic, link, bullet list, numbered list (keeps `start`), quote, divider | Tiptap StarterKit nodes | prose styles |
| Image | `image { src, sources, width, height, alt, caption, layout: column \| wide }` | `<figure><picture>` AVIF + WebP srcset, width/height, lazy except the first |
| Image pair | `imagePair { a, b }` | two columns ≥ 640px, stacked on phones |
| Table | Tiptap table, first row = header | own scroll box, sticky first column |
| Tip / Warning / Note / Key takeaways | `callout { tone }` | one callout component |
| FAQ | `faq { items: [{ q, a }] }` | `<details>` list |
| Codes table | `codes { rows: [{ code, reward, isNew, expired }] }` | active table + collapsed expired list |
| Item card | `itemCard { gameSlug, itemSlug }` | live image, value and "N offers from $X", resolved at render |
| Buy button | `cta { label, href }` | one white button |
| YouTube | `youtube { id }` | thumbnail until clicked (no iframe on load) |

**Renderer**:
- `@tiptap/static-renderer` (`renderToReactElement`) with our node mapping, as a server component. No editor code ships to readers.
- Item cards are collected from the doc and fetched in one batch before rendering.

### Image pipeline (`src/lib/blog/images.ts`, server)

1. Upload (admin action, up to 6 MB): sharp applies EXIF rotation and strips metadata.
2. Widths **480 / 960 / 1440 / 1920**, never upscaled.
3. Each width in **AVIF** (quality stepped down to a byte budget, as the hero pipeline does) and **WebP q78** as the fallback.
4. A **24px WebP blur placeholder** as a data URL.
5. Content-hashed, immutable paths `blog/{hash}/{w}.{avif|webp}`, cached for a year.
6. The action returns a `StoredImage { src, width, height, blur, sources: { avif: [{w, url}], webp: [...] } }`, which the editor stores in the block.
7. GIFs are stored as uploaded.

**Covers**: the same pipeline after a 16:9 crop (FrameCropDialog). A source at least 1200px wide is required (Google Discover).

### Article page (`/{game}/blog/{slug}`)

- **Header order**:
  1. Breadcrumb (Guides › Game)
  2. Type label
  3. H1
  4. One-line summary
  5. Byline: author · Updated {updatedAt} · {computed read time}
  6. Cover at 16:9, eager with `fetchpriority=high`
- **Layout**:
  - Reading column 700px max (17px body, line height 1.65, about 70 characters per line).
  - Wide images 960px, contained in the main column area (never under the contents list or rails).
  - Every phone image is exactly the column width.
- **Contents list**:
  - Desktop: sticky left rail with its own scroll; the buy card stays in the rail stack.
  - Phone: a collapsible "On this page" bar placed under the nav using the nav-height token, never over the tabs.
  - Heading `scroll-margin` comes from the same token.
  - Hidden under 3 H2s.
- **Per-game accent** from the content theme (`--ct-*`). No hard-coded Steal a Brainrot green.
- **Lists** match paragraph size. Numbered lists continue across images.
- **Internal links**: absolute `dropmarket.gg` links are treated as internal (no nofollow, same tab).
- **End of page**: related guides (same game, correct "Updated" date), related tools, seller band.
- **JSON-LD**: BlogPosting with `dateModified` = `updatedAt`, `wordCount` and `image`; breadcrumbs.

## Part 3: Block editor (admin)

- **Tiptap 3 (MIT)**, admin-only, loaded with `dynamic(..., { ssr:false })` so it never reaches public bundles.
  - Packages: `@tiptap/react`, `starter-kit`, `extension-table`, `extension-placeholder`, `extension-drag-handle-react`, `extension-file-handler`, `extension-character-count`, `suggestion`, `static-renderer`.
- **Writing**:
  - Markdown shortcuts (`## `, `- `, `1. `, `> `).
  - A floating bar on selection: bold, italic, link, H2, H3.
  - A `/` menu with every block in the table above.
  - Drag handle ⠿; paste or drop images (uploaded through the pipeline, then the node shows layout chips, caption and alt).
  - Item card picker: search the game's value items.
- **Templates on New**: Guide, Codes, Tier List, News. Each prefills headings.
- **Side panel**:
  - game, type, slug (auto from title)
  - cover (16:9 crop)
  - author
  - SEO title and description, with counters and a Google preview
  - a checklist: title ≤ 60, description, cover, alt on every image, at least 2 H2s, at least 1 link to a value or listing page
- **Preview**: phone (390) / desktop toggle, rendered with the real renderer.
- **Saving**:
  - New post: the first save creates it and moves the URL to `/admin/blog/{id}` (fixes duplicate-on-resave).
  - Drafts autosave (3 s debounce). Published posts save on "Update" only (no half-edits live).
  - The first publish stamps `published_at = now`.
  - Input validated with zod; errors in plain words.
  - Revalidation also covers the old URL after a rename or game move.

## Testing

- **Unit**:
  - `legacyToDoc` (every legacy syntax: images with layout words, callouts, steps, tables, `##`)
  - the renderer (each block → expected HTML)
  - image width planning
  - `hasBlogHub`
  - checklist rules
  - slug and read time
- **Integration (local stack)**: create → save → publish → read flow through the admin actions (no duplicate, `published_at` set); the moved-post redirect.
- **Browser** (one dev server, desktop + 390px): the MM2 hub; an article with every block; no overflow; contents bar position; Lighthouse CLS ≈ 0 on an image-heavy post.
- **Guards**: public-route caching, the content-hub config guard (updated for blog: true), the tailwind-content and colour guards.

## Order and commits

1. Part 1: hubs (one commit).
2. Part 2: format, renderer, images, article page (one or two commits).
3. Part 3: editor (one or two commits).
4. Then the owner edits the MM2 article in the new editor and moves it to MM2.

PR + merge on the owner's word; release only on RELEASE.
