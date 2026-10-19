import { DEPTH, FLOOR_Y } from './generator.js'
import { frontDoorX, OPEN_PLAN, sharedEdge } from './houseModel.js'

/**
 * The walkthrough of a generated house: from the front porch, in through the
 * front door, then room by room through real doorways (never through a wall),
 * pausing in each room at a corner view.
 *
 * The route is a depth-first walk of the room graph — doors plus the open
 * living/kitchen/dining/hall connections — visiting the kitchen and dining
 * first, the sleeping wing next and the primary suite last. Every leg runs
 * between two points inside one rectangular room, so a straight line between
 * them can't leave that room.
 *
 * Output is in house-local metres; the scene converts to lot coordinates.
 */

const EYE = FLOOR_Y + 1.55
const LOOK_Y = FLOOR_Y + 1.0
const SPEED = 1.2 // m/s, an unhurried walk
const HOLD = 3.6 // seconds at each room
const STEP = 0.55 // how far either side of a doorway the path passes

/** Visiting order, best first. */
const ORDER = ['kitchen', 'dining', 'hall', 'bedroom', 'office', 'bath', 'laundry', 'storage', 'primary', 'closet', 'ensuite']

/** What each stop shows. Describes this sketch — not a ReMo specification. */
function blurb(room, spec) {
  switch (room.kind) {
    case 'living':
      return 'The front door opens straight into it, with the kitchen and dining beyond.'
    case 'kitchen':
      return 'Island seating, an induction hob and cabinetry to the ceiling.'
    case 'dining':
      return spec.backDeck ? 'Glass doors open onto the back deck.' : 'Room for six, next to the kitchen.'
    case 'primary':
      return 'King bed, an armchair, and the walk-in closet through the back.'
    case 'bedroom':
      return 'Queen bed, a wardrobe and a tall window.'
    case 'office':
      return 'A desk under the window and shelves on the wall.'
    case 'bath':
      return 'Tub, vanity and a high window for privacy.'
    case 'ensuite':
      return 'Walk-in shower and vanity, reached through the closet.'
    case 'laundry':
      return 'Washer, dryer and a folding counter.'
    case 'closet':
      return 'Hanging rails down both sides.'
    default:
      return ''
  }
}

const centre = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]

/** A point on a shared edge, and the points just inside each of the two rooms. */
function crossing(edge, at, from, to) {
  const p = edge.axis === 'x' ? [at, edge.at] : [edge.at, at]
  const step = (room) => {
    const c = centre(room)
    return edge.axis === 'x' ? [p[0], p[1] + Math.sign(c[1] - p[1]) * STEP] : [p[0] + Math.sign(c[0] - p[0]) * STEP, p[1]]
  }
  return { at: p, out: step(from), in: step(to) }
}

/** Rooms small enough that the best view is from just inside the door. */
const STEP_IN = new Set(['bedroom', 'office', 'bath', 'ensuite', 'laundry', 'closet'])

/**
 * Where to stand in a room and what to look at.
 *   small rooms   a step in from the door, looking across the room
 *   kitchen       from the living-room side, facing the counters
 *   living        a few steps in from the front door, looking toward the TV and kitchen
 *   others        the corner nearest the way in, looking across
 */
function viewFor(room, entry, doorPoint, house) {
  const c = centre(room)
  const w = room.x1 - room.x0
  const d = room.z1 - room.z0

  if (room.kind === 'living') {
    return {
      pos: [Math.min(entry[0], room.x1 - 0.9), room.z1 - 1.55],
      look: [room.x0 + w * 0.12, room.z0 - 0.6],
    }
  }
  if (room.kind === 'kitchen') {
    const living = house.rooms.find((r) => r.kind === 'living')
    const x = Math.min(Math.max(c[0], living.x0 + 0.8), living.x1 - 0.8)
    return { pos: [x, room.z1 + 1.25], look: [c[0], room.z0 + 0.4] }
  }
  if (STEP_IN.has(room.kind) && doorPoint) {
    const nx = entry[0] - doorPoint[0]
    const nz = entry[1] - doorPoint[1]
    const n = Math.hypot(nx, nz) || 1
    const depth = Math.abs(nx) > Math.abs(nz) ? w : d
    const go = Math.min(0.75, depth * 0.25)
    const pos = [entry[0] + (nx / n) * go, entry[1] + (nz / n) * go]
    // Mostly straight ahead to the far wall, drawn a little toward the middle.
    const far = [pos[0] + (nx / n) * (depth - go - 0.5), pos[1] + (nz / n) * (depth - go - 0.5)]
    const diag = [c[0] + (c[0] - pos[0]) * 0.6, c[1] + (c[1] - pos[1]) * 0.6]
    return { pos, look: [far[0] * 0.65 + diag[0] * 0.35, far[1] * 0.65 + diag[1] * 0.35] }
  }

  const inset = Math.min(0.9, Math.max(0.5, Math.min(w, d) * 0.2))
  const corners = [
    [room.x0 + inset, room.z0 + inset],
    [room.x1 - inset, room.z0 + inset],
    [room.x0 + inset, room.z1 - inset],
    [room.x1 - inset, room.z1 - inset],
  ]
  const dist = (p) => Math.hypot(p[0] - entry[0], p[1] - entry[1])
  const pos = corners.reduce((a, b) => (dist(b) < dist(a) ? b : a))
  const opp = [2 * c[0] - pos[0], 2 * c[1] - pos[1]]
  return { pos, look: [c[0] + (opp[0] - c[0]) * 0.55, c[1] + (opp[1] - c[1]) * 0.55] }
}

