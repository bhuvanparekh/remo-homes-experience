import { footprint } from '../rules/envelope.js'

/**
 * Design options for a real lot: buildings placed inside its actual setbacks,
 * sized by the visitor's filters and checked against every limit the rules
 * engine found (rules/engine.js → limits).
 *
 * This is concept massing, not architecture: rectangular buildings, a
 * standard 10 ft storey, typical stall and home sizes. Every simplification
 * that could change a result is listed in the option's `assumptions`.
 *
 * Geometry is metres in the site frame (x = east, y = north). Placement uses
 * a frame turned to the street: u runs along the front, v runs from the front
 * of the lot to the back.
 */

export const FT = 0.3048
const M2 = FT * FT
const STOREY_FT = 10
const ROOF_FT = 1.5 // parapet / roof build-up on a flat roof
const STEP = 0.25 // m, placement resolution

const sqftOf = (m2) => m2 / M2
const m2Of = (sqft) => sqft * M2

/* ---------- Frame turned to the street ---------- */

function streetFrame(sides) {
  const f = sides.frontNormal // outward from the front edge
  const d = [-f[0], -f[1]] // into the lot
  const a = [-d[1], d[0]] // along the front
  return {
    toUV: ([x, y]) => [x * a[0] + y * a[1], x * d[0] + y * d[1]],
    toXY: ([u, v]) => [u * a[0] + v * d[0], u * a[1] + v * d[1]],
  }
}

const polyArea = (pts) => {
  let s = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  return Math.abs(s) / 2
}

/** u-extent of a convex polygon at height v, or null. */
function spanAt(poly, v) {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    if ((p[1] - v) * (q[1] - v) > 0 && !(p[1] === v || q[1] === v)) continue
    if (p[1] === q[1]) {
      if (p[1] === v) {
        lo = Math.min(lo, p[0], q[0])
        hi = Math.max(hi, p[0], q[0])
      }
      continue
    }
    const t = (v - p[1]) / (q[1] - p[1])
    if (t < 0 || t > 1) continue
    const u = p[0] + (q[0] - p[0]) * t
    lo = Math.min(lo, u)
    hi = Math.max(hi, u)
  }
  return hi > lo ? [lo, hi] : null
}

/**
 * A rectangle (in u/v) inside a convex polygon with about `target` m², as
 * close to one end of the lot as it can be: every starting line is tried and
 * the rectangle reaching the target nearest that end wins (so slanted or
 * rounded lot corners don't pin it to a sliver). If nothing reaches the
 * target, the largest rectangle is returned.
 *   from: 'front' (low v) or 'rear';  maxW / maxD cap width and depth.
 */
function placeRect(poly, target, { from = 'front', maxW = Infinity, maxD = Infinity, minD = 3 } = {}) {
  if (!poly || poly.length < 3) return null
  const vs = poly.map((p) => p[1])
  const v0 = Math.min(...vs)
  const v1 = Math.max(...vs)
  const rows = []
  for (let v = v0 + 0.01; v <= v1 - 0.01; v += STEP) rows.push({ v, s: spanAt(poly, v) })
  const dir = from === 'front' ? 1 : -1
  const starts = dir > 0 ? rows.map((_, i) => i) : rows.map((_, i) => rows.length - 1 - i)

  let best = null
  let biggest = null
  for (const i of starts) {
    if (!rows[i].s) continue
    // Nothing starting further in can end nearer the preferred end.
    if (best && dir * (rows[i].v - best.edge) > 0) break
    let lo = -Infinity
    let hi = Infinity
    for (let k = i; k >= 0 && k < rows.length; k += dir) {
      const sp = rows[k].s
      if (!sp) break
      lo = Math.max(lo, sp[0])
      hi = Math.min(hi, sp[1])
      if (hi - lo < 2) break
      const depth = Math.abs(rows[k].v - rows[i].v) + STEP
      if (depth > maxD) break
      const full = Math.min(hi - lo, maxW)
      const va = Math.min(rows[i].v, rows[k].v) - STEP / 2
      const mk = (w) => ({ u0: (lo + hi) / 2 - w / 2, u1: (lo + hi) / 2 + w / 2, v0: va, v1: va + depth, area: w * depth })
      if (!biggest || full * depth > biggest.area) biggest = mk(full)
      if (full * depth >= target && depth >= minD) {
        const r = mk(Math.min(full, target / depth))
        const edge = dir > 0 ? r.v1 : r.v0 // how far it reaches from the preferred end
        if (!best || dir * (edge - best.edge) < 0) best = { ...r, edge }
        break
      }
    }
  }
  return best || biggest
}

