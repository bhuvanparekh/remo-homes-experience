/**
 * Floor plans for a design option, floor by floor.
 *
 * Each building block from generate.js is a rectangle in the street-turned
 * u/v frame (u along the street, v from the front of the lot to the back).
 * Here it is divided into rooms: a concept layout to show how a floor could
 * work — room names and sizes — not an architect's plan. Stairs stay in the
 * same place on every floor of a building.
 */

const FT = 0.3048
const sqft = (r) => Math.round(((r.u1 - r.u0) * (r.v1 - r.v0)) / (FT * FT))
const room = (r, name, kind) => ({ ...r, name, kind, sqft: sqft(r) })
const ok = (r) => r && r.u1 - r.u0 > 0.6 && r.v1 - r.v0 > 0.6
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

/** Bounding rectangle of a building's pieces on one floor. */
function boundsOf(vols) {
  return vols.reduce(
    (b, v) => ({ u0: Math.min(b.u0, v.rect.u0), u1: Math.max(b.u1, v.rect.u1), v0: Math.min(b.v0, v.rect.v0), v1: Math.max(b.v1, v.rect.v1) }),
    { u0: Infinity, u1: -Infinity, v0: Infinity, v1: -Infinity },
  )
}

/** Split a range [a, b] into pieces of fixed size or flexible share. */
function cuts(a, b, parts) {
  const fixed = parts.reduce((s, p) => s + (p.size ?? 0), 0)
  const flex = parts.reduce((s, p) => s + (p.size == null ? p.flex ?? 1 : 0), 0)
  const spare = Math.max(0, b - a - fixed)
  let x = a
  return parts.map((p) => {
    const len = p.size ?? (spare * (p.flex ?? 1)) / (flex || 1)
    const out = [x, x + len]
    x += len
    return out
  })
}

/* ---------- Houses ---------- */

/** Where the stairs column sits in a house, shared by all its floors. */
function houseCore(ground, garage) {
  const W = ground.u1 - ground.u0
  const coreW = W < 7 ? 1.8 : 2.2
  let u0 = garage ? garage.u1 : ground.u0 + W * 0.36
  u0 = clamp(u0, ground.u0 + (garage ? 0 : 2.5), ground.u1 - coreW - 3)
  const D = ground.v1 - ground.v0
  const entry = Math.min(2.4, D * 0.28)
  const run = Math.min(3.6, D * 0.38)
  return { u0, u1: u0 + coreW, stairV0: ground.v0 + entry, stairV1: ground.v0 + entry + run }
}