export function buildTour(plan, model) {
  const { house, spec } = plan
  const rooms = house.rooms
  const byId = Object.fromEntries(rooms.map((r) => [r.id, r]))
  const D = DEPTH

  // Room graph: every door, plus open-plan neighbours (crossed mid-edge).
  const links = new Map(rooms.map((r) => [r.id, []]))
  for (const [id, door] of Object.entries(model.doors)) {
    links.get(id).push({ to: door.to, edge: door.edge, at: door.at })
    links.get(door.to).push({ to: id, edge: door.edge, at: door.at })
  }
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]
      const b = rooms[j]
      if (!OPEN_PLAN.has(a.kind) || !OPEN_PLAN.has(b.kind)) continue
      const edge = sharedEdge(a, b)
      if (!edge || edge.s1 - edge.s0 < 0.9) continue
      const at = (edge.s0 + edge.s1) / 2
      links.get(a.id).push({ to: b.id, edge, at })
      links.get(b.id).push({ to: a.id, edge, at })
    }
  }

  const rank = (id) => {
    const r = byId[id]
    const k = ORDER.indexOf(r.kind)
    return (k < 0 ? 99 : k) * 100 + (r.x0 + house.length / 2)
  }

  // Path in 2D plan points, with holds marked.
  const path = [] // { p:[x,z], hold?: stop index }
  const stops = []

  // Start on the porch, facing the front door.
  const living = byId.living
  const dx = frontDoorX(living)
  path.push({ p: [dx, D / 2 + 2.6] })
  stops.push({
    id: 'porch',
    name: 'Front door',
    text: spec.frontDeck ? 'Three steps up to the porch and a pair of glass doors.' : 'A pair of glass doors, straight into the living room.',
    pos: [dx, D / 2 + 2.6],
    look: [dx, D / 2],
    lookY: FLOOR_Y + 1.25,
    room: null,
  })
  path.push({ p: [dx, D / 2 + 2.6], hold: 0 })
  path.push({ p: [dx, D / 2 + 0.3] })
  path.push({ p: [dx, D / 2 - STEP] })

  const visited = new Set()
  const visit = (id, entry, doorPoint) => {
    visited.add(id)
    const r = byId[id]
    const isStop = !['hall', 'storage'].includes(r.kind)
    let here = entry
    if (isStop) {
      const v = viewFor(r, entry, doorPoint, house)
      const index = stops.length
      stops.push({
        id: r.id,
        name: r.name,
        text: blurb(r, spec),
        area: Math.round(((r.x1 - r.x0) * (r.z1 - r.z0)) / 0.0929),
        pos: v.pos,
        look: v.look,
        lookY: LOOK_Y,
        room: r.id,
      })
      path.push({ p: v.pos })
      path.push({ p: v.pos, hold: index })
      here = v.pos
    }
    const next = links
      .get(id)
      .filter((l) => !visited.has(l.to))
      .sort((a, b) => rank(a.to) - rank(b.to))
    for (const l of next) {
      if (visited.has(l.to)) continue
      const x = crossing(l.edge, l.at, r, byId[l.to])
      path.push({ p: x.out })
      path.push({ p: x.in })
      visit(l.to, x.in, x.at)
      // Walk back out the same way.
      path.push({ p: x.in })
      path.push({ p: x.out })
      if (here !== entry) path.push({ p: here })
    }
  }
  visit('living', [dx, D / 2 - STEP], [dx, D / 2])

  // Finish at the last stop: drop the walk back.
  let last = path.length - 1
  while (last > 0 && path[last].hold === undefined) last--
  path.length = last + 1

  // Timeline: constant walking speed, holds at stops.
  const keys = []
  let t = 0
  for (let i = 0; i < path.length; i++) {
    const cur = path[i]
    if (i > 0) {
      const prev = path[i - 1]
      if (cur.hold !== undefined) t += cur.hold === 0 ? 2.4 : HOLD
      else t += Math.hypot(cur.p[0] - prev.p[0], cur.p[1] - prev.p[1]) / SPEED
    }
    if (cur.hold !== undefined) {
      stops[cur.hold].at = t - (cur.hold === 0 ? 2.4 : HOLD)
      stops[cur.hold].end = t
    }
    keys.push({ t, x: cur.p[0], z: cur.p[1], hold: cur.hold })
  }
  // Consecutive duplicate points (a doorway walked straight back through) add nothing.
  return { keys, stops, total: t, eye: EYE }
}

/** Position on the route at time t (house-local x, z). */
export function sampleTour(tour, t) {
  const k = tour.keys
  if (t <= k[0].t) return [k[0].x, k[0].z]
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i].t) {
      const a = k[i - 1]
      const b = k[i]
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1
      return [a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f]
    }
  }
  const e = k[k.length - 1]
  return [e.x, e.z]
}

/** Index of the stop being shown (or walked toward) at time t. */
export function stopAt(tour, t) {
  let s = 0
  for (let i = 0; i < tour.stops.length; i++) if (t >= tour.stops[i].at - 1.2) s = i
  return s
}
