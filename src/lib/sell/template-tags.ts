/**
 * Cache tag for the seller form's field template (getSellTemplate). Every
 * admin template write revalidates it; kept in its own file so 'use server'
 * modules can import it without pulling the server read in.
 */
export const SELL_TEMPLATE_TAG = 'sell-template'
