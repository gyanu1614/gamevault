# Blog pet-scene prompt recipes

These scenes are the **art** in the blog share images. The code template
(`render-blog-og.mjs`) frames them. There are **two layouts**, each with its own
prompt shape. Set `"layout"` per post in `manifest.json`.

Recommended model: **Leonardo — Seedream 5.0 Pro** (image, not the "Seedance"
video model), 16:9, Large (2048×1152). Google ImageFX (Imagen) and Bing
(DALL·E 3) also work. Whatever you use, keep **16:9** so it fills the 1200×630
frame without odd cropping.

---

## LAYOUT A — "right" (text on the image)

Pets sit on the RIGHT; the LEFT third stays dark and empty for the label + hook.
Use for posts where you want the hook baked into the image.

> A glossy 3D render of {SUBJECT}, cute Roblox Adopt-Me style, sitting on the
> RIGHT side of the frame, soft studio lighting, subtle rim light, deep
> charcoal-green dark background with a soft vignette, high detail, colorful,
> clean, no text, no logos, product-shot composition, large empty dark space on
> the LEFT third of the image, 16:9.

## LAYOUT B — "full" (no text on the image)

The render FILLS the whole frame; the card below carries the title, so keep the
image clean and centred. Use for a single hero pet you want to show off.

> A glossy 3D render of {SUBJECT}, cute Roblox Adopt-Me style, centred and
> filling the frame, dramatic studio lighting, subtle rim light, deep
> charcoal-green dark background with a soft vignette, cinematic, high detail,
> colorful, clean, no text, no logos, 16:9.

---

## {SUBJECT} — per post / per pet

Swap `{SUBJECT}` to match the article. For pet-specific heroes we remake the
look as our OWN 3D render (fan-site practice), evoking the real pet without
copying the exact asset — describe the *features*, not the trademark name:

| Pet vibe | {SUBJECT} description to use |
|---|---|
| Bat Dragon | a dark grey dragon with large bat wings, a bony spined back, and glowing purple eyes |
| Shadow Dragon | a jet-black dragon with faint purple glowing eyes and smooth matte scales |
| Frost Dragon | a pale icy-blue dragon with frosty crystalline spikes and soft glow |
| Giraffe | a tall cartoon giraffe with a long neck and gentle eyes |
| Evil Unicorn | a dark purple unicorn with a glowing horn and small bat wings |
| Puppy + Kitten (generic) | a cute cartoon puppy and kitten together |
| Neon / Mega | a glowing rainbow-coloured fantasy creature with a soft neon aura |

Generic group shots (puppy+kitten, "a few cute pets") carry zero IP risk and
work well for the non-pet-specific guides.

---

## After you generate

1. Pick the version that best matches the layout you chose (right-weighted for
   A, centred for B) with the darkest background.
2. Save as: `public/blog-heroes/{game}/{slug}.png`
   e.g. `public/blog-heroes/adopt-me/best-adopt-me-pets-to-trade.png`
3. Set the post's `"layout"` in `manifest.json` to `"right"` (default) or
   `"full"`.
4. Render:
   ```
   node scripts/blog-og/render-blog-og.mjs            # all
   node scripts/blog-og/render-blog-og.mjs --slug <s> # one
   ```
   Output → `public/blog-og/{game}/{slug}.png`.
5. Wire it as the post cover (a helper script sets `cover_url` — ask Claude).

## Consistency tip

Reuse the SAME base prompt across a game; only change `{SUBJECT}`. That keeps
the lighting, gloss and background consistent so the whole game's blog reads as
one set.
