# BTCPay Server — Phase 0 Runbook (Owner)

Everything you run to stand up `pay.dropmarket.gg`. The app-side integration is
already built and env-switched — nothing goes live until `PAYMENT_PROVIDER=btcpay`
is set AND `NEXT_PUBLIC_PURCHASES_ENABLED=true`.

**Order of operations: 1 → 7. Steps 1–2 today; the node syncs 1–2 days; 3–7 after sync.**

---

## 1. VPS + DNS (~15 min)

- Buy a VPS: **Hetzner CPX21** (3 vCPU / 4GB / 80GB, ~€8/mo) or equal. Ubuntu 24.04.
- DNS: add an **A record** `pay.dropmarket.gg` → the VPS IP (proxying/Cloudflare OFF — grey cloud; BTCPay does its own Let's Encrypt).
- SSH in as root.

## 2. Install BTCPay (Docker, ~10 min + 1–2 days sync)

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/btcpayserver/btcpayserver-docker /root/btcpayserver-docker
cd /root/btcpayserver-docker
export BTCPAY_HOST="pay.dropmarket.gg"
export NBITCOIN_NETWORK="mainnet"
export BTCPAYGEN_CRYPTO1="btc"
export BTCPAYGEN_CRYPTO2="ltc"
export BTCPAYGEN_REVERSEPROXY="nginx"
export BTCPAYGEN_LIGHTNING="none"
export BTCPAYGEN_ADDITIONAL_FRAGMENTS="opt-save-storage-s"
export LETSENCRYPT_EMAIL="gyanu1614@gmail.com"
. ./btcpay-setup.sh -i
```

- `opt-save-storage-s` = pruned node (~25GB) — fits the 80GB disk with room.
- `LIGHTNING="none"` = deferred per design decision.
- Watch sync: `https://pay.dropmarket.gg` shows a sync progress screen. Wait until 100% before real tests (invoice creation works before that, but payments won't detect).

## 3. Create Your Account + Store (~5 min)

- Open `https://pay.dropmarket.gg` → **Register** — the FIRST account becomes server admin, so do this immediately after install.
- Then: Server Settings → Policies → **disable new registrations**.
- Create a store: name **DropMarket**, default currency **EUR**.
- Store Settings → Rates: source Kraken (default), **Rate Spread: 1%** (volatility cushion per design).
- Store Settings → Checkout: leave invoice expiry at store default — the app sets **30 min per invoice** itself.

## 4. Cold Wallet + xpub (~15 min, the important one)

- On your **own machine** (hardware wallet strongly recommended; else Sparrow/Electrum with the seed written down offline — the seed NEVER touches the VPS or me):
  - Create a wallet → copy the **account xpub** (starts `xpub…`/`zpub…`).
- In BTCPay: Store → Wallets → **BTC → Setup → Connect an existing wallet → Enter extended public key** → paste the xpub. It must say **watch-only**.
- Repeat for **LTC** with a Litecoin wallet's xpub (Electrum-LTC).
- Sanity check: BTCPay must show it CANNOT spend (no send button without signing externally).

## 5. Greenfield API Key + Webhook (~10 min)

- Account (top right) → **Manage Account → API Keys → Generate Key**:
  - Permissions — ONLY these two, store-scoped to the DropMarket store:
    - `btcpay.store.canviewinvoices`
    - `btcpay.store.cancreateinvoice`
  - Copy the key.
- Store → Settings → **Webhooks → Create Webhook**:
  - Payload URL: `https://dropmarket.gg/api/webhooks/btcpay`
  - Secret: generate one (`openssl rand -hex 32`), save it.
  - Events: **Send all events** (the app filters).
- Store id: visible in the store's URL (`/stores/<STORE_ID>/…`).

## 6. Vercel Env Vars

Add to the production project (Settings → Environment Variables):

```
BTCPAY_URL=https://pay.dropmarket.gg
BTCPAY_API_KEY=<from step 5>
BTCPAY_STORE_ID=<from step 5>
BTCPAY_WEBHOOK_SECRET=<from step 5>
PAYMENT_PROVIDER=btcpay
```

Do **NOT** touch `NEXT_PUBLIC_PURCHASES_ENABLED` yet — that flip is the very
last step, after the $1 test.

## 7. USDT (TRON) Plugin — after BTC works

- Server Settings → **Plugins** → search "**USDt**" (publisher: btcpayserver-tether) → install → restart.
- Sign up for a TRON RPC endpoint (TronGrid free tier to start) → paste the
  JSON-RPC URL in the plugin's TRON settings.
- Store → Wallets: add a TRON **watch-only address** from your cold wallet.
- Tell me when it's on — I run the plugin trial before it's exposed to buyers.

---

## Launch Sequence (after sync + steps 3–6)

1. Tell me — I verify: invoice creation, webhook signature, payment page render.
2. **$1 real BTC test**: you buy a $1 test listing, pay from your own wallet, we watch it go pending → detected → confirmed → SafeDrop escrow → order paid.
3. Same with USDT once the plugin is in.
4. Flip `NEXT_PUBLIC_PURCHASES_ENABLED=true` → redeploy → selling is live.

## Ongoing Ops (monthly, ~5 min)

```bash
cd /root/btcpayserver-docker && ./btcpay-update.sh
```

- Disk check: `df -h` (pruned node stays ~25–30GB).
- Off-ramp cadence: don't sit on crypto — sweep from the cold wallet to your
  exchange/off-ramp regularly; the ledger owes sellers EUR regardless of what
  BTC does.
- Backups: the ONLY unrecoverable secret is your wallet seed (offline). The
  server itself is rebuildable; still, snapshot the VPS weekly if the host
  offers it.