function houseGround(R, garage, core, { compact = false } = {}) {
  const rooms = []
  const D = R.v1 - R.v0
  // Stairs column: entry, stairs, powder room.
  rooms.push(room({ u0: core.u0, u1: core.u1, v0: R.v0, v1: core.stairV0 }, 'Entry', 'hall'))
  rooms.push(room({ u0: core.u0, u1: core.u1, v0: core.stairV0, v1: core.stairV1 }, 'Stairs', 'stairs'))
  if (R.v1 - core.stairV1 > 1.4) rooms.push(room({ u0: core.u0, u1: core.u1, v0: core.stairV1, v1: R.v1 }, 'Powder room', 'bath'))
  else if (R.v1 - core.stairV1 > 0.05) rooms.push(room({ u0: core.u0, u1: core.u1, v0: core.stairV1, v1: R.v1 }, 'Hall', 'hall'))

  // Left of the stairs: garage (front) then laundry / kitchen.
  const left = { u0: R.u0, u1: core.u0 }
  if (left.u1 - left.u0 > 1.5) {
    if (garage) {
      rooms.push(room(garage, 'Garage', 'garage'))
      const behind = { ...left, v0: garage.v1, v1: R.v1 }
      if (behind.v1 - behind.v0 > 4.5 && !compact) {
        const [a, b] = cuts(behind.v0, behind.v1, [{ size: 2.2 }, { flex: 1 }])
        rooms.push(room({ ...left, v0: a[0], v1: a[1] }, 'Laundry', 'service'))
        rooms.push(room({ ...left, v0: b[0], v1: b[1] }, 'Kitchen', 'kitchen'))
      } else if (behind.v1 - behind.v0 > 1.5) rooms.push(room(behind, compact ? 'Kitchen' : 'Laundry + pantry', compact ? 'kitchen' : 'service'))
    } else {
      const [a, b] = cuts(R.v0, R.v1, [{ flex: 1 }, { flex: 1.1 }])
      rooms.push(room({ ...left, v0: a[0], v1: a[1] }, compact ? 'Kitchen' : 'Den', compact ? 'kitchen' : 'living'))
      rooms.push(room({ ...left, v0: b[0], v1: b[1] }, compact ? 'Bath' : 'Kitchen', compact ? 'bath' : 'kitchen'))
    }
  }

  // Right of the stairs: living at the front, dining behind (kitchen too if there's no room on the left).
  const right = { u0: core.u1, u1: R.u1 }
  const hasKitchen = rooms.some((r) => r.kind === 'kitchen')
  const parts = hasKitchen ? [{ flex: 1.2 }, { flex: 1 }] : [{ flex: 1.1 }, { flex: 1 }]
  const [f, b] = cuts(R.v0, R.v1, parts)
  rooms.push(room({ ...right, v0: f[0], v1: f[1] }, 'Living', 'living'))
  if (compact) rooms.push(room({ ...right, v0: b[0], v1: b[1] }, 'Bedroom 1', 'bed'))
  else rooms.push(room({ ...right, v0: b[0], v1: b[1] }, hasKitchen ? 'Dining' : 'Kitchen + dining', 'kitchen'))
  return rooms.filter(ok)
}

function houseUpper(R, core, floor, { compact = false } = {}) {
  const rooms = []
  const cu0 = clamp(core.u0, R.u0, R.u1 - (core.u1 - core.u0))
  const cu1 = cu0 + (core.u1 - core.u0)
  const sv0 = clamp(core.stairV0, R.v0, R.v1 - 1)
  const sv1 = clamp(core.stairV1, sv0, R.v1)
  rooms.push(room({ u0: cu0, u1: cu1, v0: sv0, v1: sv1 }, 'Stairs', 'stairs'))
  if (sv0 - R.v0 > 0.8) rooms.push(room({ u0: cu0, u1: cu1, v0: R.v0, v1: sv0 }, 'Hall', 'hall'))
  if (R.v1 - sv1 > 0.8) rooms.push(room({ u0: cu0, u1: cu1, v0: sv1, v1: R.v1 }, 'Hall', 'hall'))

  const n = floor * 2 // bedroom numbering by floor
  const left = { u0: R.u0, u1: cu0 }
  if (left.u1 - left.u0 > 2) {
    const [f, b] = cuts(R.v0, R.v1, [{ flex: 1.4 }, { size: Math.min(2.6, (R.v1 - R.v0) * 0.35) }])
    rooms.push(room({ ...left, v0: f[0], v1: f[1] }, `Bedroom ${n}`, 'bed'))
    rooms.push(room({ ...left, v0: b[0], v1: b[1] }, 'Bath', 'bath'))
  }
  const right = { u0: cu1, u1: R.u1 }
  if (right.u1 - right.u0 > 2) {
    if (floor === 1 && !compact) {
      const [f, b] = cuts(R.v0, R.v1, [{ flex: 1.5 }, { size: Math.min(3, (R.v1 - R.v0) * 0.4) }])
      rooms.push(room({ ...right, v0: f[0], v1: f[1] }, 'Primary bedroom', 'bed'))
      const back = { ...right, v0: b[0], v1: b[1] }
      const [x, y] = cuts(back.u0, back.u1, [{ flex: 1.2 }, { flex: 1 }])
      rooms.push(room({ ...back, u0: x[0], u1: x[1] }, 'Primary bath', 'bath'))
      rooms.push(room({ ...back, u0: y[0], u1: y[1] }, 'Walk-in closet', 'service'))
    } else {
      rooms.push(room({ ...right, v0: R.v0, v1: R.v1 }, `Bedroom ${n + 1}`, 'bed'))
    }
  }
  return rooms.filter(ok)
}

