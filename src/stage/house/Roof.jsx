import { BOUNDS, HOUSE, SITE } from '../../config/floorplan.js'
import { boxM } from './geometry.js'
import { useMaterials } from './materials.js'

const OVERHANG = 0.12
const TILT = (6 * Math.PI) / 180

/**
 * Flat roof as in ReMo's aerial render: a thin white fascia line all round,
 * a pale membrane, and a solar array over the south (street) half — panels
 * are "included" on every SupReMo per ReMo's Instagram.
 */
export function Roof() {
  const m = useMaterials()
  const { x0, x1, z0, z1 } = BOUNDS
  const { floorY, ceiling, roofThickness } = HOUSE
  const base = floorY + ceiling + 0.02
  const top = base + roofThickness
  const W = x1 - x0 + OVERHANG * 2
  const D = z1 - z0 + OVERHANG * 2

  const { rows, cols, x1: arrayX1, z0: arrayZ0, panel, gap } = SITE.solar
  const panels = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      panels.push([arrayX1 - panel[0] / 2 - c * (panel[0] + gap), arrayZ0 + panel[1] / 2 + r * (panel[1] + gap)])
    }
  }

  return (
    <group>
      {/* Slab and fascia */}
      <mesh geometry={boxM(W, roofThickness, D)} material={m.roof} position={[0, base + roofThickness / 2, 0]} castShadow receiveShadow />
      <mesh geometry={boxM(W + 0.02, 0.06, D + 0.02)} material={m.fascia} position={[0, top + 0.03, 0]} castShadow />
      <mesh geometry={boxM(W - 0.3, 0.02, D - 0.3)} material={m.roof} position={[0, top + 0.05, 0]} receiveShadow />

      {/* Solar array on low rails, tilted a few degrees toward the sun */}
      {panels.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, top + 0.2, z]} rotation-x={-TILT}>
          <mesh geometry={boxM(panel[0], 0.035, panel[1])} material={m.solarFrame} castShadow />
          <mesh position={[0, 0.019, 0]} rotation-x={-Math.PI / 2} material={m.solar}>
            <planeGeometry args={[panel[0] - 0.03, panel[1] - 0.03]} />
          </mesh>
        </group>
      ))}
      {[0, rows].map((r) => (
        <mesh
          key={r}
          geometry={boxM(cols * (panel[0] + gap), 0.05, 0.05)}
          material={m.solarFrame}
          position={[arrayX1 - (cols * (panel[0] + gap)) / 2, top + 0.09, arrayZ0 + r * (panel[1] + gap) - gap / 2]}
        />
      ))}

      {/* HVAC curb at the back, as in the aerial render */}
      <mesh geometry={boxM(1.6, 0.5, 1.0)} material={m.fascia} position={[-5.2, top + 0.3, -2.9]} castShadow />
    </group>
  )
}
