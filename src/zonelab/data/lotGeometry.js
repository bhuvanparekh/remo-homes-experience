/**
 * Lot shape maths on lng/lat polygons. Lots are small (tens of metres), so a
 * local flat projection around the lot is accurate to well under 1%.
 */

const M_PER_DEG_LAT = 110_540
const FT = 0.3048

/** A local metric frame centred on [lng0, lat0]. */
export function localFrame(lng0, lat0) {
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180)
  return {
    toXY: ([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * M_PER_DEG_LAT],
    toLngLat: ([x, y]) => [lng0 + x / kx, lat0 + y / M_PER_DEG_LAT],
  }
}

const ringArea = (pts) => {
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  return a / 2
}

function ringCentroid(pts) {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
    a += f
    cx += (pts[j][0] + pts[i][0]) * f
    cy += (pts[j][1] + pts[i][1]) * f
  }
  return a ? [cx / (3 * a), cy / (3 * a)] : pts[0]
}

function pointInRing([x, y], pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function convexHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper = []
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/** Smallest rectangle around the lot: its width, depth and angle. */
function minRect(pts) {
  const hull = convexHull(pts)
  let best = null
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]
    const b = hull[(i + 1) % hull.length]
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
    const c = Math.cos(-ang)
    const s = Math.sin(-ang)
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (const [x, y] of hull) {
      const rx = x * c - y * s
      const ry = x * s + y * c
      x0 = Math.min(x0, rx)
      x1 = Math.max(x1, rx)
      y0 = Math.min(y0, ry)
      y1 = Math.max(y1, ry)
    }
    const area = (x1 - x0) * (y1 - y0)
    if (!best || area < best.area) best = { area, w: x1 - x0, h: y1 - y0, angle: ang }
  }
  return best
}

/**
 * Everything the report needs about a lot outline (ArcGIS rings, lng/lat).
 * The largest ring is the lot; any others are ignored.
 */
export function describeLot(rings) {
  const outer = [...rings].sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0]
  const lng0 = outer.reduce((s, p) => s + p[0], 0) / outer.length
  const lat0 = outer.reduce((s, p) => s + p[1], 0) / outer.length
  const frame = localFrame(lng0, lat0)
  const xy = outer.map(frame.toXY)
  const areaM2 = Math.abs(ringArea(xy))
  const c = ringCentroid(xy)
  const centre = pointInRing(c, xy) ? c : xy[0].map((v, i) => (v + xy[Math.floor(xy.length / 2)][i]) / 2)

  // Inner sample points halfway from the centre to four spread-out corners —
  // they catch a lot split between two zones without counting edge slivers.
  const step = Math.max(1, Math.floor(xy.length / 4))
  const samples = [centre]
  for (let i = 0; i < xy.length - 1 && samples.length < 5; i += step) {
    const p = [(centre[0] + xy[i][0]) / 2, (centre[1] + xy[i][1]) / 2]
    if (pointInRing(p, xy)) samples.push(p)
  }

  const rect = minRect(xy)
  const short = Math.min(rect.w, rect.h)
  const long = Math.max(rect.w, rect.h)

  return {
    ring: outer,
    centre: frame.toLngLat(centre),
    samples: samples.map(frame.toLngLat),
    areaSqft: areaM2 / (FT * FT),
    widthFt: short / FT,
    depthFt: long / FT,
    /** True if the lot is close to a rectangle (dimensions are then exact). */
    regular: areaM2 / rect.area > 0.93,
  }
}
