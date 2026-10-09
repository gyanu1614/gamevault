-- Currency "Delivery Method" (owner, 2026-10-08): Roblox's starting list.
--
-- category_configs.config.delivery_methods = { enabled, options: [{id, label,
-- description}] } — edited in Admin → Games → Currency → Delivery Method
-- (src/app/(admin)/admin/games/_components/DeliveryMethodsSection.tsx), read
-- by src/lib/currency/delivery-methods.ts. Seeded OFF: the admin switches it
-- on when ready. Listings store the option id in listings.delivery_method_type
-- (an existing, so far unused column), so the ids below must never be reused
-- for a different method.
--
-- Data only. Only fills a Roblox config that has no delivery_methods yet, so
-- an admin's own list is never overwritten; no Roblox row → nothing happens.

update public.category_configs cc
set config = cc.config || jsonb_build_object(
  'delivery_methods', jsonb_build_object(
    'enabled', false,
    'options', jsonb_build_array(
      jsonb_build_object(
        'id', 'gamepass',
        'label', 'Gamepass',
        'description', 'You create a Gamepass in your game priced so you receive the Robux. The buyer buys it, and Roblox sends you the Robux after its usual pending period. No login needed.'
      ),
      jsonb_build_object(
        'id', 'in-game-gifts',
        'label', 'In-Game Shop Gifts',
        'description', 'You buy the item or Robux pack in-game and gift it straight to the buyer''s username. The buyer only shares their username.'
      ),
      jsonb_build_object(
        'id', 'uid-login',
        'label', 'UID / Login',
        'description', 'The buyer shares their account login or UID in the order chat. You log in, add the Robux the official way, and log out. Ask the buyer not to log in until you confirm delivery.'
      ),
      jsonb_build_object(
        'id', 'epic-gifting',
        'label', 'Epic Gifting',
        'description', 'You add the Robux to an account you own on the Epic Games launcher and send the buyer its login on the order page. The buyer logs in, finishes a few in-game steps, and the Robux land on their own account.'
      )
    )
  )
)
from public.games g
where g.id = cc.game_id
  and g.slug = 'roblox'
  and cc.category_type = 'currency'
  and not (cc.config ? 'delivery_methods');
