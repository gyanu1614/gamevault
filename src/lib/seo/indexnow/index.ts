/**
 * IndexNow, for every section of the site. Import from here.
 *
 * Every helper LOGS the changed URLs to seo_url_events (lib/seo/events/log);
 * the cron /api/cron/seo-indexnow delivers them and retries failures. App code
 * never pings IndexNow directly (the transport in ./submit is used only by
 * that cron and the manual `pnpm indexnow:submit`).
 *
 *   logUrlEvents              log any URLs with a reason
 *   snapshotListings +
 *   submitListingChanges      listing published / materially edited / removed
 *   valuePageUrls             value pages whose cash value moved (lib/seo/gate/refresh)
 *   submitPostEvent           blog posts
 *   submitGameIfLive / ...    new or removed game hubs
 */
export { normaliseUrls, CHUNK_SIZE, INDEXNOW_KEY, INDEXNOW_ENDPOINT } from './submit'
export type { SubmitFn } from './submit'
export { logUrlEvents } from './log-events'
export { snapshotListings, submitListingChanges, classifyListingChange, listingEventUrls } from './listing-events'
export type { ListingSnapshot, ListingEvent } from './listing-events'
export { changedItemSlugs, isMaterialValueChange, valuePageUrls } from './value-changes'
export { submitPostEvent, submitGameIfLive, submitGameLive, submitGameRemoved, postEventUrls, gameLiveUrls, gameRemovedUrls } from './content-events'
