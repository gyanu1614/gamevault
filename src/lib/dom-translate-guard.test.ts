import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installDomTranslateGuard } from './dom-translate-guard'

// A tiny stand-in for Node: children are tracked by parentNode, and the raw
// methods throw like the DOM does when the node isn't a child.
function makeCtor() {
  class FakeNode {
    parentNode: FakeNode | null = null
    children: FakeNode[] = []
    removeChild(child: FakeNode) {
      if (child.parentNode !== this) throw new Error('NotFoundError')
      this.children = this.children.filter((c) => c !== child)
      child.parentNode = null
      return child
    }
    insertBefore(node: FakeNode, ref: FakeNode | null) {
      if (ref && ref.parentNode !== this) throw new Error('NotFoundError')
      const i = ref ? this.children.indexOf(ref) : this.children.length
      this.children.splice(i, 0, node)
      node.parentNode = this
      return node
    }
  }
  return FakeNode
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('installDomTranslateGuard', () => {
  it('skips removing a node that a translator moved, instead of throwing', () => {
    const Ctor = makeCtor()
    installDomTranslateGuard(Ctor as never)
    const parent = new Ctor()
    const stray = new Ctor() // never inserted into parent
    expect(() => parent.removeChild(stray)).not.toThrow()
    expect(console.warn).toHaveBeenCalled()
  })

  it('skips inserting before a reference node that moved', () => {
    const Ctor = makeCtor()
    installDomTranslateGuard(Ctor as never)
    const parent = new Ctor()
    const node = new Ctor()
    const movedRef = new Ctor()
    expect(() => parent.insertBefore(node, movedRef)).not.toThrow()
    expect(parent.children).toHaveLength(0)
  })

  it('leaves valid calls untouched', () => {
    const Ctor = makeCtor()
    installDomTranslateGuard(Ctor as never)
    const parent = new Ctor()
    const a = new Ctor()
    const b = new Ctor()
    parent.insertBefore(a, null)
    parent.insertBefore(b, a)
    expect(parent.children).toEqual([b, a])
    parent.removeChild(a)
    expect(parent.children).toEqual([b])
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('installs once', () => {
    const Ctor = makeCtor()
    installDomTranslateGuard(Ctor as never)
    const patched = Ctor.prototype.removeChild
    installDomTranslateGuard(Ctor as never)
    expect(Ctor.prototype.removeChild).toBe(patched)
  })

  it('does nothing where there is no Node (server)', () => {
    expect(() => installDomTranslateGuard(undefined)).not.toThrow()
  })
})
