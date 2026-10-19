import { DEPTH } from './generator.js'

/**
 * From a generated plan's rooms to buildable walls, in exactly the format the
 * SupReMo's own floorplan.js uses (segments `a`→`b` with openings at `at`
 * metres from `a`), so the main site's wall and window code builds both.
 *
 * Rules, in plain terms:
 *   - Living, kitchen, dining and hall flow into each other: no walls there.
 *   - Every other room gets one way in, from the best neighbour on its list
 *     (bedrooms from the hall, the walk-in from the primary bedroom, …).
 *   - Windows follow ReMo's elevations: tall narrow ones for rooms you live
 *     in, high strip windows for baths and laundry, glass doors to the decks.
 */

const EXT = 0.2 // exterior wall thickness (as floorplan.js)
const EPS = 0.01

const TALL = { sill: 0.35, head: 2.35 }
const HIGH = { sill: 1.6, head: 2.2 }
const DOOR = { sill: 0, head: 2.35 }

export const OPEN_PLAN = new Set(['living', 'kitchen', 'dining', 'hall'])

/** Where each kind of room is entered from, best first. */
const ACCESS = {
  bedroom: ['hall', 'living', 'kitchen', 'dining'],
  office: ['hall', 'living', 'kitchen', 'dining'],
  bath: ['hall', 'living', 'kitchen', 'dining'],
  laundry: ['hall', 'kitchen', 'living', 'dining'],
  storage: ['hall', 'kitchen', 'living', 'dining'],
  primary: ['living', 'hall', 'dining', 'kitchen'],
  closet: ['primary'],
  ensuite: ['closet', 'primary'],
}

/** The front door sits toward the primary-suite end of the living room. */
export const frontDoorX = (living) => Math.max(living.x0 + 1.4, living.x1 - 1.4)

/** Shared edge between two rooms, if they touch along more than a sliver. */
export function sharedEdge(a, b) {
  const overlap = (p0, p1, q0, q1) => [Math.max(p0, q0), Math.min(p1, q1)]
  if (Math.abs(a.x1 - b.x0) < EPS || Math.abs(b.x1 - a.x0) < EPS) {
    const x = Math.abs(a.x1 - b.x0) < EPS ? a.x1 : a.x0
    const [s0, s1] = overlap(a.z0, a.z1, b.z0, b.z1)
    if (s1 - s0 > 0.05) return { axis: 'z', at: x, s0, s1 }
  }
  if (Math.abs(a.z1 - b.z0) < EPS || Math.abs(b.z1 - a.z0) < EPS) {
    const z = Math.abs(a.z1 - b.z0) < EPS ? a.z1 : a.z0
    const [s0, s1] = overlap(a.x0, a.x1, b.x0, b.x1)
    if (s1 - s0 > 0.05) return { axis: 'x', at: z, s0, s1 }
  }
  return null
}

/** Door centre on an edge: near the end closest to the middle of the house. */
function doorCentre(edge, width) {
  const nearStart = Math.abs(edge.s0) < Math.abs(edge.s1)
  const inset = 0.42 + width / 2
  const c = nearStart ? edge.s0 + inset : edge.s1 - inset
  return Math.min(Math.max(c, edge.s0 + width / 2 + 0.05), edge.s1 - width / 2 - 0.05)
}

