-- ============================================================================
-- Split the "listable" gate from the "has a per-pet page" gate.
-- ============================================================================
-- The first cut used a single is_active flag for BOTH "show on the value list"
-- and "publish a /values/{slug} page". Those are different bars:
--
--   * Value LIST (TASK-2): a pet is listable as soon as it is priced. It shows
--     as a row with its numbers — no long-form copy required.
--   * Per-pet PAGE (TASK-3): needs 100-150 words of genuine context to avoid
--     thin-content / soft-404 problems. That is a stricter, later gate.
--
-- Conflating them meant the value list stayed empty until every pet had a
-- hand-written description — which defeats the point of the list. So:
--
--   is_active  → listable (priced, real). Drives the value-list RLS + list query.
--   has_page   → publish the per-pet route. Requires is_active AND a description.
--                Enforced as a generated column so it can never drift from the
--                two facts it depends on.
-- ============================================================================

begin;

alter table public.adopt_me_pets
  add column if not exists has_page boolean
  generated always as (
    is_active = true
    and description is not null
    and length(btrim(description)) >= 200   -- ~100+ words of real copy
  ) stored;

comment on column public.adopt_me_pets.has_page is
  'Generated: true only when the pet is active AND carries a substantive '
  'description. Gates the /adopt-me/values/{slug} route so no thin page ships. '
  'The value LIST uses is_active alone.';

create index if not exists adopt_me_pets_has_page_idx
  on public.adopt_me_pets (has_page);

-- The value-list RLS already keys on is_active, which is the correct bar for
-- listing. The per-pet route will additionally check has_page in the query.

commit;
