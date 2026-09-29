'use client'

/**
 * The four loot objects, one per category tile: coin (Currency), key card
 * (Accounts), gem (Items), bolt (Top Ups). Each placeholder fits a unit
 * cube facing +Z, the same box a GLB in its slot is fitted to, so swapping
 * one for the other changes nothing about how it flies or lands.
 */

import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { ExtrudeGeometry, Shape } from 'three'
import { DROP_MODELS, type LootKind } from './models'
import { ModelSlot } from './ModelSlot'

const GREEN = '#56B87F'

function Coin() {
  return (
    // Face toward the camera: a cylinder's caps face ±Y.
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.46, 0.46, 0.09, 48]} />
        <meshStandardMaterial color="#e6b34a" metalness={0.95} roughness={0.26} />
      </mesh>
      {/* A raised face inside the rim, so the edge catches light. */}
      <mesh>
        <cylinderGeometry args={[0.34, 0.34, 0.12, 48]} />
        <meshStandardMaterial color="#f2c75e" metalness={0.95} roughness={0.2} />
      </mesh>
    </group>
  )
}

function KeyCard() {
  return (
    <group>
      <RoundedBox args={[0.95, 0.6, 0.035]} radius={0.05} smoothness={4}>
        <meshStandardMaterial color="#c9d0d8" metalness={0.85} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.17, 0.02]}>
        <boxGeometry args={[0.95, 0.11, 0.004]} />
        <meshStandardMaterial color="#1b1f25" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[-0.28, -0.08, 0.022]}>
        <boxGeometry args={[0.16, 0.12, 0.01]} />
        <meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={0.7} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

function Gem() {
  return (
    <mesh scale={[0.8, 1, 0.8]}>
      <octahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial
        color="#8b5cf6"
        emissive="#4c1d95"
        emissiveIntensity={0.5}
        metalness={0.2}
        roughness={0.12}
        flatShading
      />
    </mesh>
  )
}

function Bolt() {
  const geometry = useMemo(() => {
    const s = new Shape()
    s.moveTo(0.15, 0.5)
    s.lineTo(-0.25, 0.02)
    s.lineTo(0, 0.02)
    s.lineTo(-0.15, -0.5)
    s.lineTo(0.28, 0.08)
    s.lineTo(0.03, 0.08)
    s.lineTo(0.15, 0.5)
    return new ExtrudeGeometry(s, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 2,
    }).center()
  }, [])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={0.6} metalness={0.5} roughness={0.3} />
    </mesh>
  )
}

const PLACEHOLDER: Record<LootKind, () => JSX.Element> = { coin: Coin, keycard: KeyCard, gem: Gem, bolt: Bolt }

export function LootModel({ kind }: { kind: LootKind }) {
  const Placeholder = PLACEHOLDER[kind]
  return (
    <ModelSlot url={DROP_MODELS[kind]} size={[1, 1, 1]}>
      <Placeholder />
    </ModelSlot>
  )
}
