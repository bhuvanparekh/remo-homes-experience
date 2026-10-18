import { BoxGeometry } from 'three'

/**
 * Plan → 3D helpers. Pure functions; no React.
 *
 * Plan coordinates are [x, z] in metres (see config/floorplan.js).
 */

const cache = new Map()

/**
 * A box whose UVs are in metres on every face, so a texture set to repeat
 * once per N metres tiles at true scale whatever the box size. Cached by
 * dimension — the house reuses many identical boxes.
 */
export function boxM(w, h, d) {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`
  if (cache.has(key)) return cache.get(key)
  const g = new BoxGeometry(w, h, d)
  const uv = g.attributes.uv
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z — 4 vertices each.
  const faces = [
    [d, h], [d, h],
    [w, d], [w, d],
    [w, h], [w, h],
  ]
  faces.forEach(([su, sv], f) => {
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  })
  uv.needsUpdate = true
  cache.set(key, g)
  return g
}

/** Length, unit direction and Y rotation of a wall segment. */
export function segment(a, b) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const length = Math.hypot(dx, dz)
  return { length, dir: [dx / length, dz / length], rotY: -Math.atan2(dz, dx) }
}

/**
 * Split a wall into solid pieces around its openings.
 * Returns pieces in wall-local terms: { s0, s1, y0, y1 } where s runs along
 * the wall from `a`, y is height above the floor.
 */
export function wallPieces(length, height, openings) {
  const sorted = [...openings].sort((p, q) => p.at - q.at)
  const pieces = []
  let cursor = 0
  for (const o of sorted) {
    const s0 = o.at - o.width / 2
    const s1 = o.at + o.width / 2
    if (s0 > cursor + 0.001) pieces.push({ s0: cursor, s1: s0, y0: 0, y1: height })
    const sill = o.sill ?? 0
    const head = Math.min(o.head ?? 2.1, height)
    if (sill > 0.001) pieces.push({ s0, s1, y0: 0, y1: sill })
    if (head < height - 0.001) pieces.push({ s0, s1, y0: head, y1: height })
    cursor = s1
  }
  if (cursor < length - 0.001) pieces.push({ s0: cursor, s1: length, y0: 0, y1: height })
  return pieces
}

/** World position of a point `s` metres along a wall, offset `n` metres to its left. */
export function along(a, seg, s, n = 0) {
  return [a[0] + seg.dir[0] * s - seg.dir[1] * n, a[1] + seg.dir[1] * s + seg.dir[0] * n]
}
