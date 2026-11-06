# Seller Navigation, Sell Form, Item Page and Wallet: Plan

**Asked by:** the owner, 2026-11-06, 12 points with screenshots. Fix one by one, nothing skipped, then release.
**Branch:** `feat/seller-nav-item-page-wallet`, off main after #263.
**House rules for every step:** `house-design-checklist`, `page-scale.ts` sizes, near-square corners, no card in a card, no unrequested details, Title Case, buyer-readable words. Check on phone and PC. Visual first where marked.

## Already done on live (owner's "do your recommendations")
- [x] Netzooka deleted: row, sell form option, picture, saved pages now 404.
- [x] 7 MM2 names linked: Shadow, Prince (guns), Cowboy, Golden, Phaser, Laser (knives), SharkSeeker. Ghost and Ornament held: the wiki shows they may be different items.
- [x] CandyCorn, Skulls, Bombs: left for the wiki; the daily job adds them.

## A. Navigation (point 12, pause out of the navbar)
- [x] Navbar menu: no wallet balance, no Offline Mode, no Feedback, no Seller Dashboard (pages stay). Orders becomes Purchases. Offers always shows Items, Accounts, Currency under it.
- [x] Seller sidebar: Offers always open, no chevron. Orders group as it is.
- [x] Nothing left reads the balance or the pause for the menu, so `/api/account/menu` goes: one request less on every seller page.
- [x] Phones: a labelled Seller Menu row at the top of account pages opens the sidebar.

## B. Paused stores can't be bought from (decision 4)
- [x] Listing page of a paused store: says the store is offline, no Buy Now.
- [x] Order step refuses a paused store: migration on `order_create_pending`, tested.
- [x] Settings keeps the switch; check it still works.

## C. Sell form (points 2, 4)
- [x] A picked Adopt Me or Murder Mystery 2 item: no Photos section. The item's own picture is used. Steal a Brainrot keeps Photos, because income varies.
- [x] Enter Manually: the whole Offer Details card goes, only a way back to search stays. The typed name becomes the title.
- [x] Publish still passes its required-field checks on both paths.

## D. Item page (points 0, 3, 5, 6, 7, 8)
- [x] 8: the picture tile and buy card keep one size across every trait and form, with or without an offer.
- [x] 3: long description scrolls inside a fixed height; the page doesn't grow.
- [x] 5: picker uses the Values colours: Chroma, Candy pink, Lava red and the rest, closed and in the list. Also fix the list's empty left gap and width.
- [x] 0: seller photos that aren't square. VISUAL FIRST.
- [x] 6: the seller's custom title. VISUAL FIRST.
- [x] 7: light background behind the description. VISUAL FIRST, keep as is if it doesn't help.

## E. Wallet and Withdraw (points 9, 10)
- [x] 9: balance on the shared size scale, no oversized number. Refund row rewritten so a buyer understands it.
- [x] 10: research, then Withdraw as steps: Payout Method, Amount, Review, each one card. Sellers can add details and request during a hold, paid when the hold ends. WAITING ON THE OWNER: how long the hold is.

## G. Added while working
- [x] 13: settings pages (all account pages) don't scroll past their content: the background art is never taller than a short page.
- [x] 14: order page: back arrow in the title row, no extra row, content starts higher.

## F. Finish (point 11)
- [x] Whole test suite with the database, security review of the money changes, browser pass on phone and PC.
- [x] PR, merge, migration first, release. Didit picks up its settings with the release; check it after.

## How it ended (2026-11-06)
- Wallet: the owner rejected a line of stages and a lit card. It's two plain cards, Available and Pending.
- Hold: the owner's "48 days" was the payout-change wait, 24 hours. A request during it goes in as Scheduled.
- Added during the work: site-wide white (`text-colours.guard.test.ts`), new Messages and Live Orders icons.
- See the sections in CLAUDE.md dated 2026-11-06.
