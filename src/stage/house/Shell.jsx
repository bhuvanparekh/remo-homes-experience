import { useMemo } from 'react'
import { BOUNDS, EXTERIOR_WALLS, HOUSE, INTERIOR_WALLS, ROOMS_PLAN } from '../../config/floorplan.js'
import { along, boxM, segment, wallPieces } from './geometry.js'
import { useMaterials } from './materials.js'

const { floorY, ceiling, extWall, intWall } = HOUSE
/** Exterior panels stop just above the gravel, like the renders' shadow gap. */
const PANEL_BASE = 0.12

/* ---------------- Walls ---------------- */

/**
 * One wall: solid pieces around its openings, plus the fittings in each
 * opening. Exterior walls get the panel finish on their outside face only.
 */
export function Wall({ wall, exterior }) {
  const m = useMaterials()
  const t = exterior ? extWall : intWall
  const seg = segment(wall.a, wall.b)

  // Exterior walls sit inside the footprint line; interior walls are centred.
  const mid = [(wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2]
  const leftDotOut = -seg.dir[1] * mid[0] + seg.dir[0] * mid[1]
  const outSign = exterior ? Math.sign(leftDotOut) : 0
  const centreOffset = exterior ? -outSign * (t / 2) : 0

  // Box material slots: +x, -x, +y, -y, +z (left side), -z (right side).
  const mats = useMemo(() => {
    if (!exterior) return m.plaster
    const outside = m.panel
    const inside = m.plaster
    return [m.panel, m.panel, m.plaster, m.plaster, outSign > 0 ? outside : inside, outSign > 0 ? inside : outside]
  }, [exterior, outSign, m])

  // East/west exterior walls own the corners; north/south stop short of them
  // so no two panel faces ever share a plane (which would flicker).
  const trim = exterior && Math.abs(seg.dir[0]) > 0.5 ? t : 0
  const pieces = wallPieces(seg.length, ceiling, wall.openings)
    .map((p) => ({ ...p, s0: Math.max(p.s0, trim), s1: Math.min(p.s1, seg.length - trim) }))
    .filter((p) => p.s1 - p.s0 > 0.001)
  const meshes = pieces.map((p, i) => {
    const s = (p.s0 + p.s1) / 2
    const [x, z] = along(wall.a, seg, s, centreOffset)
    const len = p.s1 - p.s0
    return (
      <mesh
        key={i}
        geometry={boxM(len, p.y1 - p.y0, t)}
        material={mats}
        position={[x, floorY + (p.y0 + p.y1) / 2, z]}
        rotation-y={seg.rotY}
        castShadow
        receiveShadow
      />
    )
  })

  // Below the floor line: a continuous panel skirt down to just above grade.
  let skirt = null
  if (exterior) {
    const [x, z] = along(wall.a, seg, seg.length / 2, centreOffset)
    skirt = (
      <mesh
        geometry={boxM(seg.length - trim * 2, floorY - PANEL_BASE, t)}
        material={mats}
        position={[x, PANEL_BASE + (floorY - PANEL_BASE) / 2, z]}
        rotation-y={seg.rotY}
        castShadow
        receiveShadow
      />
    )
  }

  return (
    <group>
      {meshes}
      {skirt}
      {wall.openings.map((o) => (
        <Opening key={o.id} wall={wall} seg={seg} opening={o} thickness={t} centreOffset={centreOffset} outSign={outSign} />
      ))}
    </group>
  )
}

/* ---------------- Openings ---------------- */

const SURROUND = 0.12 // the wide black window surround in ReMo's renders
const PROUD = 0.045

/**
 * Fittings for one opening, built in the wall's local frame (x along the
 * wall, z across it, +z = the wall's left side) and placed with one group.
 */
function Opening({ wall, seg, opening: o, thickness: t, centreOffset, outSign }) {
  const m = useMaterials()
  const [x, z] = along(wall.a, seg, o.at, centreOffset)
  const w = o.width
  const sill = o.sill ?? 0
  const head = o.head ?? 2.1
  const h = head - sill
  const cy = sill + h / 2
  const outZ = outSign * (t / 2) // outside face, in local z

  let parts = null
  if (o.kind === 'window' || o.kind === 'glassDoor' || o.kind === 'door') {
    const sz = outZ + outSign * (PROUD / 2)
    const surround = (
      <>
        <mesh geometry={boxM(w + SURROUND * 2, SURROUND, PROUD)} material={m.frame} position={[0, head + SURROUND / 2, sz]} castShadow />
        <mesh geometry={boxM(w + SURROUND * 2, SURROUND, PROUD)} material={m.frame} position={[0, Math.max(sill - SURROUND / 2, -0.05), sz]} castShadow />
        <mesh geometry={boxM(SURROUND, h, PROUD)} material={m.frame} position={[-w / 2 - SURROUND / 2, cy, sz]} castShadow />
        <mesh geometry={boxM(SURROUND, h, PROUD)} material={m.frame} position={[w / 2 + SURROUND / 2, cy, sz]} castShadow />
        {/* Black reveal lining the opening through the wall */}
        <mesh geometry={boxM(w, 0.02, t)} material={m.frame} position={[0, head - 0.01, 0]} />
        <mesh geometry={boxM(0.02, h, t)} material={m.frame} position={[-w / 2 + 0.01, cy, 0]} />
        <mesh geometry={boxM(0.02, h, t)} material={m.frame} position={[w / 2 - 0.01, cy, 0]} />
      </>
    )

    if (o.kind === 'window') {
      parts = (
        <>
          {surround}
          <mesh geometry={boxM(w, 0.02, t)} material={m.frame} position={[0, sill + 0.01, 0]} />
          <mesh geometry={boxM(w - 0.04, h - 0.04, 0.012)} material={m.glass} position={[0, cy, outZ * 0.3]} renderOrder={2} />
          {/* Interior sill */}
          <mesh geometry={boxM(w + 0.06, 0.03, 0.08)} material={m.white} position={[0, sill, -outZ - outSign * 0.02]} />
        </>
      )
    } else if (o.kind === 'glassDoor') {
      const leaf = w / 2
      parts = (
        <>
          {surround}
          {[-1, 1].map((side) => {
            // Leaves hinge on the outer jambs; an `open` door swings them in.
            const swing = o.open ? (-outSign * side * 85 * Math.PI) / 180 : 0
            return (
              <group key={side} position={[(side * w) / 2, 0, outZ * 0.3]} rotation-y={swing}>
                <group position={[(-side * leaf) / 2, 0, 0]}>
                  <mesh geometry={boxM(leaf, 0.07, 0.05)} material={m.frame} position={[0, head - 0.035, 0]} />
                  <mesh geometry={boxM(leaf, 0.1, 0.05)} material={m.frame} position={[0, 0.05, 0]} />
                  <mesh geometry={boxM(0.06, h, 0.05)} material={m.frame} position={[-leaf / 2 + 0.03, cy, 0]} />
                  <mesh geometry={boxM(0.06, h, 0.05)} material={m.frame} position={[leaf / 2 - 0.03, cy, 0]} />
                  <mesh geometry={boxM(leaf - 0.1, h - 0.17, 0.012)} material={m.glass} position={[0, cy + 0.015, 0]} renderOrder={2} />
                  <mesh geometry={boxM(0.025, 0.6, 0.025)} material={m.blackSteel} position={[-side * (leaf / 2 - 0.12), 1.05, outSign * 0.06]} />
                </group>
              </group>
            )
          })}
        </>
      )
    } else {
      parts = (
        <>
          {surround}
          <mesh geometry={boxM(w - 0.02, h - 0.01, 0.045)} material={m.white} position={[0, cy, outZ * 0.4]} castShadow />
          <mesh geometry={boxM(0.14, 0.025, 0.05)} material={m.blackSteel} position={[w / 2 - 0.12, 1.0, outZ * 0.4 + outSign * 0.04]} />
        </>
      )
    }
  } else if (o.kind === 'interior') {
    // Wood leaf standing open at 90°, white casing both sides.
    const leafW = w - 0.04
    const leafH = 2.06
    parts = (
      <>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={boxM(w + 0.14, 0.07, 0.015)} material={m.white} position={[0, 2.12, s * (t / 2 + 0.008)]} />
            <mesh geometry={boxM(0.07, 2.12, 0.015)} material={m.white} position={[-w / 2 - 0.035, 1.06, s * (t / 2 + 0.008)]} />
            <mesh geometry={boxM(0.07, 2.12, 0.015)} material={m.white} position={[w / 2 + 0.035, 1.06, s * (t / 2 + 0.008)]} />
          </group>
        ))}
        <group position={[-w / 2 + 0.02, 0, t / 2]} rotation-y={-Math.PI / 2}>
          <mesh geometry={boxM(leafW, leafH, 0.04)} material={m.oak} position={[leafW / 2, leafH / 2 + 0.01, 0.02]} castShadow />
          <mesh geometry={boxM(0.12, 0.02, 0.03)} material={m.blackSteel} position={[leafW - 0.1, 1.0, 0.06]} />
        </group>
      </>
    )
  }

  return (
    <group position={[x, floorY, z]} rotation-y={seg.rotY}>
      {parts}
    </group>
  )
}

