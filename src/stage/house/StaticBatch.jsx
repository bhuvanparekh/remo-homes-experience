import { useLayoutEffect, useRef } from 'react'
import { Matrix4, Mesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Merges every static mesh inside it into one mesh per material, once, after
 * mount. The house is built from ~700 small boxes for clarity in code; drawn
 * one by one that is 700 draw calls a frame, which integrated GPUs can't
 * afford. Merged, it's a few dozen — and looks identical.
 *
 * Skipped: instanced meshes (already batched), meshes with multi-material
 * arrays, and anything transparent that needs its own sort order.
 */
export function StaticBatch({ children }) {
  const root = useRef(null)
  const merged = useRef(null)

  useLayoutEffect(() => {
    const group = root.current
    group.updateWorldMatrix(true, true)
    const toLocal = new Matrix4().copy(group.matrixWorld).invert()

    const buckets = new Map()
    const absorbed = []
    group.traverse((obj) => {
      if (!obj.isMesh || obj.isInstancedMesh || Array.isArray(obj.material)) return
      if (obj.material.transparent || obj.renderOrder !== 0) return
      const key = `${obj.material.uuid}|${obj.castShadow}|${obj.receiveShadow}`
      if (!buckets.has(key)) buckets.set(key, { material: obj.material, cast: obj.castShadow, receive: obj.receiveShadow, parts: [] })
      let g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone()
      // Keep only the attributes every part shares.
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
      g.applyMatrix4(new Matrix4().multiplyMatrices(toLocal, obj.matrixWorld))
      buckets.get(key).parts.push(g)
      absorbed.push(obj)
    })

    for (const obj of absorbed) obj.visible = false

    const meshes = []
    for (const { material, cast, receive, parts } of buckets.values()) {
      const geometry = mergeGeometries(parts, false)
      for (const p of parts) p.dispose()
      if (!geometry) continue
      geometry.computeBoundingSphere()
      const mesh = new Mesh(geometry, material)
      mesh.castShadow = cast
      mesh.receiveShadow = receive
      mesh.matrixAutoUpdate = false
      meshes.push(mesh)
      group.add(mesh)
    }
    merged.current = meshes

    return () => {
      for (const m of meshes) {
        group.remove(m)
        m.geometry.dispose()
      }
      for (const obj of absorbed) obj.visible = true
    }
  }, [])

  return <group ref={root}>{children}</group>
}
