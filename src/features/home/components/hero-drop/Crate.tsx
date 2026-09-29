'use client'

/**
 * The crate: the hero's object. Sealed at rest, it floats beside the copy
 * and turns toward the pointer; scrolling cracks the SafeDrop seal, swings
 * the lid back on its hinge and lets the light out, then the crate sinks
 * away behind the statement once the loot has left it.
 *
 * Body and lid are model slots (see models.ts). The seal, the seam, the
 * inner light and the shaft are always code-built: they are the parts the
 * timeline animates.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Raycaster,
  Shape,
  Vector2,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type PointLight,
} from 'three'
import { DROP_MODELS } from './models'
import { ModelSlot } from './ModelSlot'
import { REST_VIEW_H, type DropMotion, type DropRig } from './rig'
import { radialTexture, verticalFadeTexture } from './textures'
import { DROP, easeInCubic, easeInOutCubic, easeOutCubic, lerp, ramp } from './timeline'

// Placeholder dimensions, in crate units. GLBs are fitted to the same boxes.
const W = 2.3
const H = 1.45
const D = 1.55
const WALL = 0.08
const LID_H = 0.22
const LID_W = W + 0.06
const LID_D = D + 0.06
const POST = 0.16
const STRAP_X = 0.62
const STRAP_W = 0.18
const CORNERS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const

const LID_OPEN_ANGLE = (110 * Math.PI) / 180
/** Candela at full open (physical lights: it falls off with distance squared). */
const INNER_LIGHT_MAX = 14

const GUNMETAL = new Color('#2b3038')
const TRIM = new Color('#8c96a3')
const GREEN = new Color('#56B87F')
const MINT = new Color('#a6e6bf')

/** The SafeDrop shield, centred on its own origin, ~0.48 wide by 0.62 tall at scale 1. */
function shieldShape(k: number) {
  const s = new Shape()
  s.moveTo(0, 0.3 * k)
  s.quadraticCurveTo(0.12 * k, 0.24 * k, 0.24 * k, 0.24 * k)
  s.lineTo(0.24 * k, 0.02 * k)
  s.quadraticCurveTo(0.22 * k, -0.2 * k, 0, -0.32 * k)
  s.quadraticCurveTo(-0.22 * k, -0.2 * k, -0.24 * k, 0.02 * k)
  s.lineTo(-0.24 * k, 0.24 * k)
  s.quadraticCurveTo(-0.12 * k, 0.24 * k, 0, 0.3 * k)
  return s
}

function BodyPlaceholder({ body, trim }: { body: Material; trim: Material }) {
  const floor = -H / 2
  return (
    <group>
      {/* Hollow, so the open crate has an inside for its light to fall on. */}
      <mesh material={body} position={[0, floor + WALL / 2, 0]}>
        <boxGeometry args={[W, WALL, D]} />
      </mesh>
      {[-1, 1].map((z) => (
        <mesh key={`wall-z${z}`} material={body} position={[0, 0, z * (D / 2 - WALL / 2)]}>
          <boxGeometry args={[W, H, WALL]} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={`wall-x${x}`} material={body} position={[x * (W / 2 - WALL / 2), 0, 0]}>
          <boxGeometry args={[WALL, H, D - 2 * WALL]} />
        </mesh>
      ))}
      {CORNERS.map(([x, z]) => (
        <mesh key={`post${x}${z}`} material={trim} position={[(x * W) / 2, 0.02, (z * D) / 2]}>
          <boxGeometry args={[POST, H + 0.04, POST]} />
        </mesh>
      ))}
      <mesh material={trim} position={[0, floor + 0.06, 0]}>
        <boxGeometry args={[W + 0.08, 0.12, D + 0.08]} />
      </mesh>
      {CORNERS.map(([x, z]) => (
        <mesh key={`strap${x}${z}`} material={trim} position={[x * STRAP_X, 0, z * (D / 2 + 0.012)]}>
          <boxGeometry args={[STRAP_W, H - 0.02, 0.024]} />
        </mesh>
      ))}
    </group>
  )
}

function LidPlaceholder({ body, trim }: { body: Material; trim: Material }) {
  return (
    <group>
      <mesh material={body} position={[0, LID_H / 2, 0]}>
        <boxGeometry args={[LID_W, LID_H, LID_D]} />
      </mesh>
      <mesh material={trim} position={[0, 0.03, 0]}>
        <boxGeometry args={[LID_W + 0.04, 0.06, LID_D + 0.04]} />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} material={trim} position={[x * STRAP_X, LID_H + 0.01, 0]}>
          <boxGeometry args={[STRAP_W, 0.024, LID_D + 0.02]} />
        </mesh>
      ))}
    </group>
  )
}

