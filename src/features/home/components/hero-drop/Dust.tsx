'use client'

/**
 * Dust in the air around the crate: slow motes rising through the scene,
 * brighter once the crate's light is out. It gives the empty space depth,
 * so the crate reads as sitting in a room rather than on a page.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, type Points, type PointsMaterial } from 'three'
import type { DropRig } from './rig'
import { radialTexture } from './textures'

// The volume the motes drift through, in world units around the origin.
const SPAN_X = 14
const SPAN_Y = 8
const SPAN_Z = 6

export function Dust({ count, rig, reduced }: { count: number; rig: DropRig; reduced: boolean }) {
  const points = useRef<Points>(null)
  const material = useRef<PointsMaterial>(null)

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * SPAN_X
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPAN_Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * SPAN_Z
      speeds[i] = 0.08 + Math.random() * 0.17
    }
    return { positions, speeds }
  }, [count])

  useFrame((_, delta) => {
    if (material.current) material.current.opacity = 0.3 + 0.35 * rig.open
    if (reduced || !points.current) return
    // Clamped: after a paused stretch off-screen, resume, don't teleport.
    const dt = Math.min(delta, 0.1)
    for (let i = 0; i < count; i++) {
      const y = i * 3 + 1
      positions[y] += speeds[i] * dt
      if (positions[y] > SPAN_Y / 2) positions[y] -= SPAN_Y
    }
    points.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        map={radialTexture()}
        color="#d7efe2"
        size={0.05}
        sizeAttenuation
        transparent
        opacity={0.3}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}
