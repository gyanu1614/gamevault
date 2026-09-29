'use client'

/**
 * One loot object's flight: out of the open crate in a rising spiral, then
 * an arc onto its category tile, where it lands and idles in place of the
 * tile's flat glyph.
 *
 * The tile is a DOM element and it moves (the statement scales in, the
 * tile rises, hover lifts it), so its position is re-read every frame the
 * object is in the air or landed, and unprojected onto the loot plane.
 * That keeps the landing exact at any viewport size without the scene
 * knowing anything about the page layout.
 */

import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, type Group, type PerspectiveCamera } from 'three'
import { LootModel } from './LootModels'
import type { LootKind } from './models'
import { LOOT_Z, ndcToPlane, visibleHeightAt, type DropMotion, type DropRig } from './rig'
import {
  LOOT_HANDOFF,
  LOOT_RISE,
  clamp01,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  lerp,
  lootEmerge,
  lootLand,
} from './timeline'

/** Share of the tile's height the landed object fills. */
const FILL = 0.6

const target = new Vector3()
const riseEnd = new Vector3()
const control = new Vector3()

export function Loot({
  kind,
  index,
  slot,
  motion,
  rig,
  stageRef,
}: {
  kind: LootKind
  /** Tile order: sets this object's place in the stagger. */
  index: number
  /** The tile's `data-drop-slot` (its category id). */
  slot: string
  motion: DropMotion
  rig: DropRig
  stageRef: RefObject<HTMLElement>
}) {
  const ref = useRef<Group>(null)
  const orbRef = useRef<HTMLElement | null>(null)
  const landed = useRef(false)

  // The tile shows its glyph only while no object is in it.
  const setLanded = (on: boolean) => {
    if (landed.current === on) return
    landed.current = on
    if (on) orbRef.current?.setAttribute('data-drop-landed', '')
    else orbRef.current?.removeAttribute('data-drop-landed')
  }

  useEffect(
    () => () => {
      // Unmounted (WebGL lost, navigation): the glyph must come back.
      orbRef.current?.removeAttribute('data-drop-landed')
    },
    [],
  )

  const findOrb = () => {
    if (!orbRef.current?.isConnected) {
      orbRef.current =
        stageRef.current?.querySelector<HTMLElement>(`[data-drop-slot="${CSS.escape(slot)}"]`) ?? null
      landed.current = false
    }
    return orbRef.current
  }

  // Each object leaves the crate on its own side of the spiral.
  const spiralFrom = index * (Math.PI / 2) + 0.4

  useFrame((state) => {
    const g = ref.current
    if (!g) return
    const p = motion.p.get()
    const t = (p - lootEmerge(index)) / (lootLand(index) - lootEmerge(index))
    const stage = rig.stageRect
    const orb = t > 0 && stage ? findOrb() : null
    const box = orb?.getBoundingClientRect()
    if (!stage || !box || box.width === 0 || t <= 0) {
      g.visible = false
      setLanded(false)
      return
    }

    const camera = state.camera as PerspectiveCamera
    const nx = ((box.left + box.width / 2 - stage.left) / stage.width) * 2 - 1
    const ny = 1 - ((box.top + box.height / 2 - stage.top) / stage.height) * 2
    ndcToPlane(camera, nx, ny, LOOT_Z, target)
    const landScale = (box.height / stage.height) * visibleHeightAt(camera, LOOT_Z) * FILL

    const s = rig.crateScale
    const flight = clamp01(t)
    const time = state.clock.elapsedTime

    // Rise: spiral up out of the crate's mouth, popping to size.
    const u = clamp01(t / LOOT_RISE)
    const angle = spiralFrom + u * Math.PI * 1.1
    const radius = easeOutCubic(u) * 0.75 * s
    riseEnd.set(
      rig.mouth.x + Math.cos(angle) * radius,
      rig.mouth.y + easeOutCubic(u) * 1.9 * s,
      rig.mouth.z + Math.sin(angle) * radius * 0.6,
    )
    const riseScale = 0.5 * s

    if (t <= LOOT_RISE) {
      g.position.copy(riseEnd)
      g.scale.setScalar(riseScale * Math.max(0.001, easeOutBack(u)))
    } else {
      // Fly: a lifted arc from the top of the spiral onto the tile.
      const k = easeInOutCubic(clamp01((t - LOOT_RISE) / (1 - LOOT_RISE)))
      control.lerpVectors(riseEnd, target, 0.5)
      control.y += 1.1 * s
      control.z += 0.6
      const a = (1 - k) * (1 - k)
      const b = 2 * (1 - k) * k
      const c = k * k
      g.position.set(
        a * riseEnd.x + b * control.x + c * target.x,
        a * riseEnd.y + b * control.y + c * target.y,
        a * riseEnd.z + b * control.z + c * target.z,
      )
      g.scale.setScalar(lerp(riseScale, landScale, k))
    }

    // Spin while flying, settling into the idle pose exactly on landing.
    const settle = 1 - easeOutCubic(flight)
    const idleY = kind === 'gem' ? time * 0.7 : Math.sin(time * 0.9 + index) * 0.35
    g.rotation.set(settle * 0.9 * Math.sin(index * 1.7 + 1), idleY + settle * Math.PI * 3, settle * 0.4)
    if (t >= 1) g.position.y += Math.sin(time * 1.6 + index) * 0.04 * landScale

    g.visible = true
    setLanded(t >= LOOT_HANDOFF)
  })

  return (
    <group ref={ref} visible={false}>
      <LootModel kind={kind} />
    </group>
  )
}
