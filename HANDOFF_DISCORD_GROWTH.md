# DropMarket — Discord Growth Pack (Channel 2)

The bot is built and (nearly) all shipped. This is the **growth** work — everything
you click through and post to turn a working tool into a community that sends traffic
and sellers to dropmarket.gg. Do the phases in order. **The #1 rule: never promote an
empty server** — Phase 1 before Phase 2.

Ready-to-paste copy is in fenced blocks. Everything else is a checklist.

---

## Phase 0 — Ship the last build piece (5 min)

- [ ] Merge PR #17 (daily value-list auto-post)
- [ ] In your server: create a `#value-list` channel → **Edit Channel → Integrations →
      Webhooks → New Webhook → Copy Webhook URL**
- [ ] Vercel → Settings → Environment Variables → add `DISCORD_VALUE_WEBHOOK_URL` = that URL
- [ ] Trigger once to test (or wait for the 10:30 UTC cron):
      the post appears in `#value-list`. Movers stay hidden until ~tomorrow (by design).

---

## Phase 1 — Seed the server (do BEFORE any promotion)

An empty server = instant churn = the #1 killer mistake. Make it look alive and useful first.

### 1a. Enable Community mode (free, unlocks everything downstream)
Server Settings → **Enable Community** → follow the wizard. It needs:
- [ ] Your account has **2FA** on
- [ ] A **Rules** channel and a **Community Updates** channel (wizard creates them)
- [ ] Verification level **≥ Low**, explicit-content-filter = **all members**

### 1b. Channel structure (create these, in this order)
The playbook layout — a trader should find value in the first 10 seconds:

```
📋 welcome
📜 rules
📢 announcements
──────────── VALUES ────────────
💎 value-list        ← the daily auto-post lands here
🧮 how-to-use-bot    ← pin the command guide (copy below)
──────────── TRADING ────────────
🔄 trading
🛒 want-to-buy
💰 want-to-sell
🤝 middleman-requests
✅ vouches
🚨 scam-reports
──────────── COMMUNITY ────────────
💬 general
🎉 giveaways
🤝 partners          ← for Phase 2 ad-swaps
```

### 1c. Pin the bot guide in `#how-to-use-bot`

```
**DropMarket Values — how to use**

`/value <brainrot>` — live cash value for any Steal a Brainrot item, blended
across marketplaces with fake listings filtered out. Add a mutation for the
Gold/Rainbow/etc. price.

`/wfl you: <items> them: <items>` — Win / Fair / Loss on a trade. Comma-separate
each side, e.g. `/wfl you: garama, skibidi toilet them: tralalero diamond`.

`/top <rarity>` — the highest-value items right now.

Prices update daily and match dropmarket.gg exactly. Every result links straight
to the full page.
```

### 1d. Onboarding (best predictor of 7-day retention = one action in first 24h)
- [ ] Server Settings → **Onboarding** → enable. Add one reaction-role prompt
      ("What do you trade?" → Brainrots / Accounts / Just here for values)
- [ ] Set the default landing channel to `#value-list` so newcomers see value instantly

### 1e. Support bots (install these)
- [ ] **GiveawayBot** (jagrosh) — trusted. Requiring *join to enter* is allowed;
      invite-to-win is **banned**. Always add a retention gate (stay 3 days / react).
- [ ] A **Disboard bump reminder** bot (reminder-only — auto-bumping is bannable)
- [ ] Optional retention: **Arcane** (free leveling) or **Tatsu** (daily economy loop).
      Avoid MEE6 (paywalled/spammy).

---

## Phase 2 — Distribution (once the server isn't empty)

### 2a. Directory listings — the biggest early lever ("SEO arbitrage")
Your own invite page won't rank on Google, but Disboard/Discadia DO (Disboard ~8.4M
visits, ~46% from Google). List on all of these; treat each like a landing page.

**List on:** Disboard · Discadia · Disforge · Discord.me · Top.gg · Discords.com

**Listing title (paste):**
```
DropMarket — Steal a Brainrot Values & Trading
```

**Listing description (paste):**
```
Live Steal a Brainrot values updated daily — real cash prices blended across
Eldorado, G2G & more, with fake listings filtered out. Free /value & /wfl price-
check bot, honest floor prices (not inflated averages), trading channels, and
verified middlemen. Check any Brainrot or mutation instantly. Powered by
dropmarket.gg.
```

**Tags (use as many as each site allows):**
```
steal-a-brainrot, roblox, trading, values, price-check, brainrot, marketplace,
middleman, giveaways
```

### 2b. Disboard bump ritual
- [ ] `/bump` every 2 hours, 4–6 times/day, at peak (after-school + weekends US/EU)
- [ ] **Never** incentivize bumps with roles (Disboard-bannable). Reminder bot only.
- [ ] Ask active members for **reviews** on your Disboard page (ranking signal)

### 2c. Partnerships (highest-leverage cheap tactic)
- [ ] Target **adjacent, non-competing, similar-size** servers: other Roblox games,
      brainrot meme communities. NOT the 400k-member SAB giants.
- [ ] Owner-to-owner `#partners` ad-swaps: they post your invite, you post theirs.
      Cold DM blasts fail; a single targeted 1:1 owner DM is a tolerated gray area.
- [ ] Keep a permanent invite + one-line blurb ready to reciprocate.

### HARD BANS (account + server deletion — do not cross)
- ❌ Mass-DMing members to advertise (the #1 ban trigger)
- ❌ join-for-join, invite-rewards, paying for joins, fake accounts
- ❌ Buying/selling servers or invite links (buying an ad *slot* is fine)
- ✅ Reward completed **trades/site-signups**, never Discord joins

---

## Phase 3 — Go public (the install flywheel)

The bot is already built as user-install + slash-only, so any trader can run `/value`
in any server — every user is a distribution node. To let *server owners* add it:

- [ ] Dev Portal → Bot → turn **Public Bot ON**
- [ ] Your `/privacy` and `/terms` pages already exist (App Directory requires public
      Privacy + ToS URLs) — add a one-paragraph bot section to each
- [ ] Get the **Verified Bot** badge (required past 100 servers; needs owner ID verify)
- [ ] Dev Portal → enable **App Directory** discovery. Optimize name/description/tags
      for "Roblox / price check / value / trading" — App Directory ranks by server count
      + query relevance, and it's now the primary bot-discovery surface.
- [ ] List on **top.gg** (ranks by server count + votes; weekend votes count 2×).
      Optional: a vote-reward loop (vote → small perk) is allowed.

---

## What to track (not raw member count)
- **7-day retention** and **daily-active** members — these predict growth
- Directory click-through (Disboard/Discadia referrers)
- `/value` command volume (proxy for bot reach) — logged server-side already

## Directional timeline
- Week 1–2: seed content (Phase 1), zero promotion
- Month 1: 100–200 (Disboard + Reddit + your own audience)
- Month 2–3: 300–600
- Month 4–6: 1,000+ (partnerships + giveaways) → unlocks Discord Discovery + vanity URL

## The wedge (why this works despite 400k-member competitors)
You can't out-giveaway them. Your edge is **accurate daily price data they don't
publish well** — the `#value-list` post + the bot. Lead with data, not giveaways.
