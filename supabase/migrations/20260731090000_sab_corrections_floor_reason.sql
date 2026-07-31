-- Allow the 'floor' correction reason.
--
-- The correction layer now prefers the lowest SUPPORTED price (the cheapest a
-- buyer can actually transact at, bait excluded) over the median blend for
-- well-sampled variants. Those rows are tagged reason='floor', which the
-- original check constraint would reject.
--
-- Separate migration because 20260730120000 is already applied to production;
-- editing that file alone would not touch the live constraint.

alter table public.sab_price_corrections
  drop constraint if exists sab_price_corrections_reason_check;

alter table public.sab_price_corrections
  add constraint sab_price_corrections_reason_check check (
    reason in (
      'floor',
      'trusted',
      'thin_sample_within_anchor',
      'thin_sample_anchored',
      'insufficient_evidence',
      'variant_anchored'
    )
  );
