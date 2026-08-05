-- Allow the 'reputable' correction reason.
--
-- The correction layer now prices from sellers with 100+ reviews as the primary
-- path: value = the reputable average, plus a separate cheapest. Those rows are
-- tagged reason='reputable', which the existing check constraint rejects
-- (correction cron fails with "violates check constraint
-- sab_price_corrections_reason_check").
--
-- Separate migration because the prior constraint migrations are already applied
-- to production; editing them would not touch the live constraint.

alter table public.sab_price_corrections
  drop constraint if exists sab_price_corrections_reason_check;

alter table public.sab_price_corrections
  add constraint sab_price_corrections_reason_check check (
    reason in (
      'reputable',
      'floor',
      'trusted',
      'thin_sample_within_anchor',
      'thin_sample_anchored',
      'insufficient_evidence',
      'variant_anchored'
    )
  );