export function buildHouse(house, spec) {
  const { rooms, length: L } = house
  const D = DEPTH
  const X0 = -L / 2
  const X1 = L / 2
  const Z0 = -D / 2
  const Z1 = D / 2
  const byId = Object.fromEntries(rooms.map((r) => [r.id, r]))

  /* ---------- Doors between rooms ---------- */

  const pairs = []
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const edge = sharedEdge(rooms[i], rooms[j])
      if (edge) pairs.push({ a: rooms[i], b: rooms[j], edge, door: null })
    }
  }
  const pairOf = (p, q) => pairs.find((x) => (x.a === p && x.b === q) || (x.a === q && x.b === p))

  /** For the furniture: which wall each room's door is on, and where. */
  const doors = {}
  for (const r of rooms) {
    const wants = ACCESS[r.kind]
    if (!wants) continue
    for (const kind of wants) {
      const options = pairs.filter((p) => (p.a === r || p.b === r) && (p.a === r ? p.b : p.a).kind === kind)
      const best = options.sort((p, q) => q.edge.s1 - q.edge.s0 - (p.edge.s1 - p.edge.s0))[0]
      if (!best || best.edge.s1 - best.edge.s0 < 1.0) continue
      const open = r.kind === 'closet' && kind === 'primary'
      const width = open ? Math.min(1.1, best.edge.s1 - best.edge.s0 - 0.4) : r.kind === 'primary' ? 0.85 : 0.8
      const at = doorCentre(best.edge, width)
      best.door = { kind: open ? 'open' : 'interior', at, width }
      doors[r.id] = { edge: best.edge, at, width, open, to: (best.a === r ? best.b : best.a).id }
      break
    }
  }

  /* ---------- Interior walls ---------- */

  // Interior walls stop at the inside face of the exterior walls.
  const trimEnd = (axis, s) => {
    const lo = axis === 'x' ? X0 : Z0
    const hi = axis === 'x' ? X1 : Z1
    if (Math.abs(s - lo) < EPS) return s + EXT
    if (Math.abs(s - hi) < EPS) return s - EXT
    return s
  }

  const interiorWalls = []
  for (const p of pairs) {
    if (OPEN_PLAN.has(p.a.kind) && OPEN_PLAN.has(p.b.kind)) continue
    const { axis, at, s0, s1 } = p.edge
    const t0 = trimEnd(axis, s0)
    const t1 = trimEnd(axis, s1)
    const a = axis === 'x' ? [t0, at] : [at, t0]
    const b = axis === 'x' ? [t1, at] : [at, t1]
    const openings = p.door ? [{ id: `d-${p.a.id}-${p.b.id}`, kind: p.door.kind, at: p.door.at - t0, width: p.door.width }] : []
    interiorWalls.push({ id: `w-${p.a.id}-${p.b.id}`, a, b, openings })
  }

  /* ---------- Exterior walls and their openings ---------- */

  const south = []
  const north = []
  const west = []
  const east = []
  const add = (list, room, s0, s1, o) => {
    // Keep every opening clear of the room's own walls.
    const half = o.width / 2
    const c = Math.min(Math.max(o.c, s0 + half + 0.3), s1 - half - 0.3)
    if (s1 - s0 < o.width + 0.5) return
    list.push({ ...o, c, id: `${room.id}-${list.length}` })
  }

  const living = byId.living
  for (const r of rooms) {
    const cx = (r.x0 + r.x1) / 2
    const cz = (r.z0 + r.z1) / 2
    const onFront = Math.abs(r.z1 - Z1) < EPS
    const onBack = Math.abs(r.z0 - Z0) < EPS
    const onWest = Math.abs(r.x0 - X0) < EPS
    const onEast = Math.abs(r.x1 - X1) < EPS
    const k = r.kind

    if (onFront) {
      if (k === 'living') {
        const dx = frontDoorX(living)
        add(south, r, r.x0, r.x1, { kind: 'glassDoor', c: dx, width: 1.8, ...DOOR, open: true })
        // A tall window in the bigger stretch of wall left over.
        const leftGap = dx - 0.9 - r.x0
        const rightGap = r.x1 - (dx + 0.9)
        if (leftGap > 1.6) add(south, r, r.x0, dx - 0.9, { kind: 'window', c: r.x0 + leftGap / 2, width: 0.85, ...TALL })
        else if (rightGap > 1.6) add(south, r, dx + 0.9, r.x1, { kind: 'window', c: dx + 0.9 + rightGap / 2, width: 0.85, ...TALL })
      } else if (['bedroom', 'primary', 'office'].includes(k)) {
        add(south, r, r.x0, r.x1, { kind: 'window', c: cx, width: k === 'primary' ? 1.2 : 0.85, ...TALL })
      }
    }

    if (onBack) {
      if (k === 'kitchen') add(north, r, r.x0, r.x1, { kind: 'window', c: cx, width: 0.9, sill: 1.05, head: 2.35 })
      else if (k === 'dining') {
        if (spec.backDeck) add(north, r, r.x0, r.x1, { kind: 'glassDoor', c: cx, width: 1.8, ...DOOR })
        else add(north, r, r.x0, r.x1, { kind: 'window', c: cx, width: 1.2, ...TALL })
      } else if (['bath', 'ensuite', 'laundry'].includes(k)) {
        add(north, r, r.x0, r.x1, { kind: 'window', c: cx, width: Math.min(0.9, r.x1 - r.x0 - 0.9), ...HIGH })
      } else if (['office', 'bedroom'].includes(k)) {
        add(north, r, r.x0, r.x1, { kind: 'window', c: cx, width: 0.85, ...TALL })
      }
    }

    for (const [on, list] of [
      [onWest, west],
      [onEast, east],
    ]) {
      if (!on) continue
      if (['bedroom', 'primary', 'office', 'living', 'kitchen', 'dining'].includes(k)) {
        add(list, r, r.z0, r.z1, { kind: 'window', c: cz, width: 0.7, sill: 0.6, head: 2.35 })
      } else if (['bath', 'ensuite'].includes(k)) {
        add(list, r, r.z0, r.z1, { kind: 'window', c: cz, width: 0.7, ...HIGH })
      } else if (k === 'hall') {
        add(list, r, r.z0, r.z1, { kind: 'window', c: cz, width: Math.min(0.85, r.z1 - r.z0 - 0.3), ...TALL })
      }
    }
  }

  const toOpenings = (list, origin) => list.map(({ c, ...o }) => ({ ...o, at: c - origin }))
  const exteriorWalls = [
    { id: 'south', a: [X0, Z1], b: [X1, Z1], openings: toOpenings(south, X0) },
    { id: 'north', a: [X0, Z0], b: [X1, Z0], openings: toOpenings(north, X0) },
    { id: 'west', a: [X0, Z0], b: [X0, Z1], openings: toOpenings(west, Z0) },
    { id: 'east', a: [X1, Z0], b: [X1, Z1], openings: toOpenings(east, Z0) },
  ]

  return { exteriorWalls, interiorWalls, doors, bounds: { x0: X0, x1: X1, z0: Z0, z1: Z1 } }
}
