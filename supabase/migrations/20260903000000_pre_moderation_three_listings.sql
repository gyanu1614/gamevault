-- Lower Pre-Moderation To Three Listings. Idempotent.
--
-- Sellers already pass KYC before listing, so three manual reviews are enough
-- signal before trusting an unverified seller's listings to go live directly.
-- (approveListing also drains a seller's remaining queue the moment they cross
-- this threshold.)

UPDATE public.seller_tier_config
SET pre_moderation_listings = 3
WHERE tier = 'unverified';
