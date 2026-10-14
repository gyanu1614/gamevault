# Page hero backgrounds

The big background pictures behind whole pages. Each page points at one file
in this folder by name. Drop a new file here, give it the right name, and the
page uses it. No code change needed when you only replace a file.

## Which file is which page

| File | Page |
| --- | --- |
| `home.avif` | Homepage |
| `marketplace.avif` | Game, category and listing pages |
| `account.avif` | Account area (dashboard, wallet, settings…) |
| `founding.avif` | Become a Seller (`/founding`); also the old seller application + seller status pages |
| `sell.avif` | Sell wizard (`/sell/new`, `/sell/edit`, `/sell/bulk`). A copy of `founding.avif` (owner 2026-10-10) so the seller journey keeps one look; replace it to give the wizard its own art. |
| `order.avif` | Order detail page |
| `checkout.webp` | Checkout (shown darker than the others) |

Per-game heroes (Adopt Me, Steal a Brainrot, …) are NOT files here. Upload
those in Admin → Games → Hero Background; they are stored in the database.

## Making a new one

- **Size:** 2880 × 1600 pixels (16:9-ish, landscape). Smaller than 1920 wide
  looks soft on a Mac screen.
- **Keep the subject in the middle:** the left and right 30 % get cropped on
  phones, so put the thing you want seen in the centre 40 %.
- **Format:** `.avif` (best size), `.webp` is fine too. No PNG or JPG.
- **Weight:** aim under 200 KB, never above 500 KB. The whole page waits for
  this file. Squoosh (squoosh.app) → AVIF, quality 45–55, usually gets there.
- **Darkness:** the site puts a dark wash over every hero so text stays
  readable. Pick art that still reads well a bit darker. No text in the image.
- **Name:** lowercase, hyphens, exactly as in the table (`founding.avif`).

## Replacing one

Overwrite the file with the same name. The old one is in git history if you
want it back. If you change the extension (say `.webp` instead of `.avif`),
tell the dev, because the page points at the extension too.

## Adding a brand-new page hero

Drop `yourpage.avif` here and tell the dev the page it belongs to. Wiring is
one line in that page.

`public/hero/` next door is the older set (Roblox, Fortnite, Valorant landing
art + an old homepage file). Leave it alone unless a dev asks.
