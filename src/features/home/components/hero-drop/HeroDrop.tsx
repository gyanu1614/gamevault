'use client'

/**
 * HeroDrop — mounts the Drop's 3D scene into HeroFilm's stage, or nothing.
 *
 * This file is the only part of the Drop in HeroFilm's bundle. The scene
 * (three.js, R3F, drei) is a separate chunk behind next/dynamic with no
 * SSR, requested only once the browser is idle and only where WebGL
 * exists. The static HTML is unaffected: the server renders nothing here,
 * and without WebGL nothing ever mounts, so the tiles keep their 2D glyphs.
 *
 * TODO(Step 4): phones get the real-time scene too for now, just cheaper
 * (1x DPR, fewer motes, crate below the copy). Step 4 replaces it on the
 * compact layout with a pre-rendered image sequence scrubbed by the same
 * progress, so phones pay for frames, not for a GPU.
 */

import { useEffect, useMemo, useState, type RefObject } from 'react'
import dynamic from 'next/dynamic'
import type { MotionValue } from 'framer-motion'
import { SilentBoundary } from './SilentBoundary'

const DropScene = dynamic(() => import('./DropScene'), { ssr: false })

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    // Hand the probe context straight back: browsers cap live contexts.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null
  } catch {
    return false
  }
}

export function HeroDrop({
  stageRef,
  p,
  px,
  py,
  slots,
  reduced,
}: {
  stageRef: RefObject<HTMLElement>
  p: MotionValue<number>
  px: MotionValue<number>
  py: MotionValue<number>
  slots: readonly string[]
  reduced: boolean
}) {
  const [ready, setReady] = useState(false)
  const [compact, setCompact] = useState(false)
  const [active, setActive] = useState(true)
  const motion = useMemo(() => ({ p, px, py }), [p, px, py])

  // Idle first: the scene is decoration, and must not compete with
  // hydration or the headline for the main thread. Safari has no
  // requestIdleCallback, hence the timeout.
  useEffect(() => {
    if (!hasWebGL()) return
    const go = () => setReady(true)
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(go, { timeout: 1500 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(go, 300)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    // Matches the compact layout breakpoint in globals.css.
    const mq = window.matchMedia('(max-width: 1023px)')
    const sync = () => setCompact(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Off-screen, the render loop stops outright rather than drawing frames
  // nobody sees for the rest of the page.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !ready) return
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting))
    io.observe(stage)
    return () => io.disconnect()
  }, [stageRef, ready])

  if (!ready) return null
  return (
    <div aria-hidden className="hero-drop">
      <SilentBoundary fallback={null}>
        <DropScene stageRef={stageRef} motion={motion} slots={slots} compact={compact} reduced={reduced} active={active} />
      </SilentBoundary>
    </div>
  )
}