function aduPlan(R) {
  const [f, b] = cuts(R.v0, R.v1, [{ flex: 1.2 }, { flex: 1 }])
  const back = { ...R, v0: b[0], v1: b[1] }
  const [x, y] = cuts(back.u0, back.u1, [{ flex: 1.6 }, { flex: 1 }])
  return [
    room({ ...R, v0: f[0], v1: f[1] }, 'Living + kitchen', 'living'),
    room({ ...back, u0: x[0], u1: x[1] }, 'Bedroom', 'bed'),
    room({ ...back, u0: y[0], u1: y[1] }, 'Bath', 'bath'),
  ].filter(ok)
}

/** Townhome: stairs along one side; garage + entry, then living, then bedrooms. */
function townhomePlan(R, floor, garage) {
  const sw = Math.min(1.1, (R.u1 - R.u0) * 0.25)
  const body = { ...R, u1: R.u1 - sw }
  const strip = { ...R, u0: R.u1 - sw }
  const D = R.v1 - R.v0
  const sv0 = R.v0 + D * 0.42
  const rooms = [room({ ...strip, v0: sv0, v1: Math.min(R.v1, sv0 + 3.4) }, 'Stairs', 'stairs')]
  if (sv0 - R.v0 > 0.8) rooms.push(room({ ...strip, v1: sv0 }, floor === 0 ? 'Entry' : 'Hall', 'hall'))
  if (R.v1 - (sv0 + 3.4) > 0.8) rooms.push(room({ ...strip, v0: sv0 + 3.4 }, 'Hall', 'hall'))
  if (floor === 0) {
    if (garage) {
      const g = { ...body, v1: Math.min(R.v1, garage.v1) }
      rooms.push(room(g, 'Garage', 'garage'))
      if (R.v1 - g.v1 > 1.5) rooms.push(room({ ...body, v0: g.v1 }, 'Flex room', 'living'))
    } else {
      const [f, b] = cuts(R.v0, R.v1, [{ flex: 1 }, { flex: 1 }])
      rooms.push(room({ ...body, v0: f[0], v1: f[1] }, 'Flex room', 'living'))
      rooms.push(room({ ...body, v0: b[0], v1: b[1] }, 'Kitchen', 'kitchen'))
    }
  } else if (floor === 1) {
    const [f, b] = cuts(R.v0, R.v1, [{ flex: 1.1 }, { flex: 1 }])
    rooms.push(room({ ...body, v0: f[0], v1: f[1] }, 'Living', 'living'))
    rooms.push(room({ ...body, v0: b[0], v1: b[1] }, 'Kitchen + dining', 'kitchen'))
  } else {
    const [f, m, b] = cuts(R.v0, R.v1, [{ flex: 1 }, { size: 2.4 }, { flex: 1 }])
    rooms.push(room({ ...body, v0: f[0], v1: f[1] }, 'Bedroom 1', 'bed'))
    rooms.push(room({ ...body, v0: m[0], v1: m[1] }, 'Bath', 'bath'))
    rooms.push(room({ ...body, v0: b[0], v1: b[1] }, 'Bedroom 2', 'bed'))
  }
  return rooms.filter(ok)
}

/* ---------- Apartment blocks ---------- */

const BEDS = (sqftEach) => (sqftEach >= 1100 ? '3 bd' : sqftEach >= 850 ? '2 bd' : sqftEach >= 650 ? '1 bd' : 'Studio')

/**
 * A block floor in a frame along its long side (a = along, b = across).
 * Homes line a corridor down the middle (or along the back when the block is
 * too shallow for homes on both sides). Stair cores sit on one side at each
 * end, plus a lift core midway along long blocks. Parking floors put stalls
 * where the homes would be, either side of a drive aisle.
 */
