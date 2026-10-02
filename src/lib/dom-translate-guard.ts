/**
 * Keeps a page alive when something outside React rewrites the DOM React
 * owns — mainly the browser's own Translate (Chrome, Edge, Safari) and
 * extensions such as Grammarly, which swap text nodes for <font> wrappers.
 * React later removes or inserts relative to a node that is no longer where
 * it left it, the DOM throws NotFoundError ("Failed to execute 'removeChild'
 * on 'Node': The node to be removed is not a child of this node"), and the
 * whole route falls to the error screen. Sentry, 2026-10-01: a buyer hit it
 * leaving a listing for checkout.
 *
 * This is the React team's documented workaround (facebook/react#11538):
 * when the node is not actually a child of the parent, skip the call instead
 * of throwing. Valid calls are untouched. The skip is logged as a warning, so
 * Sentry still keeps it as a breadcrumb.
 */

const GUARDED = '__dropmarketDomTranslateGuard'

type NodeCtor = { prototype: Node }

export function installDomTranslateGuard(
  ctor: NodeCtor | undefined = typeof Node === 'function' ? Node : undefined,
): void {
  const proto = ctor?.prototype as (Node & Record<string, unknown>) | undefined
  if (!proto || proto[GUARDED]) return

  const removeChild = proto.removeChild
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      console.warn('[dom-guard] skipped removeChild: the node was moved by something outside React')
      return child
    }
    return removeChild.call(this, child) as T
  }

  const insertBefore = proto.insertBefore
  proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      console.warn('[dom-guard] skipped insertBefore: the reference node was moved by something outside React')
      return node
    }
    return insertBefore.call(this, node, ref) as T
  }

  proto[GUARDED] = true
}
