import { FT, SETBACKS_FT, sqft, toFt } from './spec.js'

/**
 * Turns a studio spec (lot size, rooms, extras) into a single-storey plan,
 * laid out the way the SupReMo is: a long, two-band house.
 *
 *   front band   [ bedrooms · office ][   living   ][ primary bedroom ]
 *   hall                 ═══════════
 *   back band    [ baths · laundry  ][ kitchen | dining ][ bath | closet ]
 *
 * The sleeping wing sits at one end (with a hall between its bands), the
 * great room in the middle and the primary suite at the other end. Each band
 * is a row of rectangles; flexible rooms (living, kitchen, dining) stretch
 * so both bands end up the same length.
 *
 * Plan coordinates are metres: x runs along the house, z = +front / −back,
 * centred on the origin. Pure function, no React or three.js.
 */

export const BANDS = { front: 4.1, hall: 1.1, back: 3.0 }
export const DEPTH = BANDS.front + BANDS.hall + BANDS.back // 8.2 m, like the SupReMo
export const CEILING = 2.7
export const FLOOR_Y = 0.55
export const DECK_DEPTH = 1.25

/** Smallest comfortable width (m, along the house) for each room. */
const MIN_W = {
  bedroom: 3.1,
  office: 2.8,
  bath: 2.3,
  laundry: 1.9,
  storage: 1.4,
  kitchen: 3.2,
  dining: 3.0,
  primary: 3.8,
  ensuite: 2.1,
  closet: 1.7,
}

/** Massing colour group for each kind of room. */
export const ZONE = {
  living: 'living',
  kitchen: 'living',
  dining: 'living',
  primary: 'sleep',
  bedroom: 'sleep',
  office: 'work',
  bath: 'wet',
  ensuite: 'wet',
  laundry: 'service',
  storage: 'service',
  closet: 'service',
  hall: 'hall',
}

const room = (id, kind, name, w) => ({ id, kind, name, w })

/** Lay a row of rooms end to end from x0, stretching them to fill `width`. */
function placeRow(rooms, x0, width, z0, z1) {
  const total = rooms.reduce((s, r) => s + r.w, 0)
  const k = total > 0 ? width / total : 1
  let x = x0
  return rooms.map((r) => {
    const w = r.w * k
    const placed = { id: r.id, kind: r.kind, name: r.name, x0: x, x1: x + w, z0, z1 }
    x += w
    return placed
  })
}

/** The rooms each part of the house needs for this spec. */
function program(spec) {
  const { bedrooms, baths, office, laundry } = spec
  const ensuite = baths >= 2
  const sharedBaths = ensuite ? baths - 1 : 1

  const wingFront = []
  for (let i = 2; i <= bedrooms; i++) wingFront.push(room(`bed${i}`, 'bedroom', `Bedroom ${i}`, MIN_W.bedroom))
  if (office) wingFront.push(room('office', 'office', 'Office', MIN_W.office))

  const wingBack = []
  for (let i = 0; i < sharedBaths; i++) {
    const n = ensuite ? i + 2 : i + 1
    wingBack.push(room(`bath${n}`, 'bath', sharedBaths === 1 && !ensuite ? 'Bath' : `Bath ${n}`, MIN_W.bath))
  }
  if (laundry) wingBack.push(room('laundry', 'laundry', 'Laundry', MIN_W.laundry))
  // Balance the wing: if the bedroom row runs long, the office moves to the
  // quieter back row, off the hall.
  if (office && sum(wingFront) - sum(wingBack) > MIN_W.office + 0.5 && wingFront.length > 1) {
    wingBack.push(wingFront.pop())
  }
  // Bedrooms with nothing behind them get a run of storage off the hall.
  if (wingFront.length && !wingBack.length) wingBack.push(room('storage', 'storage', 'Storage', MIN_W.storage))

  const primaryBack = ensuite
    ? [room('ensuite', 'ensuite', 'Primary bath', MIN_W.ensuite), room('closet', 'closet', 'Walk-in', MIN_W.closet)]
    : [room('closet', 'closet', 'Walk-in', MIN_W.closet)]

  return {
    wingFront,
    wingBack,
    livingMin: 4.6 + 0.3 * bedrooms,
    kitchen: room('kitchen', 'kitchen', 'Kitchen', MIN_W.kitchen),
    dining: room('dining', 'dining', 'Dining', MIN_W.dining + (bedrooms >= 4 ? 0.3 : 0)),
    primaryName: bedrooms === 1 ? 'Bedroom' : 'Primary suite',
    primaryBack,
  }
}

const sum = (rooms) => rooms.reduce((s, r) => s + r.w, 0)

