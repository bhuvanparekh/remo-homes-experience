import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { BOUNDS, EXTERIOR_WALLS, HOUSE, INTERIOR_WALLS } from '../../config/floorplan.js'

/**
 * The steel frame inside the walls, for the X-ray view — ReMo's pitch is a
 * steel home built in a factory, so this is the one thing worth seeing
 * through the finishes.
 *
 * Generated from the same wall list as the shell: light-gauge studs at 610 mm
 * centres (24" o.c.), jamb studs and headers around every opening, top and
 * bottom tracks, roof joists across the short span and a perimeter chassis
 * beam under the floor. Indicative framing, not ReMo's engineering drawings.
 * One instanced mesh per member type.
 */

const SPACING = 0.61
const STUD = [0.04, 0.09] // flange × web, metres
const TRACK = 0.05
const INSET = HOUSE.extWall / 2

export const galv = new MeshStandardMaterial({ color: '#c4c9cd', metalness: 0.85, roughness: 0.38 })
const chassis = new MeshStandardMaterial({ color: '#5b6066', metalness: 0.7, roughness: 0.45 })
const unitBox = new BoxGeometry(1, 1, 1)

/** Pulls perimeter points in to the wall centreline. */
const inset = ([x, z]) => [
  Math.min(BOUNDS.x1 - INSET, Math.max(BOUNDS.x0 + INSET, x)),
  Math.min(BOUNDS.z1 - INSET, Math.max(BOUNDS.z0 + INSET, z)),
]

export function buildMembers() {
  const studs = []
  const beams = []
  const F = HOUSE.floorY
  const H = HOUSE.ceiling

  /** Member along a wall: centre at distance s, height y, size [along, tall, across]. */
  const add = (list, a, dir, rotY, s, y, size) =>
    list.push({ p: [a[0] + dir[0] * s, y, a[1] + dir[1] * s], rotY, size })

  for (const wall of [...EXTERIOR_WALLS, ...INTERIOR_WALLS]) {
    const a = inset(wall.a)
    const b = inset(wall.b)
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz)
    const dir = [dx / len, dz / len]
    const rotY = -Math.atan2(dz, dx)
    // Openings are measured from the unclipped wall start; shift by how far
    // the inset moved that start along the wall.
    const shift = (a[0] - wall.a[0]) * dir[0] + (a[1] - wall.a[1]) * dir[1]
    const holes = wall.openings.map((o) => {
      const at = o.at - shift
      return { s0: at - o.width / 2 - 0.03, s1: at + o.width / 2 + 0.03, sill: o.sill ?? 0, head: o.head ?? 2.1 }
    })
    const inHole = (s) => holes.some((h) => s > h.s0 - 0.02 && s < h.s1 + 0.02)

    // Field studs, plus a stud at each end of the wall.
    for (let s = 0; s <= len + 0.001; s += SPACING) if (!inHole(s)) add(studs, a, dir, rotY, s, F + H / 2, [STUD[0], H, STUD[1]])
    if (!inHole(len)) add(studs, a, dir, rotY, len, F + H / 2, [STUD[0], H, STUD[1]])

    // Top and bottom tracks.
    add(beams, a, dir, rotY, len / 2, F + TRACK / 2, [len, TRACK, STUD[1] + 0.01])
    add(beams, a, dir, rotY, len / 2, F + H - TRACK / 2, [len, TRACK, STUD[1] + 0.01])

    // Jamb studs, header and sill around each opening; cripples above.
    for (const h of holes) {
      for (const s of [h.s0, h.s1]) add(studs, a, dir, rotY, s, F + H / 2, [STUD[0] * 2, H, STUD[1]])
      add(beams, a, dir, rotY, (h.s0 + h.s1) / 2, F + h.head + 0.1, [h.s1 - h.s0, 0.2, STUD[1]])
      if (h.sill > 0) add(beams, a, dir, rotY, (h.s0 + h.s1) / 2, F + h.sill - TRACK / 2, [h.s1 - h.s0, TRACK, STUD[1]])
      const above = H - h.head - 0.2
      if (above > 0.05) {
        for (let s = h.s0 + SPACING / 2; s < h.s1 - 0.1; s += SPACING / 2) add(studs, a, dir, rotY, s, F + h.head + 0.2 + above / 2, [STUD[0], above, STUD[1]])
      }
      if (h.sill > 0.1) {
        for (let s = h.s0 + SPACING / 2; s < h.s1 - 0.1; s += SPACING / 2) add(studs, a, dir, rotY, s, F + h.sill / 2, [STUD[0], h.sill - TRACK, STUD[1]])
      }
    }
  }

  // Roof joists across the 8 m span, sitting on the top tracks.
  const span = BOUNDS.z1 - BOUNDS.z0 - INSET * 2
  for (let x = BOUNDS.x0 + INSET; x <= BOUNDS.x1 - INSET + 0.001; x += SPACING) {
    studs.push({ p: [x, F + H + 0.1, 0], rotY: 0, size: [0.05, 0.2, span] })
  }

  // Perimeter chassis beam under the floor.
  const W = BOUNDS.x1 - BOUNDS.x0 - INSET * 2
  const D = BOUNDS.z1 - BOUNDS.z0 - INSET * 2
  const frame = [
    { p: [0, F - 0.15, BOUNDS.z0 + INSET], rotY: 0, size: [W, 0.25, 0.15] },
    { p: [0, F - 0.15, BOUNDS.z1 - INSET], rotY: 0, size: [W, 0.25, 0.15] },
    { p: [BOUNDS.x0 + INSET, F - 0.15, 0], rotY: 0, size: [0.15, 0.25, D] },
    { p: [BOUNDS.x1 - INSET, F - 0.15, 0], rotY: 0, size: [0.15, 0.25, D] },
  ]
  return { studs, beams, frame }
}

export function Members({ items, material }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const m = new Matrix4()
    const q = new Quaternion()
    const e = new Euler()
    const p = new Vector3()
    const s = new Vector3()
    items.forEach((it, i) => {
      q.setFromEuler(e.set(0, it.rotY, 0))
      m.compose(p.set(...it.p), q, s.set(...it.size))
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[unitBox, material, items.length]} frustumCulled={false} />
}

export function SteelFrame({ visible }) {
  const { studs, beams, frame } = useMemo(buildMembers, [])
  return (
    <group visible={visible}>
      <Members items={studs} material={galv} />
      <Members items={beams} material={galv} />
      <Members items={frame} material={chassis} />
    </group>
  )
}