/** The part of a polygon from v = vmin backwards. */
function clipFront(poly, vmin) {
  if (!poly) return null
  const out = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    if (p[1] >= vmin) out.push(p)
    if (p[1] >= vmin !== q[1] >= vmin) {
      const t = (vmin - p[1]) / (q[1] - p[1])
      out.push([p[0] + (q[0] - p[0]) * t, vmin])
    }
  }
  return out.length >= 3 ? out : null
}

/* ---------- Building pieces ---------- */

const rectPoly = (r, frame) =>
  [
    [r.u0, r.v0],
    [r.u1, r.v0],
    [r.u1, r.v1],
    [r.u0, r.v1],
  ].map(frame.toXY)

const rectArea = (r) => (r.u1 - r.u0) * (r.v1 - r.v0)

function storeys(rect, n, frame, use, { z0 = 0, label, startFloor = 0, insetFor } = {}) {
  const out = []
  for (let i = 0; i < n; i++) {
    const zb = z0 + i * STOREY_FT * FT
    const zt = zb + STOREY_FT * FT
    const r = insetFor ? insetFor(rect, zt / FT) : rect
    if (!r || r.u1 - r.u0 < 1.5 || r.v1 - r.v0 < 1.5) continue
    out.push({ poly: rectPoly(r, frame), rect: r, z0: zb, z1: zt, use, floor: startFloor + i, label, group: label })
  }
  return out
}

/**
 * Cut a garage (front corner) out of a ground-floor volume: returns the
 * garage plus the one or two pieces of home around it.
 */
function withGarage(vol, g, frame) {
  const r = vol.rect
  const pieces = [
    { ...vol, rect: g, poly: rectPoly(g, frame), use: 'garage', label: 'Garage', group: vol.group },
    { u0: g.u1, u1: r.u1, v0: r.v0, v1: r.v1 },
    { u0: r.u0, u1: g.u1, v0: g.v1, v1: r.v1 },
  ]
  return pieces
    .map((p, i) => (i === 0 ? p : { ...vol, rect: p, poly: rectPoly(p, frame) }))
    .filter((p) => p.rect.u1 - p.rect.u0 > 0.3 && p.rect.v1 - p.rect.v0 > 0.3)
}

/** Setback function for envelope.footprint: feet per edge kind → metres. */
const yardsM = (byKind, fallback) => (e) => (byKind[e.kind] ?? fallback) * FT

/* ---------- Checks ---------- */

const fmt = (n) => Math.round(n).toLocaleString('en-US')
/** A rule check; `limit` is phrased for reading ("limit 28 ft", "you asked for 35%"). */
const check = (id, label, ok, value, limit, extra = {}) => {
  let text = limit
  if (/^[\d,]+( ft| sq ft)?$/.test(limit)) text = `limit ${limit}`
  else if (/% wanted$/.test(limit)) text = `you asked for ${limit.replace(' wanted', '')}`
  else if (/^[\d,]+ sq ft$/.test(limit)) text = `limit ${limit}`
  return { id, label, ok, value, limit: text, ...extra }
}

/* ---------- Houses: RA, RE, RS, R1 ---------- */

