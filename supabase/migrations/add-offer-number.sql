-- Offer numbers — short sequential IDs for seller offers (#33404-style),
-- used as the human-facing Offer ID on the seller offers table and for
-- payout / invoice references. Idempotent: safe to re-run.

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS offer_number bigint;

CREATE SEQUENCE IF NOT EXISTS public.listings_offer_number_seq START WITH 30001;

ALTER SEQUENCE public.listings_offer_number_seq OWNED BY public.listings.offer_number;

ALTER TABLE public.listings ALTER COLUMN offer_number SET DEFAULT nextval('public.listings_offer_number_seq');

UPDATE public.listings l
SET offer_number = sub.n
FROM (
  SELECT id, nextval('public.listings_offer_number_seq') AS n
  FROM (
    SELECT id FROM public.listings WHERE offer_number IS NULL ORDER BY created_at
  ) ordered
) sub
WHERE l.id = sub.id AND l.offer_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS listings_offer_number_key ON public.listings (offer_number);
