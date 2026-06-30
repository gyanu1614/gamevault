/**
 * V19/P11 — Edit-listing loading skeleton.
 *
 * Identical chrome to /sell/new's skeleton; re-exports the same
 * default. Keeping the file ensures Next renders THIS skeleton (not
 * the parent (sell)/layout's, which has no loading state) while the
 * server action prefetches the listing for edit.
 */

export { default } from '../../new/loading'