function blockFloor(R, { homes = 0, startNo = 1, parking = false }) {
  const alongU = R.u1 - R.u0 >= R.v1 - R.v0
  const A0 = alongU ? R.u0 : R.v0
  const A1 = alongU ? R.u1 : R.v1
  const B0 = alongU ? R.v0 : R.u0
  const B1 = alongU ? R.v1 : R.u1
  const toUV = (a0, a1, b0, b1) => (alongU ? { u0: a0, u1: a1, v0: b0, v1: b1 } : { u0: b0, u1: b1, v0: a0, v1: a1 })
  const len = A1 - A0
  const rooms = []
  const stalls = []

  const sd = 18 * FT
  const sw = 8.5 * FT
  const aisle = 24 * FT
  const corridor = 1.8
  // Bands across the block: [side 1][corridor or aisle][side 2].
  let bands
  if (parking) {
    const two = B1 - B0 >= 2 * sd + aisle
    bands = two
      ? { side1: [B0, B0 + sd], mid: [B0 + sd, B1 - sd], side2: [B1 - sd, B1] }
      : { side1: [B1 - sd, B1], mid: [B0, B1 - sd], side2: null }
  } else {
    const double = (B1 - B0 - corridor) / 2 >= 6
    const m = (B0 + B1) / 2
    bands = double
      ? { side1: [B0, m - corridor / 2], mid: [m - corridor / 2, m + corridor / 2], side2: [m + corridor / 2, B1] }
      : { side1: [B0, B1 - corridor], mid: [B1 - corridor, B1], side2: null }
  }
  rooms.push(room(toUV(A0, A1, ...bands.mid), parking ? 'Drive aisle' : 'Corridor', parking ? 'aisle' : 'hall'))

  // Cores on side 1: both ends, and midway on long blocks.
  const coreL = 3.6
  const coreAt = [A0, A1 - coreL]
  if (len > 45) coreAt.splice(1, 0, (A0 + A1) / 2 - coreL / 2)
  coreAt.forEach((a, i) => rooms.push(room(toUV(a, a + coreL, ...bands.side1), i === 1 && coreAt.length === 3 ? 'Lift + stairs' : 'Stairs', 'stairs')))
  const runs1 = []
  for (let i = 0; i < coreAt.length - 1; i++) runs1.push([coreAt[i] + coreL, coreAt[i + 1]])
  const slots = runs1.map(([r0, r1]) => ({ r0, r1, b: bands.side1 }))
  if (bands.side2) slots.push({ r0: A0, r1: A1, b: bands.side2 })

  if (parking) {
    for (const sl of slots) {
      const n = Math.floor((sl.r1 - sl.r0) / sw)
      const pad = (sl.r1 - sl.r0 - n * sw) / 2
      for (let k = 0; k < n; k++) stalls.push(toUV(sl.r0 + pad + k * sw, sl.r0 + pad + (k + 1) * sw, ...sl.b))
      // Leftover ends of a stall row are planting / bike parking.
      if (pad > 0.3) {
        rooms.push(room(toUV(sl.r0, sl.r0 + pad, ...sl.b), '', 'aisle'))
        rooms.push(room(toUV(sl.r1 - pad, sl.r1, ...sl.b), '', 'aisle'))
      }
    }
    for (const st of stalls) rooms.push({ ...st, name: '', kind: 'stall', sqft: sqft(st) })
    return { rooms: rooms.filter(ok), stalls }
  }

  // Share the homes out over the slots, by length.
  const total = slots.reduce((sum, x) => sum + (x.r1 - x.r0), 0)
  let left = homes
  let no = startNo
  slots.forEach((sl, i) => {
    const L = sl.r1 - sl.r0
    const k = i === slots.length - 1 ? left : Math.min(left, Math.round((homes * L) / total))
    left -= k
    if (!k) {
      rooms.push(room(toUV(sl.r0, sl.r1, ...sl.b), 'Shared space', 'service'))
      return
    }
    for (let j = 0; j < k; j++) {
      const r = toUV(sl.r0 + (L * j) / k, sl.r0 + (L * (j + 1)) / k, ...sl.b)
      rooms.push({ ...r, name: `Home ${no}`, kind: 'home', sqft: sqft(r), sub: BEDS(sqft(r)) })
      no++
    }
  })
  return { rooms: rooms.filter(ok), stalls }
}

