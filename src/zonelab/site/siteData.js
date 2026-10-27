import { getJSON, queryEnvelope } from '../data/arcgis.js'
import { localFrame } from '../data/lotGeometry.js'
import { SITE } from '../data/sources.js'
import { loadStreets } from './streets.js'

/**
 * Everything the 3D site model needs around one lot, read live:
 *   - the ground photo (Esri World Imagery tiles, stitched)
 *   - ground heights (AWS Terrain Tiles)
 *   - every building nearby, with its measured roof height (LARIAC)
 *
 * Coordinates are metres in a flat frame centred on the lot: x = east,
 * y = north. The scene turns y into three.js −z.
 */

const FT = 0.3048

/**
 * How far the 3D camera sits from the lot (m), and the square area loaded
 * around it — wide enough that the edge stays hidden in the haze.
 */
function siteBox(ring, frame) {
  const xy = ring.map(frame.toXY)
  const r = Math.max(...xy.map(([x, y]) => Math.hypot(x, y)))
  const span = r * 2.4 + 40
  const half = Math.min(700, Math.max(150, span * 1.7))
  const [w, s] = frame.toLngLat([-half, -half])
  const [e, n] = frame.toLngLat([half, half])
  return { half, span, bbox: [w, s, e, n] }
}

/* ---------- Tile maths (Web Mercator) ---------- */

const lng2tile = (lng, z) => ((lng + 180) / 360) * 2 ** z
const lat2tile = (lat, z) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}

/* ---------- Ground photo ---------- */

/** Most tiles across the photo: 10 × 256 px ≈ 2,560 px, plenty for a block. */
const MAX_TILES_ACROSS = 10

async function bitmap(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`imagery HTTP ${res.status}`)
  return createImageBitmap(await res.blob())
}

/**
 * Stitches Esri World Imagery tiles covering the box into one canvas, at the
 * sharpest level (up to zoom 20, ~0.12 m per pixel) that keeps it a sensible
 * size. These are the same cached tiles the map shows, so they arrive fast.
 * `uvAt([lng, lat])` gives the texture coordinate of any point.
 */
async function loadImagery([w, s, e, n], { signal }) {
  let z = 20
  while (z > 15 && Math.floor(lng2tile(e, z)) - Math.floor(lng2tile(w, z)) + 1 > MAX_TILES_ACROSS) z--
  for (; z >= 15; z--) {
    const x0 = Math.floor(lng2tile(w, z))
    const x1 = Math.floor(lng2tile(e, z))
    const y0 = Math.floor(lat2tile(n, z))
    const y1 = Math.floor(lat2tile(s, z))
    const canvas = document.createElement('canvas')
    canvas.width = (x1 - x0 + 1) * 256
    canvas.height = (y1 - y0 + 1) * 256
    const g = canvas.getContext('2d')
    const jobs = []
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        jobs.push(bitmap(SITE.imagery.replace('{z}', z).replace('{x}', x).replace('{y}', y), signal).then((b) => g.drawImage(b, (x - x0) * 256, (y - y0) * 256)))
    try {
      await Promise.all(jobs)
    } catch (err) {
      if (signal?.aborted) throw err
      continue // a missing tile at this level — try one level coarser
    }
    return {
      canvas,
      zoom: z,
      uvAt: ([lng, lat]) => [(lng2tile(lng, z) - x0) / (x1 - x0 + 1), 1 - (lat2tile(lat, z) - y0) / (y1 - y0 + 1)],
    }
  }
  throw new Error('imagery: no tiles')
}

/* ---------- Ground height ---------- */


async function tilePixels(x, y, z, signal) {
  const url = SITE.terrain.replace('{z}', z).replace('{x}', x).replace('{y}', y)
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`terrain HTTP ${res.status}`)
  const bmp = await createImageBitmap(await res.blob())
  const c = new OffscreenCanvas(256, 256)
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(bmp, 0, 0)
  return g.getImageData(0, 0, 256, 256).data
}

/**
 * A height sampler (metres above sea level) for any lng/lat in the box,
 * bilinear between terrain pixels.
 */
