import { localFrame } from '../data/lotGeometry.js'
import { loadTerrain } from '../site/siteData.js'
import { SLOPE_BANDS } from './tables.js'

/**
 * A rough slope map of a hillside lot from public terrain data (AWS Terrain
 * Tiles — USGS 3DEP elevations), so the report can estimate the hillside
 * floor-area limit. The legal number needs a slope analysis stamped by a
 * surveyor or civil engineer (LAMC §12.21 C.10(b)(1)); this is labelled as an
 * estimate everywhere it appears.
 *
 * Returns { bands: share of the lot in each slope band, mean: average slope % }.
 */

const STEP = 1.5 // metres between samples
const SPAN = 4 // metres either side for the slope at each sample

function inside([x, y], pts) {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

export async function lotSlope(parcel, { signal } = {}) {
  const frame = localFrame(parcel.centre[0], parcel.centre[1])
  const pts = parcel.ring.map(frame.toXY)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const pad = SPAN + 2
  const [w, s] = frame.toLngLat([Math.min(...xs) - pad, Math.min(...ys) - pad])
  const [e, n] = frame.toLngLat([Math.max(...xs) + pad, Math.max(...ys) + pad])
  const height = await loadTerrain([w, s, e, n], { signal })
  const h = (x, y) => height(frame.toLngLat([x, y]))

  const counts = SLOPE_BANDS.map(() => 0)
  let total = 0
  let sum = 0
  for (let x = Math.min(...xs) + STEP / 2; x < Math.max(...xs); x += STEP)
    for (let y = Math.min(...ys) + STEP / 2; y < Math.max(...ys); y += STEP) {
      if (!inside([x, y], pts)) continue
      const gx = (h(x + SPAN, y) - h(x - SPAN, y)) / (2 * SPAN)
      const gy = (h(x, y + SPAN) - h(x, y - SPAN)) / (2 * SPAN)
      const pct = Math.hypot(gx, gy) * 100
      let band = 0
      while (band + 1 < SLOPE_BANDS.length && pct >= SLOPE_BANDS[band + 1]) band++
      counts[band]++
      total++
      sum += pct
    }
  if (!total) return null
  return { bands: counts.map((c) => c / total), mean: sum / total }
}
