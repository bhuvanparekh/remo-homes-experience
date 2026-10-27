import { allSettled, queryPoints, queryWhere } from './arcgis.js'
import { describeLot } from './lotGeometry.js'
import { AGENCY, COASTAL, HAZARDS, LAYERS, OVERLAYS } from './sources.js'
import { parseZone } from '../zoneCode.js'

/**
 * The Lot Report: everything public and official about one lot, read live.
 *
 *   1. The lot   — LA County Assessor parcel at the tapped point (outline,
 *                  APN, address, what's built there now).
 *   2. Fast tier — zoning, overlays and hazards from City GeoHub and County
 *                  GIS, all in parallel. The report is shown at this point.
 *   3. Confirm   — ZIMAS, the City's live zoning system (~9 s): confirms the
 *                  zoning and adds General Plan, community plan, coastal zone.
 *
 * `onUpdate(report)` fires after steps 2 and 3, so the UI can show results
 * as they arrive. Every source's outcome is kept in `report.sources`.
 */

const sum = (vals) => vals.reduce((s, v) => s + (Number(v) || 0), 0)
const uniq = (arr) => [...new Set(arr.filter(Boolean))]

/** What the Assessor says is on the lot now (up to five buildings). */
function existingFrom(a) {
  const idx = [1, 2, 3, 4, 5].filter((i) => a[`YearBuilt${i}`] || a[`SQFTmain${i}`])
  const years = idx.map((i) => Number(a[`YearBuilt${i}`])).filter(Boolean)
  return {
    use: a.UseType || null,
    description: a.UseDescription || null,
    buildings: idx.length,
    yearBuilt: years.length ? Math.min(...years) : null,
    units: sum(idx.map((i) => a[`Units${i}`])) || null,
    bedrooms: sum(idx.map((i) => a[`Bedrooms${i}`])) || null,
    bathrooms: sum(idx.map((i) => a[`Bathrooms${i}`])) || null,
    sqft: sum(idx.map((i) => a[`SQFTmain${i}`])) || null,
    rollYear: a.Roll_Year || null,
  }
}

function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bCa\b/, 'CA')
}

/**
 * The lot at a point, from the Assessor. A tap on the street or a sidewalk
 * snaps to the nearest lot within ~15 m.
 */
async function parcelAt(lng, lat, signal) {
  const [hit] = await queryPoints(LAYERS.countyParcel.url, [[lng, lat]], { geometry: true, signal })
  if (hit) return hit
  const near = await queryPoints(LAYERS.countyParcel.url, [[lng, lat]], { geometry: true, signal, distance: 15 })
  if (!near.length) return null
  const kx = Math.cos((lat * Math.PI) / 180)
  const dist = (f) => {
    const a = f.attributes
    return Math.hypot((a.CENTER_LON - lng) * kx, a.CENTER_LAT - lat)
  }
  return near.sort((a, b) => dist(a) - dist(b))[0]
}

async function parcelByApn(apn, signal) {
  const ain = String(apn).replace(/\D/g, '')
  const [f] = await queryWhere(LAYERS.countyParcel.url, `AIN='${ain}'`, { signal })
  return f || null
}

