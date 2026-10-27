/**
 * The largest building the setbacks and height limit allow, as a solid:
 *
 *   footprint  the lot pulled in from each edge by that edge's setback
 *   height     the zone's height limit, straight up from the footprint
 *   plane      R1-style encroachment plane: from a set height above the
 *              front / side setback lines, sloping inwards at 45°
 *
 * Pure maths, no three.js: metres in the lot's local frame (x = east,
 * y = north, z = up). Works on convex lots, which is nearly every LA lot;
 * for other shapes it returns null and the report says so.
 */

const FT = 0.3048

/** Keep the part of a polygon where (p − o)·m ≥ d (Sutherland–Hodgman). */
function clipHalf(poly, o, m, d) {
  const val = (p) => (p[0] - o[0]) * m[0] + (p[1] - o[1]) * m[1] - d
  const out = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const vp = val(p)
    const vq = val(q)
    if (vp >= 0) out.push(p)
    if (vp >= 0 !== vq >= 0) {
      const t = vp / (vp - vq)
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
    }
  }
  return out
}

const polyArea = (pts) => {
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  return Math.abs(a) / 2
}

/**
 * The buildable footprint: the lot minus its required yards.
 * `setbackM(edge)` gives each edge's yard in metres.
 */
export function footprint(sides, setbackM) {
  let poly = sides.pts
  for (const e of sides.edges) {
    const s = setbackM(e)
    poly = clipHalf(poly, e.a, [-e.n[0], -e.n[1]], s)
    if (poly.length < 3) return null
  }
  return poly
}

/* ---------- Convex solid clipping ---------- */

/** Keep the part of a 3D polygon where A·p ≤ D; also return the cut points. */
function clipFace(face, A, D) {
  const val = (p) => A[0] * p[0] + A[1] * p[1] + A[2] * p[2] - D
  const out = []
  const cut = []
  for (let i = 0; i < face.length; i++) {
    const p = face[i]
    const q = face[(i + 1) % face.length]
    const vp = val(p)
    const vq = val(q)
    if (vp <= 1e-9) out.push(p)
    if (vp <= 1e-9 !== vq <= 1e-9) {
      const t = vp / (vp - vq)
      const x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]
      out.push(x)
      cut.push(x)
    }
  }
  return { out, cut }
}

/** Order points lying on one plane around their centre. */
function ringOnPlane(points, A) {
  const uniq = []
  for (const p of points) if (!uniq.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-6)) uniq.push(p)
  if (uniq.length < 3) return null
  const c = uniq.reduce((s, p) => [s[0] + p[0] / uniq.length, s[1] + p[1] / uniq.length, s[2] + p[2] / uniq.length], [0, 0, 0])
  // Any two axes on the plane.
  const n = A
  const ref = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
  const u = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]]
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]
  const ang = (p) => {
    const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
    return Math.atan2(d[0] * v[0] + d[1] * v[1] + d[2] * v[2], d[0] * u[0] + d[1] * u[1] + d[2] * u[2])
  }
  return uniq.sort((a, b) => ang(a) - ang(b))
}

/** Cut a convex solid (list of faces) by the half-space A·p ≤ D. */
function clipSolid(faces, A, D) {
  const next = []
  const cuts = []
  for (const f of faces) {
    const { out, cut } = clipFace(f, A, D)
    if (out.length >= 3) next.push(out)
    cuts.push(...cut)
  }
  const cap = ringOnPlane(cuts, A)
  if (cap) next.push(cap)
  return next
}

/**
 * The envelope solid.
 *   rules.setbackFt(edge)  yard for an edge, in feet
 *   rules.heightFt         height limit
 *   rules.plane            { originFt, kinds: ['front', 'side', …] } or null
 * Returns { footprint, footprintSqft, faces } or null.
 */
export function envelope(sides, { setbackFt, heightFt, plane = null }) {
  if (!sides?.convex || !(heightFt > 0)) return null
  const base = footprint(sides, (e) => setbackFt(e) * FT)
  if (!base) return null
  const H = heightFt * FT

  let faces = [
    base.map(([x, y]) => [x, y, 0]).reverse(),
    base.map(([x, y]) => [x, y, H]),
    ...base.map((p, i) => {
      const q = base[(i + 1) % base.length]
      return [
        [p[0], p[1], 0],
        [q[0], q[1], 0],
        [q[0], q[1], H],
        [p[0], p[1], H],
      ]
    }),
  ]

  if (plane) {
    const z0 = plane.originFt * FT
    for (const e of sides.edges) {
      if (!plane.kinds.includes(e.kind)) continue
      // Height allowed rises 1:1 (45°) with distance in from this edge's setback line:
      // z ≤ z0 + (inward distance − setback)  ⇔  n·p + z ≤ z0 − setback + n·a
      const s = setbackFt(e) * FT
      const A = [e.n[0], e.n[1], 1]
      const D = z0 - s + e.n[0] * e.a[0] + e.n[1] * e.a[1]
      faces = clipSolid(faces, A, D)
      if (!faces.length) return null
    }
  }

  // Where to hang the label: the top corner nearest the street.
  const verts = faces.flat()
  const top = Math.max(...verts.map((p) => p[2]))
  const n = sides.frontNormal
  const labelAt = verts.filter((p) => p[2] > top - 0.01).sort((a, b) => b[0] * n[0] + b[1] * n[1] - (a[0] * n[0] + a[1] * n[1]))[0]

  return { footprint: base, footprintSqft: polyArea(base) / (FT * FT), faces, topM: top, labelAt }
}
