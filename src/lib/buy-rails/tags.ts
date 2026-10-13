/**
 * Cache tag on every public read of the buy rails switches (buy_rail_settings);
 * the /admin/buy-rails action revalidates it. Its own module so the admin
 * action does not pull the public readers' import graph in.
 */
export const BUY_RAILS_TAG = 'buy-rails:settings'