function houseOptions({ sides, limits, filters, frame, lotUV, lotM2 }) {
  const L = limits
  const storeysWanted = filters.floors
  const heightFt = storeysWanted * STOREY_FT + ROOF_FT
  const side = L.sideFor(heightFt)
  const yards = { front: L.yards.front, rear: L.yards.rear, side, streetSide: side }
  const fp = footprint(sides, yardsM(yards, side))
  const fpUV = fp?.map(frame.toUV)
  const buildableM2 = fp ? polyArea(fp) : 0
  const minYardFp = footprint(sides, yardsM({ front: L.yards.front, rear: L.yards.rear, side: L.yards.side, streetSide: L.yards.side }, L.yards.side))
  const floorCap = L.floorAreaSqft ?? (L.floorFar && minYardFp ? L.floorFar * sqftOf(polyArea(minYardFp)) : null)

  // R1 45° plane: an upper storey steps in from the front and side yards by
  // however far its top rises above the plane's starting height.
  const insetFor = L.planeFt
    ? (r, topFt) => {
        const over = Math.max(0, topFt - L.planeFt) * FT
        if (!over || !fpUV) return r
        const s = spanAt(fpUV, (r.v0 + r.v1) / 2)
        const left = s ? Math.max(r.u0, s[0] + over) : r.u0 + over
        const right = s ? Math.min(r.u1, s[1] - over) : r.u1 - over
        const vs = fpUV.map((p) => p[1])
        return { u0: left, u1: right, v0: Math.max(r.v0, Math.min(...vs) + over), v1: r.v1 }
      }
    : null

  const parkingReq = L.parking.exempt ? 0 : L.parking.perHome
  const cars = filters.parking
  const garageM2 = cars ? m2Of(cars >= 2 ? 400 : 200) : 0
  const driveM2 = cars ? (cars >= 2 ? 18 : 10) * FT * L.yards.front * FT : 0

  /** One house, its garage at the front, sized to the floor-area cap and the garden. */
  function house({ gardenPct, keepRearM }) {
    const groundMax = lotM2 * (1 - gardenPct / 100) - driveM2
    const perFloor = floorCap ? m2Of(floorCap) / storeysWanted : Infinity
    const target = Math.max(m2Of(600), Math.min(groundMax - (keepRearM?.m2 || 0), perFloor))
    const room = keepRearM ? fpUV && clipRear(fpUV, keepRearM.depth) : fpUV
    const r = placeRect(room, target, { from: 'front' })
    if (!r) return null
    const vols = storeys(r, storeysWanted, frame, 'home', { label: 'House', insetFor })
    if (cars && vols.length) {
      // Garage in the front corner of the ground floor.
      const gw = Math.min(r.u1 - r.u0, (cars >= 2 ? 20 : 10) * FT)
      const gr = { u0: r.u0, u1: r.u0 + gw, v0: r.v0, v1: Math.min(r.v1, r.v0 + 20 * FT) }
      return { rect: r, vols: [...withGarage(vols[0], gr, frame), ...vols.slice(1)] }
    }
    return { rect: r, vols }
  }

  function clipRear(poly, depthM) {
    const vs = poly.map((p) => p[1])
    const vmax = Math.max(...vs) - depthM
    const out = []
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      if (p[1] <= vmax) out.push(p)
      if (p[1] <= vmax !== q[1] <= vmax) {
        const t = (vmax - p[1]) / (q[1] - p[1])
        out.push([p[0] + (q[0] - p[0]) * t, vmax])
      }
    }
    return out.length >= 3 ? out : null
  }

  /** Detached ADU at the back: 4 ft from side and rear lines, 6 ft clear of the house. */
  function adu(houseRect) {
    const yardFt = L.adu.yardFt
    const zone = footprint(sides, yardsM({ front: L.yards.front, rear: yardFt, side: yardFt, streetSide: L.yards.side }, yardFt))
    if (!zone) return null
    const behind = zone.map(frame.toUV)
    const gapV = houseRect.v1 + 6 * FT
    const clipped = behind.filter(() => true)
    const room = clipFront(clipped, gapV)
    const r = placeRect(room, m2Of(L.adu.detachedSqft), { from: 'rear', maxD: 30 * FT })
    if (!r || sqftOf(rectArea(r)) < 300) return null
    return { rect: r, vols: storeys(r, 1, frame, 'adu', { label: 'ADU' }) }
  }

  const common = (o) => {
    // House size counts an attached garage (LAMC §12.03 Residential Floor Area).
    const houseM2 = o.vols.filter((v) => v.use === 'home' || v.use === 'garage').reduce((s, v) => s + rectArea(v.rect), 0)
    const groundM2 = o.footprints.reduce((s, r) => s + rectArea(r), 0)
    const aduM2 = o.vols.filter((v) => v.use === 'adu').reduce((s, v) => s + rectArea(v.rect), 0)
    const gardenM2 = Math.max(0, lotM2 - groundM2 - driveM2)
    const topFt = Math.max(...o.vols.map((v) => v.z1 / FT)) + ROOF_FT
    const homes = o.homes
    const reqParking = parkingReq * (o.sb9 ? 0.5 : 1) * (o.sb9 ? homes : 1)
    const houseSqft = sqftOf(houseM2)
    const checks = [
      check('height', 'Height', topFt <= L.flatRoofFt + 0.01, `${fmt(topFt)} ft (flat roof)`, `${fmt(L.flatRoofFt)} ft`),
      L.storeysMax && check('storeys', 'Storeys', storeysWanted <= L.storeysMax, `${storeysWanted}`, `${L.storeysMax}`),
      floorCap &&
        (() => {
          // SB 9 can't be blocked by a size limit below two 800 sq ft homes.
          const cap = o.sb9 ? Math.max(floorCap, 1600) : floorCap
          return check('floor', o.sb9 ? 'Floor area (both homes)' : 'House size', houseSqft <= cap + 1, `${fmt(houseSqft)} sq ft`, `${fmt(cap)} sq ft`, {
            note: L.floorEstimate ? 'Hillside limit is an estimate.' : o.sb9 ? null : 'Includes the attached garage.',
          })
        })(),
      check('homes', 'Homes', true, o.homesText, o.homesLimit),
      check('parking', 'Parking', cars >= reqParking, `${cars} space${cars === 1 ? '' : 's'}`, L.parking.exempt ? 'none required (transit)' : `${reqParking} required`),
      check('garden', 'Garden', (gardenM2 / lotM2) * 100 >= filters.garden - 0.5, `${Math.round((gardenM2 / lotM2) * 100)}% of the lot`, `${filters.garden}% wanted`, { soft: true }),
      check('yards', 'Setbacks', true, 'inside every yard', 'by design'),
    ].filter(Boolean)
    return {
      ...o,
      stats: {
        floorSqft: houseSqft + sqftOf(aduM2),
        houseSqft,
        aduSqft: sqftOf(aduM2),
        homes,
        parking: cars,
        parkingRequired: reqParking,
        gardenPct: Math.round((gardenM2 / lotM2) * 100),
        heightFt: topFt,
        storeys: storeysWanted,
      },
      checks,
      ok: checks.every((c) => c.ok || c.soft),
    }
  }

  const options = []

  const h = house({ gardenPct: filters.garden })
  if (h)
    options.push(
      common({
        id: 'house',
        name: 'House',
        tagline: `${storeysWanted}-storey house${cars ? ` with a ${cars}-car garage` : ''}`,
        vols: h.vols,
        footprints: [h.rect],
        homes: 1,
        homesText: '1 house',
        homesLimit: '1 + ADUs',
      }),
    )

  if (filters.adu) {
    // Leave room behind the house for the ADU (~30 ft deep).
    const h2 = house({ gardenPct: filters.garden, keepRearM: { depth: 34 * FT, m2: m2Of(800) } })
    const a = h2 && adu(h2.rect)
    if (h2 && a)
      options.push(
        common({
          id: 'house-adu',
          name: 'House + ADU',
          tagline: `House plus a ${fmt(sqftOf(rectArea(a.rect)))} sq ft backyard home`,
          vols: [...h2.vols, ...a.vols],
          footprints: [h2.rect, a.rect],
          homes: 2,
          homesText: '1 house + 1 ADU',
          homesLimit: '1 + ADUs',
          extraNote: 'A State-law ADU up to 800 sq ft doesn’t count against the house-size limit.',
        }),
      )
    else
      options.push({
        id: 'house-adu',
        name: 'House + ADU',
        tagline: 'No room for a detached ADU behind the house',
        vols: [],
        footprints: [],
        unavailable: 'The back of the lot is too small for a detached ADU (4 ft from the side and rear lines, 6 ft from the house). An attached ADU or a garage conversion may still work.',
        checks: [],
        stats: null,
        ok: false,
      })
  }

  if (L.sb9) {
    // SB 9: two homes, front and back, with 4 ft side and rear yards.
    const sbFp = footprint(sides, yardsM({ front: L.yards.front, rear: L.sb9.yardFt, side: L.sb9.yardFt, streetSide: L.yards.side }, L.sb9.yardFt))
    const room = sbFp?.map(frame.toUV)
    // Each home's ground floor; together within the size limit (never below two 800 sq ft homes).
    const cap = Math.max(floorCap ?? 1600, 1600)
    const each = Math.max(m2Of(800) / storeysWanted, Math.min(m2Of(cap) / 2 / storeysWanted, (lotM2 * (1 - filters.garden / 100) - driveM2) / 2))
    const front = placeRect(room, each, { from: 'front', maxD: 40 * FT })
    const backRoom = front && clipFront(room, front.v1 + 6 * FT)
    const back = placeRect(backRoom, each, { from: 'rear', maxD: 40 * FT })
    if (front && back)
      options.push(
        common({
          id: 'sb9',
          name: 'Two homes (SB 9)',
          tagline: 'A front house and a back house on one lot',
          vols: [...storeys(front, storeysWanted, frame, 'home', { label: 'Home 1', insetFor }), ...storeys(back, storeysWanted, frame, 'home', { label: 'Home 2', insetFor })],
          footprints: [front, back],
          homes: 2,
          homesText: '2 homes',
          homesLimit: '2 under SB 9',
          sb9: true,
          extraNote: 'SB 9 allows 4 ft side and rear yards and at most 1 parking space per home (none near transit).',
        }),
      )
  }

  return { options, buildableSqft: sqftOf(buildableM2) }
}

