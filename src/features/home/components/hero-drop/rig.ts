import type { MotionValue } from 'framer-motion'
import { Vector3, type PerspectiveCamera } from 'three'

/** HeroFilm's motion values, read with `.get()` inside useFrame. */
export interface DropMotion {
  /** Film progress, 0..1 (a still 0 under reduced motion). */
  p: MotionValue<number>
  /** Pointer over the window, -0.5..0.5, spring-smoothed (0 on touch). */
  px: MotionValue<number>
  py: MotionValue<number>
}

/**
 * Per-frame state the scene's parts share. Plain mutable fields written in
 * useFrame: scroll and pointer run at frame rate, and none of this may go
 * through React state.
 */
export interface DropRig {
  /** World position of the crate's opening this frame; loot rises from it. */
  mouth: Vector3
  /** World units per crate unit this frame; loot is sized against it. */
  crateScale: number
  /** Lid openness, 0..1. */
  open: number
  /** Pointer over the stage in NDC; `active` is false once it has left. */
  pointer: { x: number; y: number; active: boolean }
  /** The stage's box this frame. Only read while loot is in the air. */
  stageRect: DOMRect | null
}

export const createRig = (): DropRig => ({
  mouth: new Vector3(),
  crateScale: 1,
  open: 0,
  pointer: { x: 0, y: 0, active: false },
  stageRect: null,
})

export const CAMERA_FOV = 34
export const CAMERA_Z = 9

/**
 * World height the camera sees at z = 0 when it is at rest. The crate is
 * placed and sized against this, not the live camera, so the camera's push
 * reads as a push (the crate grows) instead of being cancelled out.
 */
export const REST_VIEW_H = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360)

/**
 * Loot flies on this plane, in front of the crate, so a tile's target is a
 * fixed depth whatever the crate is doing behind it.
 */
export const LOOT_Z = 2.2

const ndc = new Vector3()
const dir = new Vector3()

/** The point on the plane `z` under the NDC point (x, y), as the camera sees it now. */
export function ndcToPlane(camera: PerspectiveCamera, x: number, y: number, z: number, out: Vector3) {
  ndc.set(x, y, 0.5).unproject(camera)
  dir.copy(ndc).sub(camera.position).normalize()
  return out.copy(camera.position).addScaledVector(dir, (z - camera.position.z) / dir.z)
}

/** World height the live camera sees on the plane `z`. */
export const visibleHeightAt = (camera: PerspectiveCamera, z: number) =>
  2 * (camera.position.z - z) * Math.tan((camera.fov * Math.PI) / 360)
