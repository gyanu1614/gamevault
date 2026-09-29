'use client'

import { Suspense, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import { SilentBoundary } from './SilentBoundary'

type Vec3 = [number, number, number]

/**
 * A GLB scaled uniformly to fit `size` and centred on `center`. Fitting on
 * load is what lets any exported model replace its placeholder without
 * touching the motion: the timeline moves the slot, never the model.
 */
function FittedGltf({ url, size, center }: { url: string; size: Vec3; center: Vec3 }) {
  const { scene } = useGLTF(url)
  const [sx, sy, sz] = size
  const fit = useMemo(() => {
    const object = scene.clone(true)
    const box = new Box3().setFromObject(object)
    const dims = box.getSize(new Vector3())
    const scale = Math.min(sx / dims.x, sy / dims.y, sz / dims.z)
    return {
      object,
      scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
      offset: box.getCenter(new Vector3()).negate(),
    }
  }, [scene, sx, sy, sz])

  return (
    <group position={center} scale={fit.scale}>
      <primitive object={fit.object} position={fit.offset} />
    </group>
  )
}

/**
 * Renders the GLB at `url` when there is one, else `children` (the
 * code-built placeholder). The placeholder also stands in while the file
 * loads and if it fails, so a missing model is never a hole in the scene.
 */
export function ModelSlot({
  url,
  size,
  center = [0, 0, 0],
  children,
}: {
  url: string | null
  size: Vec3
  center?: Vec3
  children: ReactNode
}) {
  if (!url) return <>{children}</>
  return (
    <SilentBoundary fallback={children}>
      <Suspense fallback={children}>
        <FittedGltf url={url} size={size} center={center} />
      </Suspense>
    </SilentBoundary>
  )
}
