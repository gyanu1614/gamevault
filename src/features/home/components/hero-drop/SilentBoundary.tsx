'use client'

import { Component, type ReactNode } from 'react'

/**
 * Renders `fallback` instead of a subtree that throws. The Drop is
 * decoration: a lost WebGL context or a bad GLB must cost the hero its 3D,
 * never the hero itself (the 2D glyphs are the fallback by design).
 */
export class SilentBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
