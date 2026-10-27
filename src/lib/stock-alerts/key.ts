/**
 * One alert's key in the client's set: the item slug for an any-trait alert
 * (the items grid), `item:variant` for one trait (the pet page). Slugs never
 * contain ':', so the two can't collide.
 */
export function stockAlertKey(itemSlug: string, variant: string | null): string {
  return variant ? `${itemSlug}:${variant}` : itemSlug
}
