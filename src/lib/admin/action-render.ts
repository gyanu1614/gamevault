import { headers } from 'next/headers'

/**
 * True when this render is the page refresh Next sends back in a server action's
 * response. Any revalidatePath / revalidateTag in the action sets one off, and it
 * re-runs the page's loaders even though the browser never uses them.
 *
 * Such a page returns its client component with no seed data on this render: the
 * mounted client already has the data. The page's loaders then run only for a
 * real visit, not on every button click.
 *
 * Only for pages whose client owns its data after mount (a seeded useQuery or
 * useState). A page that draws from its server data has to re-run it, or the
 * action's result would not show.
 *
 * The render Next runs for an action's redirect() forwards next-action too, but
 * adds the rsc header, which a browser's action request never sends: that render
 * is a real visit to the target page, so its loaders run.
 */
export function isActionResponseRender(): boolean {
  const request = headers()
  return request.has('next-action') && !request.has('rsc')
}