/* ---------- Apartments: R2, RD, R3, R4 ---------- */

const STALL_W = 8.5 * FT
const STALL_D = 18 * FT
const AISLE = 24 * FT

/** Parking spaces that fit on a ground floor of this rectangle (90° stalls, one aisle). */
function stallsIn(r) {
  const w = r.u1 - r.u0
  const d = r.v1 - r.v0
  const perRow = Math.floor(w / STALL_W)
  if (d >= 2 * STALL_D + AISLE) return perRow * 2
  if (d >= STALL_D + AISLE) return perRow
  return 0
}

function apartmentOptions({ sides, limits, filters, frame, lotM2 }) {
  const L = limits
  const n = filters.floors
  const heightFt = n * STOREY_FT + ROOF_FT
  const y = L.yardsFor(n)
  const yards = { front: L.yards.front, rear: y.rear, side: y.side, streetSide: y.side }
  const fp = footprint(sides, yardsM(yards, y.side))
  if (!fp) return { options: [] }
  const room = fp.map(frame.toUV)
  const floorCap = L.floorAreaSqft
  const homeSqft = filters.homeSize
  const rooms = filters.homeSize >= 850 ? 4 : filters.homeSize >= 650 ? 3 : 2 // habitable rooms, assumed
  const perHomeParking = L.parking.exempt ? 0 : L.parking.byRooms[rooms > 3 ? 2 : rooms === 3 ? 1 : 0]

  function block({ id, name, homesWanted, gardenPct, parkingMode }) {
    const groundMax = lotM2 * (1 - gardenPct / 100)
    const r = placeRect(room, groundMax, { from: 'front' })
    if (!r) return null
    const floorM2 = rectArea(r)
    const core = n >= 3 || homesWanted > 4 ? m2Of(300) : m2Of(120)
    // With only a few homes allowed, each one grows (up to 2,400 sq ft) instead of leaving floors empty.
    const size = homesWanted <= 4 ? Math.min(2400, Math.max(homeSqft, (floorCap * 0.9) / homesWanted)) : homeSqft
    const perFloorHomes = Math.max(1, Math.floor((floorM2 * 0.88 - core) / m2Of(size)))
    const parkingFloors = parkingMode === 'ground' ? 1 : 0
    const homeFloors = Math.max(0, n - parkingFloors)
    const capacity = perFloorHomes * homeFloors
    const homes = Math.min(homesWanted, capacity)
    // Floors needed: by floor area when homes are large, by count otherwise.
    const usedFloors = Math.min(homeFloors, Math.max(Math.ceil(homes / perFloorHomes), Math.ceil((homes * m2Of(size)) / (floorM2 * 0.88))))
    const vols = []
    if (parkingFloors) vols.push(...storeys(r, 1, frame, 'parking', { label: 'Parking' }))
    vols.push(...storeys(r, usedFloors, frame, 'home', { z0: parkingFloors * STOREY_FT * FT, startFloor: parkingFloors, label: 'Homes' }))
    const stalls = parkingFloors ? stallsIn(r) : 0
    const required = Math.ceil(homes * perHomeParking)
    const resM2 = vols.filter((v) => v.use === 'home').reduce((s, v) => s + rectArea(v.rect), 0)
    const topFt = Math.max(...vols.map((v) => v.z1 / FT)) + ROOF_FT
    const gardenM2 = Math.max(0, lotM2 - floorM2)
    const checks = [
      L.heightFt ? check('height', 'Height', topFt <= L.heightFt + 0.01, `${fmt(topFt)} ft`, `${fmt(L.heightFt)} ft`, { note: L.heightUnsure ? 'Hillside RD limit is 36 or 45 ft — confirm.' : null }) : check('height', 'Height', true, `${fmt(topFt)} ft`, 'no limit in feet'),
      check('floor', 'Floor area', sqftOf(resM2) <= floorCap + 1, `${fmt(sqftOf(resM2))} sq ft`, `${fmt(floorCap)} sq ft`, { note: 'Parking floors don’t count.' }),
      check('homes', 'Homes', homes <= L.homes.max, `${homes}`, `${L.homes.max}`),
      check('parking', 'Parking', L.parking.exempt || stalls >= required, `${stalls} space${stalls === 1 ? '' : 's'}`, L.parking.exempt ? 'none required (transit)' : `${required} required`),
      L.openSpace && check('open', 'Open space', sqftOf(gardenM2) * 0.6 >= homes * L.openSpace.perHome[1], `≈ ${fmt(sqftOf(gardenM2) * 0.6)} sq ft usable`, `${fmt(homes * L.openSpace.perHome[1])} sq ft`, { soft: true, note: 'Estimate: front and side yards don’t count.' }),
      check('garden', 'Garden', (gardenM2 / lotM2) * 100 >= gardenPct - 0.5, `${Math.round((gardenM2 / lotM2) * 100)}% of the lot`, `${gardenPct}% wanted`, { soft: true }),
      check('yards', 'Setbacks', true, 'inside every yard', 'by design'),
    ].filter(Boolean)
    return {
      id,
      name,
      tagline: `${homes} home${homes === 1 ? '' : 's'}${homes <= 4 ? ` of about ${fmt(size)} sq ft` : ''} on ${usedFloors + parkingFloors} floor${usedFloors + parkingFloors === 1 ? '' : 's'}${parkingFloors ? ', parking on the ground floor' : ''}`,
      vols,
      footprints: [r],
      stats: { floorSqft: sqftOf(resM2), homes, parking: stalls, parkingRequired: required, gardenPct: Math.round((gardenM2 / lotM2) * 100), heightFt: topFt, storeys: usedFloors + parkingFloors, perFloorHomes },
      checks,
      ok: checks.every((c) => c.ok || c.soft),
      homesShort: homes < homesWanted ? `Only ${homes} of ${homesWanted} homes fit at this size and height.` : null,
    }
  }

  /** Townhomes: rows along the street (a 26 ft drive between rows), each home with its own garage, up to 3 floors. */
  function townhomes() {
    const tf = Math.min(n, 3)
    const unitW = 18 * FT
    const rowD = 40 * FT
    const budget = lotM2 * (1 - filters.garden / 100)
    const vols = []
    const rects = []
    let count = 0
    let area = 0
    let zone = room
    for (let row = 0; zone && row < 12; row++) {
      const r = placeRect(zone, Infinity, { from: 'front', maxD: rowD, minD: 30 * FT })
      if (!r || r.v1 - r.v0 < 30 * FT) break
      const fit = Math.floor((r.u1 - r.u0) / unitW)
      const take = Math.min(fit, L.homes.max - count, Math.floor((budget - area) / (unitW * (r.v1 - r.v0))))
      if (take < 1) break
      const u0 = (r.u0 + r.u1) / 2 - (take * unitW) / 2
      for (let i = 0; i < take; i++) {
        const ur = { u0: u0 + i * unitW, u1: u0 + (i + 1) * unitW - 0.1, v0: r.v0, v1: r.v1 }
        const s2 = storeys(ur, tf, frame, 'home', { label: `Townhome ${count + i + 1}` })
        if (!L.parking.exempt && s2[0]) {
          const g = { ...ur, v1: Math.min(ur.v1, ur.v0 + 20 * FT) }
          vols.push(...withGarage(s2[0], g, frame), ...s2.slice(1))
        } else vols.push(...s2)
      }
      const used = { u0, u1: u0 + take * unitW, v0: r.v0, v1: r.v1 }
      rects.push(used)
      area += rectArea(used)
      count += take
      zone = clipFront(zone, r.v1 + 26 * FT)
    }
    if (count < 2) return null
    const resM2 = vols.reduce((acc, v) => acc + rectArea(v.rect), 0)
    const topFt = tf * STOREY_FT + ROOF_FT
    const gardenM2 = Math.max(0, lotM2 - area)
    const stalls = L.parking.exempt ? 0 : count * 2
    const required = L.parking.exempt ? 0 : Math.ceil(count * L.parking.byRooms[2])
    const checks = [
      L.heightFt ? check('height', 'Height', topFt <= L.heightFt + 0.01, `${fmt(topFt)} ft`, `${fmt(L.heightFt)} ft`) : check('height', 'Height', true, `${fmt(topFt)} ft`, 'no limit in feet'),
      check('floor', 'Floor area', sqftOf(resM2) <= floorCap + 1, `${fmt(sqftOf(resM2))} sq ft`, `${fmt(floorCap)} sq ft`, { note: 'Garages counted in, to be safe.' }),
      check('homes', 'Homes', count <= L.homes.max, `${count}`, `${L.homes.max}`),
      check('parking', 'Parking', L.parking.exempt || stalls >= required, `${stalls} spaces`, L.parking.exempt ? 'none required (transit)' : `${required} required`),
      check('garden', 'Garden', (gardenM2 / lotM2) * 100 >= filters.garden - 0.5, `${Math.round((gardenM2 / lotM2) * 100)}% of the lot`, `${filters.garden}% wanted`, { soft: true }),
      check('yards', 'Setbacks', true, 'inside every yard', 'by design'),
    ]
    const words = ['one', 'two', 'three']
    return {
      id: 'townhomes',
      name: 'Townhomes',
      tagline: `${count} ${words[tf - 1]}-storey townhomes in ${rects.length} row${rects.length === 1 ? '' : 's'}${L.parking.exempt ? '' : ', each with a garage'}`,
      vols,
      footprints: rects,
      stats: { floorSqft: sqftOf(resM2), homes: count, parking: stalls, parkingRequired: required, gardenPct: Math.round((gardenM2 / lotM2) * 100), heightFt: topFt, storeys: tf },
      checks,
      ok: checks.every((c) => c.ok || c.soft),
    }
  }

  // Off is allowed even where parking is required — the option is then marked red.
  const parkingMode = filters.parking ? 'ground' : 'none'
  const most = block({ id: 'most', name: 'Most homes', homesWanted: filters.homes, gardenPct: filters.garden, parkingMode })
  const fewerHomes = Math.max(1, Math.round((most?.stats.homes ?? filters.homes) * 0.6))
  const fewer = (most?.stats.homes ?? 0) > 1 && block({
    id: 'garden',
    name: 'Fewer homes, bigger garden',
    homesWanted: fewerHomes,
    gardenPct: Math.min(70, filters.garden + 20),
    parkingMode,
  })
  return { options: [most, townhomes(), fewer].filter(Boolean) }
}