export async function loadTerrain([w, s, e, n], { signal }) {
  const z = SITE.terrainZoom
  const x0 = Math.floor(lng2tile(w, z))
  const x1 = Math.floor(lng2tile(e, z))
  const y0 = Math.floor(lat2tile(n, z))
  const y1 = Math.floor(lat2tile(s, z))
  const tiles = new Map()
  const jobs = []
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) jobs.push(tilePixels(x, y, z, signal).then((px) => tiles.set(`${x}/${y}`, px)))
  await Promise.all(jobs)

  const at = (px, py) => {
    const tx = Math.floor(px / 256)
    const ty = Math.floor(py / 256)
    const d = tiles.get(`${tx}/${ty}`)
    if (!d) return null
    const i = ((py - ty * 256) * 256 + (px - tx * 256)) * 4
    return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768
  }

  return ([lng, lat]) => {
    // Pixel centres sit at +0.5.
    const fx = lng2tile(lng, z) * 256 - 0.5
    const fy = lat2tile(lat, z) * 256 - 0.5
    const ix = Math.floor(fx)
    const iy = Math.floor(fy)
    const tx = fx - ix
    const ty = fy - iy
    const h00 = at(ix, iy)
    const h10 = at(ix + 1, iy) ?? h00
    const h01 = at(ix, iy + 1) ?? h00
    const h11 = at(ix + 1, iy + 1) ?? h10
    if (h00 == null) return 0
    return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty
  }
}

/* ---------- Buildings ---------- */

const signedArea = (pts) => {
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  return a / 2
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

/**
 * ArcGIS rings → polygons ({ outer, holes }). ArcGIS outer rings run
 * clockwise (negative signed area); holes run the other way.
 */
function polygons(rings) {
  const outers = []
  const holes = []
  for (const r of rings) (signedArea(r) < 0 ? outers : holes).push(r)
  const polys = outers.map((outer) => ({ outer, holes: [] }))
  for (const h of holes) polys.find((p) => inside(h[0], p.outer))?.holes.push(h)
  return polys
}

async function loadBuildings(bbox, frame, { signal }) {
  const feats = await queryEnvelope(SITE.buildings.url, bbox, {
    fields: SITE.buildings.fields,
    where: "CODE = 'Building'",
    signal,
    timeout: 20000,
  })
  const out = []
  for (const f of feats) {
    const h = Number(f.attributes.HEIGHT)
    if (!f.geometry?.rings || !(h > 0)) continue
    const rings = f.geometry.rings.map((r) => r.map(frame.toXY))
    for (const p of polygons(rings)) out.push({ id: f.attributes.BLD_ID, heightFt: h, height: h * FT, ...p })
  }
  return { buildings: out, capped: feats.length >= 2000 }
}

/* ---------- Everything ---------- */

/**
 * Loads the site around a lot. Imagery and buildings are optional — if one
 * fails the model still shows, and `missing` says what's not there.
 */
export async function loadSite(parcel, { signal } = {}) {
  const [lng0, lat0] = parcel.centre
  const frame = localFrame(lng0, lat0)
  const { half, span, bbox } = siteBox(parcel.ring, frame)

  const [img, ter, bld, st] = await Promise.allSettled([
    loadImagery(bbox, { signal }),
    loadTerrain(bbox, { signal }),
    loadBuildings(bbox, frame, { signal }),
    loadStreets(bbox, frame, { signal }),
  ])
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')

  const sampleLngLat = ter.status === 'fulfilled' ? ter.value : () => 0
  const base = sampleLngLat([lng0, lat0])
  /** Ground height (m) at a local x/y, relative to the lot centre. */
  const ground = ([x, y]) => sampleLngLat(frame.toLngLat([x, y])) - base

  let imagery = null
  if (img.status === 'fulfilled') {
    const { canvas, zoom, uvAt } = img.value
    imagery = { canvas, zoom, uvAt: (xy) => uvAt(frame.toLngLat(xy)) }
  }

  // Keep the lot's own buildings apart: they're drawn as "on the lot today".
  const lot = parcel.ring.map(frame.toXY)
  const buildings = bld.status === 'fulfilled' ? bld.value.buildings : []
  for (const b of buildings) {
    const c = b.outer.reduce((a, p) => [a[0] + p[0] / b.outer.length, a[1] + p[1] / b.outer.length], [0, 0])
    b.onLot = inside(c, lot)
  }

  return {
    half,
    span,
    lot,
    groundAtLot: base,
    ground,
    imagery,
    buildings,
    roads: st.status === 'fulfilled' ? st.value.roads : [],
    trees: st.status === 'fulfilled' ? st.value.trees : [],
    capped: bld.status === 'fulfilled' && bld.value.capped,
    missing: [
      img.status !== 'fulfilled' && 'aerial photo',
      ter.status !== 'fulfilled' && 'ground heights',
      bld.status !== 'fulfilled' && 'neighbouring buildings',
      ...(st.status === 'fulfilled' ? st.value.missing : ['streets', 'street trees']),
    ].filter(Boolean),
  }
}
