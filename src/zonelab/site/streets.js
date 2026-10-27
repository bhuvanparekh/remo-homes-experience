import { queryEnvelope } from '../data/arcgis.js'
import { SITE } from '../data/sources.js'

/**
 * Streets and street trees around a lot, for the eye-level view.
 *
 * Road widths come from each centreline's official street type (Mobility
 * Plan 2035 street standards, as listed in the City's Complete Street Design
 * Manual): e.g. a "Local Street - Standard" is a 60 ft right-of-way with a
 * 36 ft roadway. Real streets vary, so this is a visual model, not a survey.
 *
 * Output is in the site frame (metres, x = east, y = north).
 */

const FT = 0.3048

/** [right-of-way ft, roadway ft] by street type. */
const WIDTHS = [
  [/boulevard i\b/i, 136, 100],
  [/boulevard ii\b/i, 110, 80],
  [/avenue i\b/i, 100, 70],
  [/avenue ii\b/i, 86, 56],
  [/avenue iii\b/i, 72, 46],
  [/industrial collector/i, 68, 48],
  [/hillside collector/i, 50, 40],
  [/collector/i, 66, 40],
  [/industrial local/i, 60, 44],
  [/hillside local|hillside/i, 44, 36],
  [/local street - limited|limited/i, 50, 30],
  [/local/i, 60, 36],
]

function widthsFor(designation) {
  const d = designation || ''
  for (const [re, row, road] of WIDTHS) if (re.test(d)) return { row: row * FT, road: road * FT, arterial: /avenue|boulevard/i.test(d) }
  return { row: 60 * FT, road: 36 * FT, arterial: false }
}

const PALMS = /washingtonia|phoenix|syagrus|archontophoenix|trachycarpus|chamaerops|palm/i
const CONIFERS = /pinus|cupressus|araucaria|cedrus|podocarpus|pine|cypress|redwood|sequoia/i

/** Street centrelines, alleys and street trees in a lng/lat box. */
export async function loadStreets(bbox, frame, { signal } = {}) {
  const [streets, alleys, trees] = await Promise.allSettled([
    queryEnvelope(SITE.streets.url, bbox, { fields: SITE.streets.fields, signal, timeout: 20000 }),
    queryEnvelope(SITE.alleys.url, bbox, { fields: SITE.alleys.fields, signal, timeout: 20000 }),
    queryEnvelope(SITE.trees.url, bbox, { fields: SITE.trees.fields, signal, timeout: 20000 }),
  ])

  const roads = []
  if (streets.status === 'fulfilled') {
    for (const f of streets.value) {
      const a = f.attributes
      const w = widthsFor(a.Street_Designation_WO_Mod || a.Street_Designation)
      for (const path of f.geometry?.paths || []) {
        roads.push({ kind: 'street', name: [a.STNAME, a.STSFX].filter(Boolean).join(' '), pts: path.map(frame.toXY), ...w })
      }
    }
  }
  if (alleys.status === 'fulfilled') {
    for (const f of alleys.value) for (const path of f.geometry?.paths || []) roads.push({ kind: 'alley', pts: path.map(frame.toXY), row: 20 * FT, road: 20 * FT, arterial: false })
  }

  const treeList = []
  if (trees.status === 'fulfilled') {
    for (const f of trees.value) {
      const tip = f.attributes.TOOLTIP || ''
      const species = (tip.match(/Species:\s*([^\n\\]+)/) || [])[1]?.trim() || ''
      const botanical = (tip.match(/Botanical Name:\s*([^\n\\]+)/) || [])[1]?.trim() || ''
      // Empty planting sites and stumps aren't trees.
      if (!species || /vacant|stump|unknown/i.test(species)) continue
      const g = f.geometry
      if (!g || !Number.isFinite(g.x)) continue
      const name = `${species} ${botanical}`
      treeList.push({
        at: frame.toXY([g.x, g.y]),
        kind: PALMS.test(name) ? 'palm' : CONIFERS.test(name) ? 'conifer' : 'broadleaf',
        seed: (f.attributes.TreeID || 0) % 997,
      })
    }
  }

  return {
    roads,
    trees: treeList,
    missing: [streets.status !== 'fulfilled' && 'streets', trees.status !== 'fulfilled' && 'street trees'].filter(Boolean),
  }
}

/** Nearest point on any street centreline to a point: { at, dist, road }. */
export function nearestStreet(roads, [x, y]) {
  let best = null
  for (const r of roads) {
    if (r.kind !== 'street') continue
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, ay] = r.pts[i]
      const [bx, by] = r.pts[i + 1]
      const dx = bx - ax
      const dy = by - ay
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
      const px = ax + dx * t
      const py = ay + dy * t
      const dist = Math.hypot(x - px, y - py)
      if (!best || dist < best.dist) best = { at: [px, py], dist, road: r, dir: [dx / (Math.hypot(dx, dy) || 1), dy / (Math.hypot(dx, dy) || 1)] }
    }
  }
  return best
}