/* ---------- Entry point ---------- */

/** Sensible starting filters for a lot, from its limits. */
export function defaultFilters(limits) {
  if (!limits) return null
  if (limits.kind === 'single') {
    const byHeight = Math.max(1, Math.floor((limits.flatRoofFt - ROOF_FT) / STOREY_FT))
    return { floors: Math.min(2, limits.storeysMax ?? 3, byHeight), parking: limits.parking.exempt ? 0 : 2, garden: 35, adu: true }
  }
  const byHeight = limits.heightFt ? Math.max(1, Math.floor((limits.heightFt - ROOF_FT) / STOREY_FT)) : 6
  return { floors: byHeight, homes: limits.homes.max, homeSize: 850, parking: limits.parking.exempt ? 0 : 1, garden: 25 }
}

/**
 * All options for a lot. Returns { options, unavailable } — `unavailable`
 * explains why there are none (zone not covered, odd lot shape, …).
 */
export function designOptions({ sides, rules, filters }) {
  const L = rules?.limits
  if (!L) return { options: [], unavailable: 'Design options need the zoning rules for this lot, and Zone Lab doesn’t calculate them here — see “What you can build”.' }
  if (L.splitHeight) return { options: [], unavailable: 'This R1 variation zone has separate front and rear height limits; design options for it are coming later.' }
  if (!sides?.convex) return { options: [], unavailable: 'Design options need a simple (convex) lot shape — this lot is irregular.' }
  const frame = streetFrame(sides)
  const lotUV = sides.pts.map(frame.toUV)
  const lotM2 = polyArea(sides.pts)
  const ctx = { sides, limits: L, filters, frame, lotUV, lotM2 }
  const res = L.kind === 'single' ? houseOptions(ctx) : apartmentOptions(ctx)
  for (const o of res.options) o.toXY = frame.toXY
  const assumptions = [
    'Concept massing: rectangular buildings with 10 ft storeys and flat roofs.',
    L.kind === 'single'
      ? 'Garage at the front with a driveway across the front yard; 6 ft kept between buildings.'
      : `Homes of about ${filters.homeSize} sq ft; stairs, lift and corridors take ~12% of each floor plus a core. Parking stalls 8.5 × 18 ft with a 24 ft aisle.`,
    'Not an architectural plan, and not a ReMo plan, price or approval.',
  ]
  return { ...res, assumptions }
}
