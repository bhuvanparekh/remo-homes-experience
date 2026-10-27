import { queryEnvelope } from '../data/arcgis.js'
import { localFrame } from '../data/lotGeometry.js'
import { LAYERS } from '../data/sources.js'

/**
 * Which edge of a lot is the front, which are the sides and which is the rear.
 *
 * Setbacks depend on it, and no public layer says it directly, so it is
 * measured: from the middle of each edge we step outwards and see how far it
 * is to the next lot (LA County Assessor parcels, read live).
 *
 *   another lot right there      → a shared line with a neighbour (side / rear)
 *   a gap of roughly 2–9 m       → an alley (alleys are typically 15–20 ft)
 *   a wider gap, or none at all  → a street
 *
 * The front is the street edge. On a corner lot we take the shorter street
 * edge (the usual convention — not verified against LA's code text, so the
 * report asks the visitor to confirm); the other street edge is treated as
 * a side yard on the street. Everything is in metres in a flat frame centred on the
 * lot (x = east, y = north) — the same frame as the 3D site model.
 */

const FT = 0.3048
const PROBES = [0.8, 1.6, 3, 4.5, 6, 7.5, 9, 11, 14, 18, 24]
const ALLEY_MAX = 9.5 // metres between lot lines; wider than this is a street
const SHARED_MAX = 1.7

const area2 = (pts) => {
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  return a
}

function inside([x, y], pts) {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** Drop the closing point and points closer than 5 cm; make it anticlockwise. */
export function cleanRing(ring) {
  const out = []
  for (const p of ring) {
    const q = out[out.length - 1]
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) out.push(p)
  }
  if (out.length > 2 && Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) < 0.05) out.pop()
  return area2(out) < 0 ? out.reverse() : out
}

/** Merge runs of nearly-straight edges (curb curves, survey jitter) into one. */
function simplify(pts, degrees = 8) {
  const tol = Math.sin((degrees * Math.PI) / 180)
  let cur = pts
  for (let changed = true; changed && cur.length > 3; ) {
    changed = false
    for (let i = 0; i < cur.length; i++) {
      const a = cur[(i - 1 + cur.length) % cur.length]
      const b = cur[i]
      const c = cur[(i + 1) % cur.length]
      const ux = b[0] - a[0]
      const uy = b[1] - a[1]
      const vx = c[0] - b[0]
      const vy = c[1] - b[1]
      const lu = Math.hypot(ux, uy)
      const lv = Math.hypot(vx, vy)
      const cross = (ux * vy - uy * vx) / (lu * lv)
      const dot = ux * vx + uy * vy
      if (dot > 0 && Math.abs(cross) < tol) {
        cur = cur.filter((_, k) => k !== i)
        changed = true
        break
      }
    }
  }
  return cur
}

/** Is the (anticlockwise) polygon convex, allowing for tiny wobbles? */
export function isConvex(pts) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const c = pts[(i + 2) % pts.length]
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1])
    if (cross / l < -0.06) return false
  }
  return true
}

/** How far out from point p along n until the next lot (∞ if none in range). */
function gapAt(p, n, neighbours) {
  for (const d of PROBES) {
    const q = [p[0] + n[0] * d, p[1] + n[1] * d]
    if (neighbours.some((r) => r.box[0] <= q[0] && q[0] <= r.box[2] && r.box[1] <= q[1] && q[1] <= r.box[3] && inside(q, r.pts)))
      return d
  }
  return Infinity
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/**
 * Edges of the lot with what is beyond each one, then grouped into "sides"
 * by direction (a curved or kinked frontage stays one side).
 */
function classifyEdges(pts, neighbours) {
  const edges = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    // Anticlockwise ring: outward normal is to the right of a→b.
    const n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len]
    const gaps = [0.25, 0.5, 0.75].map((t) => gapAt([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], n, neighbours))
    const gap = median(gaps)
    edges.push({ i, a, b, len, n, gap, beyond: gap <= SHARED_MAX ? 'lot' : gap <= ALLEY_MAX ? 'alley' : 'street' })
  }

  // Group consecutive edges facing within ~35° of each other into sides.
  const sides = []
  for (const e of edges) {
    const last = sides[sides.length - 1]
    if (last && last.n[0] * e.n[0] + last.n[1] * e.n[1] > 0.82 && last.beyond === e.beyond) {
      last.edges.push(e)
      last.len += e.len
      const nx = last.n[0] * (last.len - e.len) + e.n[0] * e.len
      const ny = last.n[1] * (last.len - e.len) + e.n[1] * e.len
      const l = Math.hypot(nx, ny)
      last.n = [nx / l, ny / l]
    } else sides.push({ edges: [e], len: e.len, n: e.n, beyond: e.beyond })
  }
  // The ring's first and last sides may be one side split by where it starts.
  if (sides.length > 1) {
    const f = sides[0]
    const l = sides[sides.length - 1]
    if (f.n[0] * l.n[0] + f.n[1] * l.n[1] > 0.82 && f.beyond === l.beyond) {
      l.edges.push(...f.edges)
      l.len += f.len
      sides.shift()
    }
  }
  // Short pieces (a rounded street corner) join whichever neighbour they
  // face most nearly, so they don't count as sides of their own.
  for (let k = sides.length - 1; k >= 0 && sides.length > 3; k--) {
    const s = sides[k]
    if (s.len >= 3) continue
    const prev = sides[(k - 1 + sides.length) % sides.length]
    const next = sides[(k + 1) % sides.length]
    const dp = prev.n[0] * s.n[0] + prev.n[1] * s.n[1]
    const dn = next.n[0] * s.n[0] + next.n[1] * s.n[1]
    const into = dp >= dn ? prev : next
    into.edges.push(...s.edges)
    into.len += s.len
    sides.splice(k, 1)
  }
  return { edges, sides }
}

