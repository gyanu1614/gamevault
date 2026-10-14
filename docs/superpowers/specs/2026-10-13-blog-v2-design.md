# Blog v2: content games, Codes menu, Eldorado-grade article design

Owner brief (2026-10-13): research Eldorado + GameBoost blogs, then make ours "clean, not congested",
with one signature colour, info over text, item pictures in tables, a boxed contents list, a shared
still background, a Codes menu, and a game picker that shows only games with content. All nine
decisions below were approved ("all yes"), with the picture rule extended by the owner.

Research facts (measured on the live pages, 2026-10-13):
- Eldorado body: Lato 18px, line-height 36px, colour #BFBBD4, paragraph gap 8px; H2 32px/700, 48px above,
  20px below; H3 24px/700, 48px above, 16px below; column 700px; images 24px corners, 24px gaps;
  tables 2px #323141 border, 16px corners, darker header row, 16px bold cells.
- Eldorado pictures: 7 of 9 are transparent WebP cut-outs (items, UI) that sit on the page with no box;
  cover is a designed image; shop banners are designed 4:1 strips.
- Eldorado background: one shared `bg-single.png` in a `position: fixed` layer behind every post.
- GameBoost: Manrope; "Last Updated: Oct 1 — FREESEED added" freshness line; summary first; FAQ; products.

## Decisions (approved)

1. **Signature colour**: brand lime for every blog highlight (links, bold lead-ins in lists, active
   contents item, "New" code badges, summary title). Not per-game colours.
2. **Contents list**: stays on the left on desktop, inside a box, current section highlighted in lime;
   phones keep the slim bar.
3. **Pictures in tables**: a first-column cell that names an item in the post's game value list gets
   that item's picture and a link automatically (works on pasted tables). **Owner addition**: any
   cell can also hold an uploaded picture (for items the value list doesn't have).
3b. **One picture size system (owner addition)**: big or small uploads look consistent everywhere:
   - photo ≥ 640px wide → fills the reading column (700px), height by its shape, capped at 560px;
   - smaller pictures / cut-outs → shown at one standard height (240px), centred, never stretched;
   - two pictures side by side → equal boxes (same height), each contained;
   - table pictures → one fixed square (40px), contained;
   - writer can still pick Wide (960px) for a photo; phones always use the column.
4. **Shared background**: one still, dimmed picture behind the blog home and every article (all games);
   value pages keep their per-game art. Built as a fixed layer (works on iPhone). I make 2–3 options.
5. **Codes**: a new post type "Codes", ONE per game, served at `/{game}/codes`. MM2 keeps its existing
   custom codes page there.
6. **Codes menu**: a "Codes ▾" dropdown in the hub nav lists only games that have a codes page.
7. **Game picker**: lists only games switched on in admin (new per-game switch "Guides & content");
   MM2, Steal a Brainrot, Adopt Me, Steal an Egg start on, all others off. A game that is off has no
   blog home (404). One database column.
8. **Freshness line** on codes posts, typed in the editor ("2 new codes"), shown under the title with
   the date: "Updated Oct 13 — 2 new codes".
9. **Order**: game picker → Codes menu → article design + background.

Pending owner decision: the blog font (research in chat: Eldorado Lato, GameBoost Manrope, ours Inter).

## Pieces (one PR batch; each piece its own commits, tests first)

### P1 — Game picker + admin switch
- Migration (real timestamp): `games.content_hub_enabled boolean not null default false`; set true
  for murder-mystery-2, steal-a-brainrot, adopt-me, steal-an-egg. No grant changes (games is read
  via existing RLS).
- `getAllGames` selects the flag; hub nav switcher lists enabled games only (current game always kept).
- Blog home `/{game}/blog` and article routes 404 when the game is off (checked before data fan-out).
- Admin Games list: a "Guides & content" toggle next to Popular/Spotlight (`toggleGameContentHub`,
  requireAdmin, service role, `revalidateTag(GAME_DIRECTORY_TAG)` + blog paths).
- Editor game select: enabled games only (plus the post's current game).
- Tests: switcher filter unit test; toggle + column default integration test (local stack).

### P2 — Codes post type + Codes menu
- Migration: allow `post_type = 'codes'`; partial unique index: one published codes post per game.
- Editor: Type "Codes" (template Codes preselects it); freshness note field for codes posts (stored in
  `body.note`); save action maps the unique-index error to plain words.
- `/{game}/codes`: MM2 → existing page; else the game's published codes post rendered with the article
  view (canonical `/{game}/codes`); else 404. `/{game}/blog/{slug}` of a codes post → 301 to `/{game}/codes`.
- Hub nav "Codes ▾": games with a codes page (MM2 + games with a published codes post), enabled only.
- Sitemap: `/{game}/codes` for those games; IndexNow + revalidation on save.
- Tests: post-url / codes routing helpers, unique rule (integration), nav list.

### P3 — Article design v2
- Lime highlight tokens; typography per research, tuned (body 18px, line-height ≈ 1.85, paragraph gap
  12px; H2 30px/700 48/20; H3 23px/700 40/14); table style per research; boxed contents list.
- Summary box (Key Takeaways) styled as the article's summary; freshness line.
- Picture size system (3b) in the renderer + editor; inline table picture (new inline node
  `cellImage`, upload from the table toolbar) + auto item pictures in first column.
- Tests: renderer size classes, item-name matching, cellImage render.

### P4 — Shared background
- Fixed, dimmed background layer on blog home + articles (all games); 2–3 options for the owner.

## Task list (owner adds items; keep this updated)
- [x] Phone: page jump on tap (smooth scroll off in editor, no-scroll focus) — committed 6626fca9
- [x] Image caption/description optional — 6626fca9
- [x] Phone save bar full width on the bottom edge — 4192601e
- [x] P1 Game picker + admin switch — 0987ffd7 (migration 20261013173019)
- [x] P2 Codes post type + Codes menu — (migration 20261013173721)
- [x] P3 Article design v2 — 62438567 type/spacing/colour (blog-prose.css), b5c4edcc picture sizes, 07dbfc2b table pictures
- [x] P4 Shared background — Eldorado's one background: a faint character cut-out in the empty strip left of the page box, 1600px+ only (.blog-backdrop::before). Interim art = hooded figure from marketplace.avif (public/assets/blog/backdrop-art.webp); owner to upload a character PNG. Rejected: blue night tint; full-photo side band ("grey blur"); full-page faint photo ("bg behind text looks bad")
- [x] Solid cards (BLOG_CARD) for boxes/tables/contents; boxes get icon tiles + distinct hues (green summary, yellow tip, blue note, red warning)
- [x] Layout v3 (owner: "text too narrow"): one 820px column + right sidebar (contents + one buy card); page box --blog-page-w 1232px; editor + preview widths match
- [x] Tables: striped rows + column hairlines
- [x] Text colour picker (toolbar): 12 swatches + any colour + remove; hex-only on the page (doc/color.ts); pasted colours stripped
- [x] Codes button beside the game switcher (owner: "a separate button", not a tab); phones: leads the tab sub-row
- [x] Blog font: Lato body + Archivo titles (owner: "we do this too")