/* ---------- Entry point ---------- */

/** Floors an option has, bottom up: [0, 1, 2…]. */
export const floorsOf = (option) => [...new Set(option.vols.map((v) => v.floor))].sort((a, b) => a - b)

/**
 * The plan of one floor of an option:
 *   { buildings: [{ name, outline, rooms, stalls }], bounds }
 * All rectangles in the street-turned u/v frame (metres).
 */
export function planFloor(option, floor, filters) {
  const byGroup = new Map()
  for (const v of option.vols) {
    const g = v.group ?? v.label
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g).push(v)
  }

  const buildings = []
  // Block homes are numbered up through the floors.
  let blockNo = 1
  const homeFloors = option.vols.filter((v) => v.label === 'Homes').map((v) => v.floor)
  const perFloor = option.stats?.perFloorHomes ?? 0
  const homesTotal = option.stats?.homes ?? 0

  for (const [group, vols] of byGroup) {
    const here = vols.filter((v) => v.floor === floor)
    if (!here.length) continue
    const R = boundsOf(here)
    const groundVols = vols.filter((v) => v.floor === Math.min(...vols.map((x) => x.floor)))
    const ground = boundsOf(groundVols)
    const garage = groundVols.find((v) => v.use === 'garage')?.rect || null
    const isGround = floor === Math.min(...vols.map((x) => x.floor))
    let rooms = []
    let stalls = []
    if (group === 'House' || /^Home \d/.test(group)) {
      const compact = group !== 'House'
      const core = houseCore(ground, garage)
      rooms = isGround ? houseGround(R, garage, core, { compact }) : houseUpper(R, core, floor - Math.min(...vols.map((x) => x.floor)), { compact })
    } else if (group === 'ADU') {
      rooms = aduPlan(R)
    } else if (/^Townhome/.test(group)) {
      rooms = townhomePlan(R, floor - Math.min(...vols.map((x) => x.floor)), garage)
    } else if (group === 'Parking') {
      ;({ rooms, stalls } = blockFloor(R, { parking: true }))
    } else if (group === 'Homes' && homesTotal <= 4) {
      // A few large homes: side by side, each running up through every floor.
      const floors = [...new Set(homeFloors)].sort((a, b) => a - b)
      const level = floors.indexOf(floor)
      const k = Math.max(1, homesTotal)
      const w = (R.u1 - R.u0) / k
      for (let i = 0; i < k; i++) {
        const slice = { ...R, u0: R.u0 + i * w, u1: R.u0 + (i + 1) * w }
        const part = townhomePlan(slice, Math.min(level, 2), null).map((r) => (k > 1 ? { ...r, name: r.name ? `${r.name}${r.kind === 'stairs' || r.kind === 'hall' ? '' : ` · home ${i + 1}`}` : r.name } : r))
        rooms.push(...part)
      }
      if (level > 2) rooms = rooms.map((r) => (r.kind === 'bed' ? { ...r, name: r.name.replace(/Bedroom (\d)/, (_, n) => `Bedroom ${Number(n) + 2 * (level - 2)}`) } : r))
    } else if (group === 'Homes') {
      const idx = homeFloors.indexOf(floor)
      const before = [...new Set(homeFloors)].filter((f) => f < floor).length
      const homes = Math.max(0, Math.min(perFloor, homesTotal - before * perFloor))
      blockNo = before * perFloor + 1
      ;({ rooms, stalls } = blockFloor(R, { homes, startNo: blockNo, homeSqft: filters?.homeSize }))
      void idx
    }
    buildings.push({ name: group, outline: R, rooms, stalls })
  }

  const all = buildings.map((b) => b.outline)
  const bounds = all.length ? boundsOf(all.map((rect) => ({ rect }))) : null
  return { buildings, bounds }
}

/** Plain-English name for a floor. */
const ORD = ['1st', '2nd', '3rd']
export const floorName = (f) => (f === 0 ? 'Ground floor' : `${ORD[f] ?? `${f + 1}th`} floor`)