/** Build the report for an Assessor parcel feature. */
async function reportFor(feature, { onUpdate, signal, point }) {
  const a = feature.attributes
  const lot = describeLot(feature.geometry.rings)
  const city = (a.TaxRateCity || '').trim()
  const report = {
    checkedAt: new Date(),
    point: point || lot.centre,
    parcel: {
      apn: a.APN || null,
      ain: a.AIN || null,
      address: a.SitusFullAddress ? titleCase(a.SitusFullAddress) : null,
      city: titleCase(city),
      areaSqft: lot.areaSqft,
      widthFt: lot.widthFt,
      depthFt: lot.depthFt,
      regular: lot.regular,
      ring: lot.ring,
      centre: lot.centre,
      existing: existingFrom(a),
      pin: null,
    },
    inCity: !city || /^LOS ANGELES$/i.test(city),
    zoning: null,
    overlays: [],
    hazards: [],
    generalPlan: null,
    communityPlan: null,
    confirm: { status: 'pending' },
    sources: {},
  }

  if (!report.inCity) {
    onUpdate?.({ ...report, confirm: { status: 'skipped' } })
    return report
  }

  const pts = lot.samples

  // ---- Fast tier ----
  const fast = await allSettled({
    zoning: () => queryPoints(LAYERS.zoning.url, pts, { fields: LAYERS.zoning.fields, signal }),
    cityParcel: () => queryPoints(LAYERS.cityParcel.url, [lot.centre], { fields: LAYERS.cityParcel.fields, signal }),
    ...Object.fromEntries(OVERLAYS.map((o) => [o.id, () => queryPoints(o.url, pts, { signal })])),
    ...Object.fromEntries(HAZARDS.map((h) => [h.id, () => queryPoints(h.url, pts, { signal })])),
  })
  if (signal?.aborted) return report

  for (const [k, r] of Object.entries(fast)) report.sources[k] = { ok: r.ok, error: r.error }

  if (fast.zoning.ok) {
    const zones = uniq(fast.zoning.value.map((f) => f.attributes.Zoning))
    report.zoning = {
      raw: zones[0] || null,
      all: zones,
      split: zones.length > 1,
      category: fast.zoning.value[0]?.attributes.CATEGORY || null,
      parsed: zones[0] ? parseZone(zones[0]) : null,
      source: AGENCY.geohub.name,
    }
  }
  if (fast.cityParcel.ok && fast.cityParcel.value[0]) {
    const c = fast.cityParcel.value[0].attributes
    report.parcel.pin = c.PIN || null
    report.parcel.pind = c.PIND || null
  }

  const chip = (def, r, kind) => {
    if (!r?.ok || !r.value.length) return null
    const hits = def.keep ? r.value.filter((f) => def.keep(f.attributes)) : r.value
    if (!hits.length) return null
    r = { ...r, value: hits }
    const attrs = r.value[0].attributes
    const names = uniq(r.value.map((f) => def.value(f.attributes)))
    return {
      id: def.id,
      kind,
      label: def.label,
      value: names.join(' · ') || def.label,
      level: typeof def.level === 'function' ? def.level(attrs) : def.level,
      note: def.note,
      law: def.law,
      source: AGENCY[def.agency].name,
    }
  }
  report.overlays = OVERLAYS.map((o) => chip(o, fast[o.id], 'overlay')).filter(Boolean)
  report.hazards = HAZARDS.map((h) => chip(h, fast[h.id], 'hazard')).filter(Boolean)
  report.unavailable = [...OVERLAYS, ...HAZARDS].filter((d) => !fast[d.id]?.ok).map((d) => d.label)

  onUpdate?.(structuredClone(report))

  // ---- Confirm tier: ZIMAS live ----
  const slow = await allSettled({
    zimasZoning: () => queryPoints(LAYERS.zimasZoning.url, pts, { fields: LAYERS.zimasZoning.fields, timeout: 30000, signal }),
    zimasZoning1A: () => queryPoints(LAYERS.zimasZoning1A.url, pts, { fields: LAYERS.zimasZoning1A.fields, timeout: 30000, signal }),
    generalPlan: () => queryPoints(LAYERS.generalPlan.url, [lot.centre], { timeout: 30000, signal }),
    communityPlan: () => queryPoints(LAYERS.communityPlan.url, [lot.centre], { fields: LAYERS.communityPlan.fields, timeout: 30000, signal }),
    ...Object.fromEntries(COASTAL.map((c, i) => [`coastal${i}`, () => queryPoints(c.url, pts, { timeout: 30000, signal })])),
  })
  if (signal?.aborted) return report
  for (const [k, r] of Object.entries(slow)) report.sources[k] = { ok: r.ok, error: r.error }

  if (slow.zimasZoning.ok || slow.zimasZoning1A.ok) {
    const live = uniq([
      ...(slow.zimasZoning.value || []).map((f) => f.attributes.ZONE_CMPLT),
      ...(slow.zimasZoning1A.value || []).map((f) => f.attributes.ZONE_CMPLT),
    ])
    const fastSet = report.zoning?.all || []
    const same = live.length > 0 && live.length === fastSet.length && live.every((z) => fastSet.includes(z))
    report.confirm = { status: same ? 'match' : live.length ? 'differs' : 'none', live, at: new Date() }
    // ZIMAS is the authority: if it disagrees, its answer is the one shown.
    if (!same && live.length) {
      report.zoning = {
        ...(report.zoning || {}),
        raw: live[0],
        all: live,
        split: live.length > 1,
        parsed: parseZone(live[0]),
        source: AGENCY.zimas.name,
      }
    }
  } else {
    report.confirm = { status: 'unavailable', at: new Date() }
  }

  const gp = slow.generalPlan.ok && slow.generalPlan.value[0]?.attributes
  if (gp) report.generalPlan = gp['POLYS.DESCRIPTION'] || null
  const cp = slow.communityPlan.ok && slow.communityPlan.value[0]?.attributes
  if (cp) report.communityPlan = titleCase(cp.NAME_ALF)

  const coastal = COASTAL.map((c, i) => slow[`coastal${i}`])
    .map((r, i) => (r?.ok && r.value[0] ? { ...COASTAL[i], name: r.value[0].attributes.NAME } : null))
    .filter(Boolean)
  if (coastal.length) {
    report.overlays.unshift({
      id: 'coastal',
      kind: 'overlay',
      label: 'Coastal Zone',
      value: `${coastal[0].name} · ${coastal.map((c) => c.kind).join(', ')}`,
      level: 'red',
      note: 'A Coastal Development Permit is required in addition to the building permit.',
      law: 'California Coastal Act · LAMC §12.20.2',
      source: AGENCY.zimas.name,
    })
  }

  onUpdate?.(structuredClone(report))
  return report
}

/** Report for whatever lot is at a point (null if the point is not on a lot). */
export async function lookupAt(lng, lat, opts = {}) {
  const parcel = await parcelAt(lng, lat, opts.signal)
  if (!parcel?.geometry) return null
  return reportFor(parcel, { ...opts, point: [lng, lat] })
}

/** Report for a lot by its Assessor Parcel Number (shared links). */
export async function lookupApn(apn, opts = {}) {
  const parcel = await parcelByApn(apn, opts.signal)
  if (!parcel?.geometry) return null
  return reportFor(parcel, opts)
}

/** Link to the same lot on the City's official ZIMAS site. */
export function zimasLink(parcel) {
  if (parcel?.pin) return `https://zimas.lacity.org/?pin=${encodeURIComponent(parcel.pin)}`
  if (parcel?.ain) return `https://zimas.lacity.org/?apn=${parcel.ain}`
  return 'https://zimas.lacity.org/'
}
