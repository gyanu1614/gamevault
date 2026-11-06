# Fix list + sell form search

**Goal:** everything the owner found testing live on 2026-11-05, plus the search-first sell form they approved on 2026-11-06, before the next release.

**Base:** branch `fix/fix-list-and-sell-search`, on top of #259.

**Rules:** tests first, one step at a time, a browser pass on the local stack at the end. Production writes (the first over-cap form sync, adding catalogue items) wait for the owner's word.

## Steps

1. **Listing link.** `matchListingToValueItem`: a template identity the title contradicts falls through to the title search instead of returning null. "Chroma Embersickle" with `knife-godly: embersickle` links to `chroma-embersickle`; "Fairy Bat Dragon" still links to nothing. The nightly relink fixes live listings and fires their alerts.
2. **Retire Item Properties (MM2).** `retiredFields` on the sell form config: repairs strip the answer, the field goes once no live listing has it. Never an identity key.
3. **Sell form follows the catalogue for Adopt Me and SAB.** Insert-only list sync, same route and daily workflow as MM2. Adopt Me: `pet-name`, `egg-name`, a new Potions type + `potion-name`. SAB: `select-brainrot*` by rarity through the field's own rules. Warnings go to the Discord line, which is also the "item missing from the form" alert (no extra load). Steal an Egg stays out: its catalogue has no item type to place a row by.
4. **Search-first item picker.** `src/lib/sell/item-search.ts` (pure): rows from the template's own lists, so a pick can always fill the form; pictures and rarity from a cached catalogue route, and the search still works without them. A pick fills the list and its parents through the field rules, and the title if the seller hasn't typed one. Fields that stay: trait, mutation. Manual path: today's type fields + Item Name, which sets the title. Edit and duplicate open on the picked item. Other games keep today's form.
5. **Not linked.** Publish returns whether the listing linked. The wizard tells the seller; a Discord line and an admin list tell the owner.
6. **Item page.** Trait/mutation picker: a filled card with label, value and chevron, phone and desktop. Non-default mutation: the offer's own photo, else the default picture with the mutation named. SAB only: the seller's title when it says more than item + trait + game + filler, on the page and on offer rows.
7. **Heading.** "<Game> Items" with no number on Items pages.
8. **Sub-navbar.** Join Discord out on phone and desktop; Items first in every game's tabs. Footer button stays until the owner decides.
9. **Catalogue gaps + full pass.** Report what's on the market and not in the catalogue (Wrapped Doll, Chestnut Glyptodon, MM2 unmatched names, the Glow type); add on the owner's OK. Then the affected tests, types, lint, the security check on the seller path, and a browser pass on PC and phone.

## After the release

- Run the sell form sync once with `allow_large_sell_form` (Adopt Me is over its cap), after a dry run.
- Check Chroma Embersickle linked and its alert sent, after the nightly relink.
