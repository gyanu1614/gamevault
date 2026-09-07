-- Crypto-only payouts: normalise withdrawal_methods and add USDT rails.
--
-- Context. The table currently mixes two incompatible models: `usdc_erc20`
-- bakes the chain into method_name, while `btc` leaves the chain to a free
-- text `network` key inside withdrawal_requests.payment_details. Nothing
-- constrains the pair, and a live row already reads
--   { method_name: "btc", network: "Trc20", wallet_address: "$sejsjsjwjh28383" }
-- i.e. Bitcoin over Tron to a junk address. Approving that destroys the funds.
--
-- This migration makes coin and chain first-class columns so the pair can be
-- validated in one place (src/lib/crypto/address-validation.ts) instead of
-- being re-derived from a string name at every call site.
--
-- Fiat rails (PayPal / Payoneer / Bank) are NOT deleted — they are switched
-- off and flagged coming_soon so the UI can show them greyed out rather than
-- silently dropping methods sellers have seen before.

begin;

-- ── 1. Structure ────────────────────────────────────────────────

alter table public.withdrawal_methods
  add column if not exists coin        text,
  add column if not exists chain       text,
  add column if not exists coming_soon boolean not null default false,
  add column if not exists sort_order  integer not null default 100;

comment on column public.withdrawal_methods.coin is
  'Asset ticker (btc, eth, usdt, usdc). NULL for fiat methods.';
comment on column public.withdrawal_methods.chain is
  'Settlement network (bitcoin, ethereum, tron, polygon). NULL for fiat.';
comment on column public.withdrawal_methods.coming_soon is
  'Shown in the UI as unavailable rather than hidden entirely.';

-- ── 2. Backfill existing crypto rows ────────────────────────────

update public.withdrawal_methods set coin = 'btc',  chain = 'bitcoin'  where method_name = 'btc';
update public.withdrawal_methods set coin = 'eth',  chain = 'ethereum' where method_name = 'eth';
update public.withdrawal_methods set coin = 'usdc', chain = 'ethereum' where method_name = 'usdc_erc20';
update public.withdrawal_methods set coin = 'usdc', chain = 'tron'     where method_name = 'usdc_trc20';

-- ── 3. Guard rails ──────────────────────────────────────────────
-- Every crypto method must name both its asset and its network, and both
-- must be values the application validator understands. This is what makes
-- "BTC over Tron" unrepresentable rather than merely discouraged.

alter table public.withdrawal_methods
  drop constraint if exists withdrawal_methods_crypto_pair_ck;

alter table public.withdrawal_methods
  add constraint withdrawal_methods_crypto_pair_ck check (
    (method_type = 'fiat' and coin is null and chain is null)
    or (
      method_type = 'crypto'
      and coin  in ('btc', 'eth', 'usdt', 'usdc')
      and chain in ('bitcoin', 'ethereum', 'tron', 'polygon')
      -- A coin may only be claimed on a chain it actually exists on.
      and (coin <> 'btc' or chain = 'bitcoin')
      and (coin <> 'eth' or chain = 'ethereum')
      and (coin not in ('usdt', 'usdc') or chain in ('ethereum', 'tron', 'polygon'))
    )
  );

create unique index if not exists withdrawal_methods_coin_chain_uq
  on public.withdrawal_methods (coin, chain)
  where method_type = 'crypto';

-- ── 4. USDT rails ───────────────────────────────────────────────
-- Requested explicitly: ERC-20, TRC-20 and Polygon.

insert into public.withdrawal_methods
  (method_name, display_name, method_type, coin, chain,
   fee_percentage, fee_fixed, fee_currency,
   min_withdrawal, max_withdrawal, processing_time,
   icon_name, description, is_active, requires_kyc, coming_soon, sort_order)
values
  ('usdt_trc20', 'USDT (TRC-20)', 'crypto', 'usdt', 'tron',
   3, 10, 'USD', 50, 25000, '1-2 business days',
   'Coins', 'Lowest network fees. Send only over the Tron network.',
   true, false, false, 10),
  ('usdt_erc20', 'USDT (ERC-20)', 'crypto', 'usdt', 'ethereum',
   3, 10, 'USD', 50, 25000, '1-2 business days',
   'Coins', 'Send only over the Ethereum network.',
   true, false, false, 20),
  ('usdt_polygon', 'USDT (Polygon)', 'crypto', 'usdt', 'polygon',
   3, 10, 'USD', 50, 25000, '1-2 business days',
   'Coins', 'Low fees. Send only over the Polygon network.',
   true, false, false, 30)
on conflict (method_name) do update set
  display_name = excluded.display_name,
  coin         = excluded.coin,
  chain        = excluded.chain,
  is_active    = excluded.is_active,
  coming_soon  = excluded.coming_soon;

-- ── 5. Crypto-only for now ──────────────────────────────────────
-- Fiat stays in the table (historic requests reference these rows via
-- method_id) but is presented as coming soon.

update public.withdrawal_methods
   set is_active = false,
       coming_soon = true
 where method_type = 'fiat';

update public.withdrawal_methods
   set is_active = true,
       coming_soon = false
 where method_name in ('btc', 'usdc_erc20', 'usdc_trc20');

-- ── 6. Minimum ──────────────────────────────────────────────────
-- Mirrors PAYOUT_MIN_USD in src/lib/fees/index.ts. $100 sat above the whole
-- sector (G2G/Eldorado/Gameflip run $10-50) and stranded small balances.

update public.withdrawal_methods
   set min_withdrawal = 50
 where method_type = 'crypto';

-- ── 7. Ordering ─────────────────────────────────────────────────

update public.withdrawal_methods set sort_order =  40 where method_name = 'usdc_trc20';
update public.withdrawal_methods set sort_order =  50 where method_name = 'usdc_erc20';
update public.withdrawal_methods set sort_order =  60 where method_name = 'btc';
update public.withdrawal_methods set sort_order =  70 where method_name = 'eth';
update public.withdrawal_methods set sort_order = 200 where method_type = 'fiat';

commit;