/** Rooms, hall and decks in plan coordinates. */
export function layoutHouse(spec) {
  const p = program(spec)
  const zFront = DEPTH / 2
  const zSplit = zFront - BANDS.front // front band | rest
  const zHallBack = zSplit - BANDS.hall
  const zBack = -DEPTH / 2

  const wing = Math.max(sum(p.wingFront), sum(p.wingBack))
  // A long gap behind the bedrooms becomes storage rather than an oversized bath.
  const backGap = wing - sum(p.wingBack)
  if (p.wingFront.length && backGap >= 1.3 && !p.wingBack.some((r) => r.kind === 'storage')) {
    p.wingBack.push(room('storage', 'storage', 'Storage', backGap))
  }
  const primaryBackW = sum(p.primaryBack)
  const coreFront = p.livingMin + MIN_W.primary
  const coreBack = p.kitchen.w + p.dining.w + primaryBackW
  const length = wing + Math.max(coreFront, coreBack)

  const x0 = -length / 2
  const xCore = x0 + wing
  const x1 = length / 2
  const rooms = []

  // Sleeping wing. With nothing at the front, the living room takes the whole
  // front of the house and the wing's back rooms run full depth.
  const hasHall = p.wingFront.length > 0
  if (hasHall) {
    rooms.push(...placeRow(p.wingFront, x0, wing, zSplit, zFront))
    rooms.push({ id: 'hall', kind: 'hall', name: 'Hall', x0, x1: xCore, z0: zHallBack, z1: zSplit })
    rooms.push(...placeRow(p.wingBack, x0, wing, zBack, zHallBack))
  } else if (p.wingBack.length) {
    rooms.push(...placeRow(p.wingBack, x0, wing, zBack, zSplit))
  }

  // Front band of the core: living, then the primary bedroom.
  const livingX0 = hasHall ? xCore : x0
  rooms.push({ id: 'living', kind: 'living', name: 'Living', x0: livingX0, x1: x1 - MIN_W.primary, z0: zSplit, z1: zFront })
  rooms.push({ id: 'primary', kind: 'primary', name: p.primaryName, x0: x1 - MIN_W.primary, x1, z0: zSplit, z1: zFront })

  // Back band of the core: kitchen and dining share whatever is spare.
  const spare = x1 - xCore - coreBack
  const kitchen = { ...p.kitchen, w: p.kitchen.w + spare / 2 }
  const dining = { ...p.dining, w: p.dining.w + spare / 2 }
  rooms.push(...placeRow([kitchen, dining, ...p.primaryBack], xCore, x1 - xCore, zBack, zSplit))

  const byId = Object.fromEntries(rooms.map((r) => [r.id, r]))
  const decks = []
  if (spec.frontDeck) {
    // Under the front door (see houseModel.frontDoorX).
    const l = byId.living
    const cx = Math.max(l.x0 + 1.4, l.x1 - 1.4)
    decks.push({ id: 'front', x0: cx - 1.4, x1: cx + 1.4, side: 'front', depth: DECK_DEPTH })
  }
  if (spec.backDeck) {
    const d = byId.dining
    const cx = (d.x0 + d.x1) / 2
    decks.push({ id: 'back', x0: cx - 1.3, x1: cx + 1.3, side: 'back', depth: DECK_DEPTH })
  }

  return { length, depth: DEPTH, rooms, decks }
}

/**
 * Where the house sits on the lot, in lot coordinates (metres, lot centred on
 * the origin, street along +z). The house faces the street when it fits
 * across the lot; on narrow lots it turns 90° and faces the side yard, the way
 * long single-storey homes are set on LA's 50 ft lots.
 */
function placeOnLot(house, spec) {
  const w = spec.lotW * FT
  const d = spec.lotD * FT
  const sb = { front: SETBACKS_FT.front * FT, side: SETBACKS_FT.side * FT, rear: SETBACKS_FT.rear * FT }
  const build = { x0: -w / 2 + sb.side, x1: w / 2 - sb.side, z0: -d / 2 + sb.rear, z1: d / 2 - sb.front }
  const bw = build.x1 - build.x0
  const bd = build.z1 - build.z0
  const L = house.length
  const D = house.depth
  const front = house.decks.some((k) => k.side === 'front') ? DECK_DEPTH : 0
  const back = house.decks.some((k) => k.side === 'back') ? DECK_DEPTH : 0

  const lot = { w, d, setbacks: sb, build }

  if (L <= bw && D + front + back <= bd) {
    // Front wall on the front setback line (porch steps may sit in the setback).
    return { lot, ok: true, rotated: false, rotY: 0, x: 0, z: build.z1 - D / 2 }
  }
  if (L <= bd && D + front + back <= bw) {
    // Turned so the front faces east; pushed to the west side for a usable side yard.
    return {
      lot,
      ok: true,
      rotated: true,
      rotY: Math.PI / 2,
      x: build.x0 + back + D / 2,
      z: build.z1 - L / 2,
    }
  }

  const needW = Math.ceil(toFt(Math.min(L, D + front + back)) + SETBACKS_FT.side * 2)
  const needD = Math.ceil(toFt(Math.max(L, D + front + back)) + SETBACKS_FT.front + SETBACKS_FT.rear)
  return {
    lot,
    ok: false,
    reason: `This home needs a lot of about ${roundUp5(needW)} × ${roundUp5(needD)} ft. Make the lot bigger or ask for fewer rooms.`,
  }
}

const roundUp5 = (v) => Math.ceil(v / 5) * 5

/** The whole plan: rooms, decks, placement on the lot and headline numbers. */
export function generatePlan(spec) {
  const house = layoutHouse(spec)
  const site = placeOnLot(house, spec)
  const footprint = house.length * house.depth
  const lotArea = site.lot.w * site.lot.d
  return {
    spec,
    house,
    site,
    stats: {
      sqft: Math.round(sqft(footprint) / 5) * 5,
      lengthFt: Math.round(toFt(house.length)),
      depthFt: Math.round(toFt(house.depth)),
      coverage: Math.round((footprint / lotArea) * 100),
      bedrooms: spec.bedrooms,
      baths: spec.baths,
    },
  }
}
