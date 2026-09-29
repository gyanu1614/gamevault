'use client'

/**
 * The Drop: HeroFilm's 3D layer. A sealed supply crate that the scroll
 * opens, and four loot objects that fly out of it and land on beat 2's
 * category tiles.
 *
 * Loaded only through HeroDrop (next/dynamic, no SSR), so three.js never
 * reaches the first bundle or the static HTML.
 *
 * Nothing here re-renders per frame: scroll and pointer arrive as
 * framer-motion values and are read with `.get()` inside useFrame; the
 * parts share per-frame state through one mutable rig.
 */

import { useEffect, useMemo, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import type { PerspectiveCamera } from 'three'
import { Crate } from './Crate'
import { Dust } from './Dust'
import { Loot } from './Loot'
import type { LootKind } from './models'
import { CAMERA_FOV, CAMERA_Z, createRig, type DropMotion, type DropRig } from './rig'
import { DROP, easeInOutCubic, lerp, lootEmerge, ramp } from './timeline'

/** Which object lands on which tile, keyed by the tile's category id. */
const LOOT_FOR: Record<string, LootKind> = {
  currency: 'coin',
  accounts: 'keycard',
  items: 'gem',
  'top-up': 'bolt',
}

export interface DropSceneProps {
  stageRef: RefObject<HTMLElement>
  motion: DropMotion
  /** Category ids, in tile order (HeroFilm's CATEGORIES). */
  slots: readonly string[]
  compact: boolean
  reduced: boolean
  /** False while the stage is off-screen: the loop stops entirely. */
  active: boolean
}

/**
 * Runs first each frame (negative priority keeps R3F's own render): the
 * camera's push, and the stage box the loot measures its tiles against.
 */
function Director({ motion, rig, reduced }: { motion: DropMotion; rig: DropRig; reduced: boolean }) {
  useFrame((state) => {
    const p = motion.p.get()
    const camera = state.camera as PerspectiveCamera
    camera.position.z = lerp(CAMERA_Z, CAMERA_Z * 0.9, easeInOutCubic(ramp(p, DROP.push)))
    camera.updateMatrixWorld()
    // One layout read per frame, and only once there is loot in the air.
    rig.stageRect = !reduced && p >= lootEmerge(0) ? state.gl.domElement.getBoundingClientRect() : null
  }, -1)
  return null
}

export default function DropScene({ stageRef, motion, slots, compact, reduced, active }: DropSceneProps) {
  const rig = useMemo(createRig, [])

  // Hover comes from the stage: the canvas takes no pointer events, so the
  // copy, search and tiles above and around it keep theirs.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect()
      rig.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
      rig.pointer.y = 1 - ((e.clientY - r.top) / r.height) * 2
      rig.pointer.active = true
    }
    const onLeave = () => (rig.pointer.active = false)
    stage.addEventListener('pointermove', onMove, { passive: true })
    stage.addEventListener('pointerleave', onLeave)
    return () => {
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerleave', onLeave)
    }
  }, [stageRef, reduced, rig])

  return (
    <Canvas
      // Phones render at 1x: the crate is small there and fill rate is the cost.
      dpr={compact ? 1 : [1, 1.75]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: CAMERA_FOV, position: [0, 0, CAMERA_Z], near: 0.1, far: 60 }}
      // Reduced motion: one still frame of the closed crate, redrawn only on resize.
      frameloop={!active ? 'never' : reduced ? 'demand' : 'always'}
      // Measuring on scroll would re-render the canvas all through the film.
      resize={{ scroll: false }}
      style={{ pointerEvents: 'none' }}
    >
      <Director motion={motion} rig={rig} reduced={reduced} />

      <ambientLight intensity={0.15} />
      {/* Key from top-left, a cool rim from back-right, a faint green fill. */}
      <spotLight position={[-5, 7, 6]} angle={0.55} penumbra={0.8} intensity={160} decay={2} color="#fff4e8" />
      <directionalLight position={[5, 2, -6]} intensity={1.4} color="#8fb4ff" />
      <pointLight position={[-3, -2, 4]} intensity={6} decay={2} color="#56B87F" />

      {/* Metal needs something to reflect. Built from a few soft panels,
          rendered once, so there is no HDR file to fetch. */}
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 5, -2]} rotation-x={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#9fb7ff" position={[6, 1, -3]} rotation-y={-Math.PI / 2} scale={[2, 6, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#56B87F" position={[-6, 0, 2]} rotation-y={Math.PI / 2} scale={[2, 4, 1]} />
      </Environment>

      <Crate motion={motion} rig={rig} compact={compact} reduced={reduced} />

      {!reduced &&
        slots.map((slot, i) =>
          LOOT_FOR[slot] ? (
            <Loot key={slot} kind={LOOT_FOR[slot]} index={i} slot={slot} motion={motion} rig={rig} stageRef={stageRef} />
          ) : null,
        )}

      <Dust count={compact ? 160 : 400} rig={rig} reduced={reduced} />
    </Canvas>
  )
}