/* ---------------- Floors & ceiling ---------------- */

function Floors() {
  const m = useMaterials()
  const { x0, x1, z0, z1 } = BOUNDS
  return (
    <group>
      {/* Structural deck under everything */}
      <mesh geometry={boxM(x1 - x0 - 0.02, 0.3, z1 - z0 - 0.02)} material={m.skirt} position={[0, floorY - 0.15, 0]} receiveShadow />
      {ROOMS_PLAN.map((room) => {
        const xs = room.poly.map((p) => p[0])
        const zs = room.poly.map((p) => p[1])
        const rx0 = Math.min(...xs)
        const rx1 = Math.max(...xs)
        const rz0 = Math.min(...zs)
        const rz1 = Math.max(...zs)
        return (
          <mesh
            key={room.id}
            geometry={boxM(rx1 - rx0, 0.01, rz1 - rz0)}
            material={room.floor === 'tile' ? m.tile : m.floor}
            position={[(rx0 + rx1) / 2, floorY + 0.005 + (room.floor === 'tile' ? 0.002 : 0), (rz0 + rz1) / 2]}
            receiveShadow
          />
        )
      })}
    </group>
  )
}

/** Ceiling with recessed downlights over the main rooms. */
const DOWNLIGHTS = [
  [-1.8, -2.4], [-0.2, -2.4], [-0.4, -1.4], [2.4, -1.2], [1.0, 1.4], [2.6, 1.4], [1.0, 3.0], [2.6, 3.0],
  [-6.3, 2.0], [-2.0, 2.0], [5.9, 2.0], [5.9, -0.8], [5.9, -2.9], [-6.5, -2.9], [-5.5, -0.9], [-3.5, -0.9],
]

function Ceiling() {
  const m = useMaterials()
  const { x0, x1, z0, z1 } = BOUNDS
  const y = floorY + ceiling
  return (
    <group>
      <mesh geometry={boxM(x1 - x0, 0.02, z1 - z0)} material={m.ceiling} position={[0, y + 0.01, 0]} receiveShadow />
      {DOWNLIGHTS.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, y - 0.001, z]} rotation-x={Math.PI / 2} material={m.downlight}>
          <circleGeometry args={[0.055, 20]} />
        </mesh>
      ))}
    </group>
  )
}

export function Shell() {
  return (
    <group>
      <Floors />
      <Ceiling />
      {EXTERIOR_WALLS.map((w) => (
        <Wall key={w.id} wall={w} exterior />
      ))}
      {INTERIOR_WALLS.map((w) => (
        <Wall key={w.id} wall={w} />
      ))}
    </group>
  )
}
