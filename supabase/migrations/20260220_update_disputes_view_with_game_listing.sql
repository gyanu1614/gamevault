-- Update disputes_with_users view to include game and listing info
-- This allows admin UI to show game logo + listing title in disputes table

DROP VIEW IF EXISTS disputes_with_users CASCADE;

CREATE OR REPLACE VIEW disputes_with_users AS
SELECT
  d.*,
  bp.username as buyer_username,
  bp.full_name as buyer_name,
  bp.avatar_url as buyer_avatar,
  bp.email as buyer_email,
  sp.username as seller_username,
  sp.full_name as seller_name,
  sp.avatar_url as seller_avatar,
  sp.email as seller_email,
  ap.username as assigned_admin_username,
  ap.full_name as assigned_admin_name,
  (SELECT COUNT(*) FROM dispute_messages WHERE dispute_id = d.id) as message_count,
  (SELECT COUNT(*) FROM dispute_messages WHERE dispute_id = d.id AND is_internal = false) as public_message_count,
  -- Order & listing info
  o.order_number,
  l.title as listing_title,
  l.game_id,
  g.name as game_name,
  g.icon as game_icon
FROM disputes d
JOIN profiles bp ON d.buyer_id = bp.id
JOIN profiles sp ON d.seller_id = sp.id
LEFT JOIN profiles ap ON d.assigned_to = ap.id
LEFT JOIN orders o ON d.transaction_id = o.id
LEFT JOIN listings l ON o.listing_id = l.id
LEFT JOIN games g ON l.game_id = g.id;
