import { useMemo } from 'react'
import { EdgesGeometry, LineBasicMaterial, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BOUNDS, EXTERIOR_WALLS, HOUSE, INTERIOR_WALLS } from '../../config/floorplan.js'
import { MODULES, MODULE_TOP } from '../../config/construction.config.js'
import { boxM } from '../house/geometry.js'

const GOLD = '#d9ad55'

/** One box per wall, straight from the floor plan, positioned in world space. */
function wallBoxes(height) {
  return [...EXTERIOR_WALLS, ...INTERIOR_WALLS].map((w) => {
    const dx = w.b[0] - w.a[0]
    const dz = w.b[1] - w.a[1]
    const len = Math.hypot(dx, dz)
    const thick = EXTERIOR_WALLS.includes(w) ? HOUSE.extWall : HOUSE.intWall
    const g = boxM(len, height, thick).clone()
    g.rotateY(-Math.atan2(dz, dx))
    g.translate((w.a[0] + w.b[0]) / 2, height / 2, (w.a[1] + w.b[1]) / 2)
    return g
  })
}

/**
 * "One shared digital model": the design laid over the bare lot as a gold
 * wireframe — walls from the same floorplan.js the real house is built from,
 * plus the roof plate. At height-scale ≈ 0 it reads as setting-out lines on
 * the dirt; the animator then raises it to full height.
 */
export function Blueprint({ groupRef, fillRef, lineRef }) {
  const { fill, edges, fillMat, lineMat } = useMemo(() => {
    const h = MODULE_TOP - 0.25
    const roof = boxM(BOUNDS.x1 - BOUNDS.x0, 0.02, BOUNDS.z1 - BOUNDS.z0).clone().translate(0, h, 0)
    const fill = mergeGeometries([...wallBoxes(h), roof], false)
    return {
      fill,
      edges: new EdgesGeometry(fill, 20),
      fillMat: new MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.12, depthWrite: false }),
      lineMat: new LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.95 }),
    }
  }, [])

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={fillRef} geometry={fill} material={fillMat} renderOrder={3} />
      <lineSegments ref={lineRef} geometry={edges} material={lineMat} renderOrder={4} />
    </group>
  )
}

const concrete = new MeshStandardMaterial({ color: '#b9b5ad', roughness: 0.95 })

/**
 * Foundation: a perimeter footing plus piers under every module seam. Each
 * piece is scaled up out of the ground by the animator.
 */
export function Footings({ groupRef }) {
  const parts = useMemo(() => {
    const { x0, x1, z0, z1 } = BOUNDS
    const W = x1 - x0
    const D = z1 - z0
    const top = 0.16
    const out = [
      { s: [W + 0.3, top + 0.1, 0.45], p: [0, 0, z0] },
      { s: [W + 0.3, top + 0.1, 0.45], p: [0, 0, z1] },
      { s: [0.45, top + 0.1, D], p: [x0, 0, 0] },
      { s: [0.45, top + 0.1, D], p: [x1, 0, 0] },
    ]
    for (const m of MODULES.slice(1)) {
      for (const z of [-2.7, 0, 2.7]) out.push({ s: [0.55, top + 0.1, 0.55], p: [m.x0, 0, z] })
    }
    return out
  }, [])

  return (
    <group ref={groupRef} visible={false}>
      {parts.map((f, i) => (
        <mesh key={i} geometry={boxM(...f.s)} material={concrete} position={[f.p[0], f.s[1] / 2 - 0.1, f.p[2]]} castShadow receiveShadow />
      ))}
    </group>
  )
}
