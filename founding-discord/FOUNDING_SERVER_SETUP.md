# DropMarket — Founding Discord Setup (do-it guide)

Everything here is **you clicking in Discord + pasting copy** — I can't touch your server.
This is the *founder-focused* layer (private founders area + "how to sell" content +
ready-to-paste announcements). The broader public-growth playbook (Community mode,
Disboard/Discadia listings, partnerships, bump ritual) already exists in
`HANDOFF_DISCORD_GROWTH.md` — don't redo that here; this sits on top of it.

**The one rule:** never promote an empty server. Get the channels + pinned content below
in place FIRST, then invite the 20 founders, then (later) do public promotion.

Invite link in use: `https://discord.gg/z5ghW37JRu` (this is what the site + emails point to).

---

## 1 · Channel structure (create in this order)

Keep it lean — this is a founders' room, not a 400k mega-server. A trader should see value
in the first 10 seconds.

```
📌 start-here          ← pinned: what DropMarket is + how to become a seller
📜 rules               ← short, trader-appropriate
📢 announcements       ← YOUR posts only (copy below); founders can't post
────────────  SELLING  ────────────
🏷️ how-to-sell         ← the 3-step guide (copy below)
💬 seller-questions    ← they ask, you answer 1:1 (this is where concierge happens)
💎 value-list          ← the daily price auto-post lands here (from the bot)
────────────  FOUNDERS  ────────────
⭐ founding-sellers    ← PRIVATE, role-gated. The inner circle.
🤝 wins                ← post real payouts/first sales as proof (once they happen)
────────────  COMMUNITY  ────────────
🗨️ general             ← one social channel so it's not sterile
```

Why so few: at ~20 people, more channels = deader-looking. Add `#trading`, `#want-to-buy`,
`#vouches`, `#giveaways` etc. (from the public-growth pack) only when you open to the public.

---

## 2 · Roles

Create these under **Server Settings → Roles**:

- **@Founding Seller** — amber/gold color. The 20. Grants access to `#founding-sellers` + `#wins`.
- **@Verified Seller** — green. Post-KYC sellers who can actually list. (Later.)
- **@Member** — default, everyone else.

Set `#founding-sellers` + `#wins` to **private**: Channel → Permissions → deny `@everyone` View,
allow `@Founding Seller` View. Hand out @Founding Seller manually as people join (you'll know
them from the waitlist).

---

## 3 · Onboarding (so a new joiner takes ONE action in the first 24h)

The single best predictor of a member staying = they do one thing within a day.

- **Server Settings → Onboarding** → enable. Add one question: *"What do you want to do here?"*
  → options: **"I want to sell"** (grants a role that reveals `#how-to-sell`), **"Just browsing values."**
- Or simpler: a reaction-role in `#start-here` — react ✅ to confirm you've read the rules → get @Member.

Either way: the goal is one click, day one.

---

## 4 · Ready-to-paste content

Trader voice throughout — plain, direct, no corporate. Paste each into the named channel and **pin it**.

### 📌 `#start-here` (pin this)

```
**Welcome to DropMarket — the founding sellers' room.**

DropMarket is a marketplace for Roblox game stuff — items, pets, currency, accounts —
where every trade is protected by SafeDrop escrow. Buyer pays in, you deliver, you get
paid. Even if the buyer ghosts, the money's yours the second you've delivered. No more
going first and getting burned.

You're here because you're one of the first sellers we're bringing on. That comes with:
• 2% lower fees than everyone else — locked to your account for life
• The ability to list before we open to the public
• A founding badge on your storefront buyers can see

**→ Ready to sell? Read <#how-to-sell> — it's 3 steps.**
**→ Questions? Drop them in <#seller-questions>, I answer everything myself.**
```

### 📜 `#rules` (pin this)

```
**Keep it simple, keep it safe.**

1. No scamming, ever. One confirmed scam = permanent ban + reported.
2. Use SafeDrop / a listed middleman for every trade. Never "go first" to a random DM.
3. No advertising other marketplaces or mass-DMing members.
4. Prices and values come from DropMarket Values — argue with data, not insults.
5. Be decent. Slurs, harassment, spam = removed.

Trading here is protected. Trading in DMs off-platform is not — do that and you're on your own.
```

### 🏷️ `#how-to-sell` (pin this — this is the conversion piece)

```
**How to become a DropMarket seller — 3 steps.**

**1. Claim your spot.**
Check your email for your Founding HQ link (or ask me in <#seller-questions>). It shows your
founding status and takes you into setup.

**2. Set up your account.**
Create your login, then fill the seller application — takes about 10 minutes. You'll verify
your identity only when you're ready to cash out, not before. Everything you enter is encrypted.

**3. List your stuff.**
Send me the item + a screenshot and I'll help you price it off live DropMarket Values and get
it listed. First few listings, I'll basically do it with you.

That's it. You keep your buyers, we just give you a safer place to close the deal — and you
get paid even if they vanish.

**Stuck on any step? Tag me in <#seller-questions>.**
```

### 🧮 `#value-list` (pin the bot guide)

```
**DropMarket Values — live prices, in Discord.**

Type these anywhere:
• `/value <item>` — current price for any Steal a Brainrot item
• `/wfl <have> for <want>` — win / fair / lose on a trade
• `/top` — the highest-value items right now

Same numbers the site uses. Price your listings off these so you're never lowballing or
scaring buyers off. The daily top movers auto-post here every morning.
```

---

## 5 · Announcements — a repeatable template + starter posts

Post these in `#announcements` (founders-read-only). Keep a consistent shape so it reads like
a real changelog, not random messages.

**Template (reuse every time):**
```
**[Headline in plain words]**
[1–2 sentences: what changed and why it matters to a seller.]
[Optional: one link or one next step.]
```

**Starter post 1 — the escrow hook (pin this one):**
```
**You get paid even if the buyer bails.**
SafeDrop now holds the buyer's money until you've delivered. A buyer can't take your goods
and disappear — the second you deliver, the payout's yours. This is the whole reason to sell
here instead of going first anywhere else.
```

**Starter post 2 — the price data:**
```
**Steal a Brainrot prices update every minute now.**
The values the bot and site show are live. Price your listings off them and you're always in
line with what buyers actually pay — no guessing, no lowballing yourself.
```

**Starter post 3 — welcome the cohort:**
```
**Welcome to the first cohort.**
You're one of the first sellers on DropMarket. It's small on purpose — I'm onboarding you
personally. If you've got something to sell, drop it in <#seller-questions> and I'll help you
list it today.
```

### ⭐ `#founding-sellers` (private — the concierge offer, pin it)

```
**This is the inner circle — the first sellers on DropMarket.**

Here's what I'll do for you personally as a founder:
• Send me any item + a screenshot → I'll price it off live data and build the listing for you.
• Want a first sale to test it? I'll help make it happen so you see a real payout.
• Anything you need — payout questions, disputes, pricing — you get me directly here.

You're not a ticket number. Ask me anything.
```

---

## 6 · Order of operations (tonight → this week)

1. Create channels + roles (sections 1–2). ~15 min.
2. Paste + pin all content (section 4–5). ~15 min.
3. Turn on onboarding (section 3). ~5 min.
4. Make sure `#value-list` webhook is set so the daily post lands (see `HANDOFF_DISCORD_GROWTH.md` Phase 0).
5. **Now** invite the 20 founders (see `CONCIERGE_OUTREACH.md`) — the room looks alive, so they stick.
6. Hand @Founding Seller to each as they join.
7. Public promotion (Disboard etc.) comes LATER — only once this is humming.
```