const raycaster = new Raycaster()
const pointerNdc = new Vector2()
const mouthLocal = new Vector3(0, H / 2, 0)

export function Crate({
  motion,
  rig,
  compact,
  reduced,
}: {
  motion: DropMotion
  rig: DropRig
  compact: boolean
  reduced: boolean
}) {
  const root = useRef<Group>(null)
  const bodyRef = useRef<Group>(null)
  const lid = useRef<Group>(null)
  const seal = useRef<Group>(null)
  const inner = useRef<PointLight>(null)
  const shaft = useRef<Mesh>(null)
  const glow = useRef<Mesh>(null)
  const hover = useRef(0)

  const mat = useMemo(
    () => ({
      body: new MeshStandardMaterial({ color: GUNMETAL, metalness: 0.75, roughness: 0.4 }),
      trim: new MeshStandardMaterial({ color: TRIM, metalness: 0.9, roughness: 0.28 }),
      seal: new MeshStandardMaterial({
        color: '#2A7A50',
        emissive: GREEN,
        emissiveIntensity: 0.6,
        metalness: 0.4,
        roughness: 0.35,
        transparent: true,
      }),
      sealInner: new MeshStandardMaterial({
        color: GREEN,
        emissive: GREEN,
        emissiveIntensity: 1,
        toneMapped: false,
        transparent: true,
      }),
      seam: new MeshBasicMaterial({ color: GREEN.clone(), toneMapped: false, transparent: true }),
      shaft: new MeshBasicMaterial({
        color: '#bff5d4',
        alphaMap: verticalFadeTexture(),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
      glow: new MeshBasicMaterial({
        color: '#9fe8bd',
        map: radialTexture(),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [],
  )

  const geo = useMemo(() => {
    const bevel = { bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 16 }
    return {
      seal: new ExtrudeGeometry(shieldShape(1), { depth: 0.05, ...bevel }),
      sealInner: new ExtrudeGeometry(shieldShape(0.58), { depth: 0.02, ...bevel }),
      // Base at y = 0, so scaling y grows the shaft up out of the crate.
      shaft: new CylinderGeometry(1.05, 0.85, 3.4, 40, 1, true).translate(0, 1.7, 0),
    }
  }, [])

  useFrame((state, delta) => {
    const g = root.current
    if (!g || !lid.current || !seal.current || !inner.current || !shaft.current || !glow.current) return
    const p = motion.p.get()
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.1)

    // Placement, against the resting camera (see REST_VIEW_H).
    const { width: sw, height: sh } = state.size
    const toWorld = REST_VIEW_H / sh
    const viewW = sw * toWorld
    let restX: number
    let restY: number
    let restScale: number
    let centreScale: number
    if (compact) {
      // Below the copy, where the phone layout has room.
      restX = 0
      restY = -0.58
      restScale = Math.min((sw * 0.56 * toWorld) / 2.5, (0.19 * REST_VIEW_H) / 1.9)
      centreScale = Math.min((sw * 0.62 * toWorld) / 2.5, (0.26 * REST_VIEW_H) / 1.9)
    } else {
      // The right-hand part of the page measure (where the copy isn't):
      // up to 740px of it, ending at the 1280px measure's right edge.
      const regionRight = sw - Math.max(0, sw / 2 - 640)
      const regionW = Math.min(0.56 * sw, 740)
      restX = ((regionRight - regionW / 2) / sw) * 2 - 1
      restY = -0.04
      restScale = Math.min((regionW * 0.58 * toWorld) / 2.5, (0.4 * REST_VIEW_H) / 1.9)
      centreScale = restScale * 1.05
    }

    const drift = easeInOutCubic(ramp(p, DROP.drift))
    const crack = ramp(p, DROP.sealCrack)
    const sealGone = ramp(p, DROP.sealFade)
    const open = easeInOutCubic(ramp(p, DROP.lidOpen))
    const sink = easeInCubic(ramp(p, DROP.sink))
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.2)

    // Hover: only while the crate is the subject (beat 1), fine pointers only.
    let hoverTarget = 0
    if (!reduced && rig.pointer.active && p < 0.15 && bodyRef.current) {
      pointerNdc.set(rig.pointer.x, rig.pointer.y)
      raycaster.setFromCamera(pointerNdc, state.camera)
      hoverTarget = raycaster.intersectObjects([bodyRef.current, lid.current], true).length > 0 ? 1 : 0
    }
    hover.current += (hoverTarget - hover.current) * (1 - Math.exp(-dt * 8))
    const hv = hover.current

    const s = lerp(restScale, centreScale, drift)
    const bob = reduced ? 0 : Math.sin(t * 1.1) * 0.05
    const x = lerp(restX, 0, drift) * (viewW / 2)
    const y = lerp(restY, compact ? -0.12 : -0.1, drift) * (REST_VIEW_H / 2)
    g.position.set(x, y + (bob + hv * 0.08) * s - sink * REST_VIEW_H * 0.42, 0)
    g.scale.setScalar(s * (1 - 0.12 * sink))
    // Pitched toward the camera, more as it opens, so the inside shows.
    const px = reduced ? 0 : motion.px.get()
    const py = reduced ? 0 : motion.py.get()
    g.rotation.set(lerp(0.24, 0.5, open) + py * 0.22, lerp(compact ? -0.3 : -0.42, -0.12, drift) + px * 0.45, 0)

    // The seal strains, trembles, then gives.
    seal.current.visible = sealGone < 1
    seal.current.scale.setScalar(1 + 0.35 * easeOutCubic(crack))
    seal.current.rotation.z = reduced ? 0 : Math.sin(t * 38) * 0.05 * crack * (1 - sealGone)
    mat.seal.emissiveIntensity = 0.45 + 0.35 * pulse + 2.2 * crack
    mat.sealInner.emissiveIntensity = 0.9 + 0.5 * pulse + 3 * crack
    mat.seal.opacity = mat.sealInner.opacity = 1 - sealGone

    lid.current.rotation.x = -open * LID_OPEN_ANGLE

    // The seam glows while the crate is shut; hovering wakes it.
    mat.seam.opacity = Math.min(1, 0.5 + 0.3 * pulse + 0.5 * hv + 0.8 * crack) * (1 - open)
    mat.seam.color.lerpColors(GREEN, MINT, Math.min(1, hv + crack))

    // Light out while it's open; off as it sinks.
    const lit = open * (1 - sink)
    inner.current.intensity = lit * INNER_LIGHT_MAX
    mat.shaft.opacity = lit * 0.5
    mat.glow.opacity = lit * 0.9
    shaft.current.scale.set(1, 0.3 + 0.7 * open, 1)
    shaft.current.visible = glow.current.visible = lit > 0.001

    // Dims as it sinks, so it leaves the frame rather than just moving.
    mat.body.color.copy(GUNMETAL).multiplyScalar(1 - 0.7 * sink)
    mat.trim.color.copy(TRIM).multiplyScalar(1 - 0.7 * sink)

    g.updateMatrixWorld()
    g.localToWorld(rig.mouth.copy(mouthLocal))
    rig.crateScale = s
    rig.open = open
  })

  return (
    <group ref={root}>
      <group ref={bodyRef}>
        <ModelSlot url={DROP_MODELS.crateBody} size={[W + 0.08, H + 0.04, D + 0.08]}>
          <BodyPlaceholder body={mat.body} trim={mat.trim} />
        </ModelSlot>
      </group>

      {/* The seam between lid and body: a frame, so the opening stays open. */}
      {[-1, 1].map((z) => (
        <mesh key={`seam-z${z}`} material={mat.seam} position={[0, H / 2 + 0.004, (z * D) / 2]}>
          <boxGeometry args={[W + 0.04, 0.024, 0.03]} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={`seam-x${x}`} material={mat.seam} position={[(x * W) / 2, H / 2 + 0.004, 0]}>
          <boxGeometry args={[0.03, 0.024, D]} />
        </mesh>
      ))}

      {/* Straddles the seam on the front face: it is what holds the lid. */}
      <group ref={seal} position={[0, H / 2 - 0.28, D / 2 + 0.03]}>
        <mesh geometry={geo.seal} material={mat.seal} />
        <mesh geometry={geo.sealInner} material={mat.sealInner} position={[0, 0, 0.05]} />
      </group>

      {/* Hinged along the back-top edge, so it swings up and away. */}
      <group ref={lid} position={[0, H / 2, -LID_D / 2]}>
        <ModelSlot
          url={DROP_MODELS.crateLid}
          size={[LID_W + 0.04, LID_H + 0.03, LID_D + 0.04]}
          center={[0, (LID_H + 0.03) / 2, LID_D / 2]}
        >
          <group position={[0, 0, LID_D / 2]}>
            <LidPlaceholder body={mat.body} trim={mat.trim} />
          </group>
        </ModelSlot>
      </group>

      <pointLight ref={inner} position={[0, H / 2 - 0.35, 0]} color="#c9f5da" intensity={0} decay={2} />
      <mesh ref={glow} material={mat.glow} position={[0, H / 2 - 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W - 0.3, D - 0.3]} />
      </mesh>
      <mesh ref={shaft} geometry={geo.shaft} material={mat.shaft} position={[0, H / 2 - 0.1, 0]} />
    </group>
  )
}