/** Width and depth of the lot measured against its front. */
function measure(pts, n) {
  const t = [-n[1], n[0]]
  const along = pts.map((p) => p[0] * t[0] + p[1] * t[1])
  const into = pts.map((p) => p[0] * n[0] + p[1] * n[1])
  return { width: Math.max(...along) - Math.min(...along), depth: Math.max(...into) - Math.min(...into) }
}

/**
 * Work out the lot's sides. Returns metres in the lot's local frame:
 *   pts      simplified outline (anticlockwise)
 *   edges[]  { a, b, len, n (outward), kind: front | rear | side | streetSide, beyond }
 *   widthFt / depthFt measured against the front
 *   corner / through / alley flags, and `sure` = whether a street was found
 */
export async function lotSides(parcel, { signal } = {}) {
  const frame = localFrame(parcel.centre[0], parcel.centre[1])
  const pts = simplify(cleanRing(parcel.ring.map(frame.toXY)))

  // Every lot within 30 m.
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const pad = 30
  const [w, s] = frame.toLngLat([Math.min(...xs) - pad, Math.min(...ys) - pad])
  const [e, n] = frame.toLngLat([Math.max(...xs) + pad, Math.max(...ys) + pad])
  const feats = await queryEnvelope(LAYERS.countyParcel.url, [w, s, e, n], { fields: 'AIN', signal, timeout: 15000 })
  const neighbours = []
  for (const f of feats) {
    if (String(f.attributes.AIN) === String(parcel.ain) || !f.geometry?.rings) continue
    for (const r of f.geometry.rings) {
      const rp = r.map(frame.toXY)
      const rx = rp.map((p) => p[0])
      const ry = rp.map((p) => p[1])
      neighbours.push({ pts: rp, box: [Math.min(...rx), Math.min(...ry), Math.max(...rx), Math.max(...ry)] })
    }
  }

  return sidesFrom(pts, neighbours)
}

/** The pure part of lotSides, given the outline and neighbouring lots. */
export function sidesFrom(pts, neighbours) {
  const { edges, sides } = classifyEdges(pts, neighbours)
  const streets = sides.filter((s) => s.beyond === 'street')
  const sure = streets.length > 0

  // Front: the street side. Corner lot → the shorter street side.
  // Through lot (streets on opposite sides) → the wider street, flagged.
  // No street found (e.g. a flag lot) → the side with the widest gap.
  let front
  let corner = false
  let through = false
  if (streets.length === 1) front = streets[0]
  else if (streets.length > 1) {
    const byLen = [...streets].sort((a, b) => a.len - b.len)
    const meets = (s) => streets.some((o) => o !== s && o.n[0] * s.n[0] + o.n[1] * s.n[1] > -0.7)
    const cornerSide = byLen.find(meets)
    if (cornerSide) {
      corner = true
      front = cornerSide
    } else {
      through = true
      const gapOf = (s) => median(s.edges.map((e) => e.gap))
      front = [...byLen].sort((a, b) => gapOf(b) - gapOf(a))[0]
    }
  } else {
    const gapOf = (s) => Math.max(...s.edges.map((e) => e.gap))
    front = [...sides].sort((a, b) => gapOf(b) - gapOf(a) || b.len - a.len)[0]
  }

  // Rear: the side facing most directly away from the front.
  const rear = sides
    .filter((s) => s !== front)
    .map((s) => ({ s, dot: s.n[0] * front.n[0] + s.n[1] * front.n[1] }))
    .sort((a, b) => a.dot - b.dot)[0]
  const rearSide = rear && rear.dot < -0.5 ? rear.s : null

  for (const s of sides) {
    // A through lot's far street edge is drawn as the rear; the report flags
    // through lots, since yards there need a City check.
    const kind = s === front ? 'front' : s === rearSide ? 'rear' : s.beyond === 'street' ? 'streetSide' : 'side'
    for (const e of s.edges) e.kind = kind
  }
  const { width, depth } = measure(pts, front.n)

  return {
    pts,
    edges: edges.map(({ a, b, len, n, kind, beyond, gap }) => ({ a, b, len, n, kind, beyond, gap })),
    frontNormal: front.n,
    widthFt: width / FT,
    depthFt: depth / FT,
    frontageFt: front.len / FT,
    corner,
    through,
    alley: Boolean(rearSide && rearSide.beyond === 'alley'),
    convex: isConvex(pts),
    sure,
  }
}
