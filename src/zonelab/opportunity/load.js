import { getJSON } from '../data/arcgis.js'

/**
 * The Opportunity map's data: where land is burned, cleared, rebuilding,
 * empty, being demolished or newly built — read live for the area on screen.
 *
 *   Fire lots     LA County Public Works, "Parcels 2025 Fires Debris Removal"
 *                 (damage, debris cleared, permit status, rebuild progress)
 *   Rebuild cases LA County EPIC-LA fire recovery cases (progress 1–7, by AIN)
 *   City permits  City of LA LADBS "Building Permits Issued" (daily); also used
 *                 to tell which burned City lots (Palisades) are rebuilding
 *   Vacant lots   LA County Assessor parcels, use codes ending in "V"
 *
 * Signals, not intentions: this shows what's happening on a lot, never what
 * an owner wants. No owner names or mailing addresses are requested.
 */

const COUNTY = 'https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services'
const FIRE_LOTS = `${COUNTY}/Parcels_Debris_Removal_Public/FeatureServer/0`
const REBUILDS = `${COUNTY}/EPICLA_Eaton_Palisades/FeatureServer/0`
const PARCELS = 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0'
const LADBS = 'https://data.lacity.org/resource/pi9x-tg5x.json'
const FIRE_DATE = '2025-01-07'

export const KINDS = {
  burned: { label: 'Burned (2025 fires)', color: '#e5534b', group: 'fire' },
  cleared: { label: 'Cleared — no rebuild yet', color: '#f0954a', group: 'fire' },
  applied: { label: 'Rebuild applied / in review', color: '#f3d35b', group: 'fire' },
  building: { label: 'Permit issued / building', color: '#4f9be3', group: 'fire' },
  done: { label: 'Rebuild completed', color: '#5fc58b', group: 'fire' },
  vacant: { label: 'Vacant lot', color: '#bdbdbd', group: 'land' },
  demo: { label: 'Demolition permit', color: '#a07ad8', group: 'permit' },
  newbuild: { label: 'New home / ADU permit', color: '#f6f3ec', group: 'permit' },
}

/** How far in to zoom before each kind of data loads (keeps requests small). */
export const MIN_ZOOM = { fire: 11.5, permit: 12.5, land: 13.5 }

const enc = encodeURIComponent
const toISO = (d) => d.toISOString().slice(0, 10)
const title = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bCa\b/, 'CA')

/** Page through an ArcGIS layer (2,000 records a page) up to `max`. */
async function arcgisAll(url, params, { signal, max = 8000 } = {}) {
  const out = []
  for (let offset = 0; offset < max; offset += 2000) {
    const q = Object.entries({ ...params, resultOffset: offset, resultRecordCount: 2000, f: 'json' })
      .map(([k, v]) => `${k}=${enc(v)}`)
      .join('&')
    const d = await getJSON(`${url}/query?${q}`, { signal, timeout: 25000 })
    out.push(...(d.features || []))
    if (!d.exceededTransferLimit && (d.features || []).length < 2000) break
  }
  return out
}

const envelope = ([w, s, e, n]) => ({
  geometry: `${w},${s},${e},${n}`,
  geometryType: 'esriGeometryEnvelope',
  inSR: 4326,
  spatialRel: 'esriSpatialRelIntersects',
  returnGeometry: false,
})

/* ---------- City permits (LADBS) ---------- */

async function cityPermits([w, s, e, n], since, { signal }) {
  const where = [
    `within_box(geolocation, ${n}, ${w}, ${s}, ${e})`,
    `issue_date >= '${since}'`,
    `permit_type in ('Bldg-New', 'Bldg-Demolition')`,
    `permit_sub_type in ('1 or 2 Family Dwelling', 'Apartment', 'Commercial')`,
  ].join(' AND ')
  const url = `${LADBS}?$select=permit_nbr,primary_address,zip_code,permit_type,permit_sub_type,issue_date,status_desc,valuation,work_desc,lat,lon&$where=${enc(where)}&$order=issue_date DESC&$limit=5000`
  const rows = await getJSON(url, { signal, timeout: 25000 })
  return rows
    .filter((r) => Number(r.lat) && Number(r.lon))
    .map((r) => {
      const demo = r.permit_type === 'Bldg-Demolition'
      const adu = !demo && /\badu\b|accessory dwelling/i.test(r.work_desc || '')
      return {
        id: `p-${r.permit_nbr}`,
        lng: Number(r.lon),
        lat: Number(r.lat),
        kind: demo ? 'demo' : 'newbuild',
        lotType: r.permit_sub_type === 'Apartment' ? 'apartments' : r.permit_sub_type === 'Commercial' ? 'commercial' : 'homes',
        title: demo ? 'Demolition permit' : adu ? 'New ADU permit' : `New ${r.permit_sub_type === 'Apartment' ? 'apartment building' : r.permit_sub_type === 'Commercial' ? 'commercial building' : 'home'} permit`,
        address: title(`${r.primary_address}${r.zip_code ? ` ${r.zip_code}` : ''}`),
        date: r.issue_date?.slice(0, 10) || null,
        status: r.status_desc || null,
        value: Number(r.valuation) || null,
        detail: (r.work_desc || '').slice(0, 220),
        source: 'City of LA — LADBS permits',
        raw: r,
      }
    })
}

/* ---------- Fire lots ---------- */

async function fireLots(bbox, { signal }) {
  const [lots, cases] = await Promise.all([
    arcgisAll(
      FIRE_LOTS,
      {
        ...envelope(bbox),
        where: "DAMAGE IN ('Destroyed (>50%)', 'Major (26-50%)')",
        outFields: 'AIN,SITUSFULLADDRESS,DAMAGE,DEBRIS_CLEARED,ROE_STATUS,FSO_PKG_APPROVED_USACE,REBUILD_PROGRESS_NUM,LCITY,COMMUNITY,FIRE_NAME,USETYPE,TOTAL_UNITS,CENTER_LAT,CENTER_LON',
      },
      { signal, max: 12000 },
    ),
    arcgisAll(
      REBUILDS,
      { ...envelope(bbox), where: 'REBUILD_PROGRESS_NUM IS NOT NULL', outFields: 'MAIN_AIN,REBUILD_PROGRESS_NUM,REBUILD_PROGRESS,APPLY_DATE,STATUS,DESCRIPTION,PERMIT_VALUATION' },
      { signal, max: 8000 },
    ).catch(() => []),
  ])

  // Furthest rebuild stage per lot from the County's cases.
  const byAin = new Map()
  for (const f of cases) {
    const a = f.attributes
    const k = String(a.MAIN_AIN || '').replace(/\D/g, '')
    const prev = byAin.get(k)
    if (!prev || a.REBUILD_PROGRESS_NUM > prev.REBUILD_PROGRESS_NUM) byAin.set(k, a)
  }

  return lots
    .map((f) => f.attributes)
    .filter((a) => a.CENTER_LAT && a.CENTER_LON)
    .map((a) => {
      const c = byAin.get(String(a.AIN))
      const progress = Math.max(Number(a.REBUILD_PROGRESS_NUM) || 0, c?.REBUILD_PROGRESS_NUM || 0)
      return {
        id: `f-${a.AIN}`,
        lng: a.CENTER_LON,
        lat: a.CENTER_LAT,
        ain: String(a.AIN),
        fire: a.FIRE_NAME,
        city: a.LCITY,
        community: a.COMMUNITY,
        damage: a.DAMAGE,
        // Cleared: the County's flag, or the debris programme's final sign-off.
        cleared: a.DEBRIS_CLEARED === 'Yes' || /final sign off/i.test(a.ROE_STATUS || '') || Boolean(a.FSO_PKG_APPROVED_USACE),
        progress,
        stage: c?.REBUILD_PROGRESS || null,
        caseStatus: c?.STATUS || null,
        caseDate: c?.APPLY_DATE ? toISO(new Date(c.APPLY_DATE)) : null,
        caseValue: c?.PERMIT_VALUATION || null,
        caseDetail: c?.DESCRIPTION || null,
        lotType: /residential/i.test(a.USETYPE || '') ? (a.TOTAL_UNITS > 2 ? 'apartments' : 'homes') : 'commercial',
        address: title(a.SITUSFULLADDRESS),
      }
    })
}

/** Stage of a fire lot → map category. */
function fireKind(l) {
  if (l.progress >= 7) return 'done'
  if (l.progress >= 5) return 'building'
  if (l.progress >= 1) return 'applied'
  return l.cleared ? 'cleared' : 'burned'
}

/**
 * City-permitted rebuilds (Palisades): a new-building permit since the fire,
 * on or right next to a burned City lot, moves it on to "building" or "done".
 */
function applyCityRebuilds(lots, permits) {
  const news = permits.filter((p) => p.kind === 'newbuild' && p.date >= FIRE_DATE)
  if (!news.length) return
  const kx = Math.cos((34 * Math.PI) / 180)
  for (const l of lots) {
    if (l.city !== 'Los Angeles' || l.progress >= 5) continue
    let best = null
    for (const p of news) {
      const d = Math.hypot((p.lng - l.lng) * kx, p.lat - l.lat) * 111_000
      if (d < 30 && (!best || d < best.d)) best = { p, d }
    }
    if (best) {
      const finished = /final|cofo issued/i.test(best.p.status || '')
      l.progress = finished ? 7 : 5
      l.stage = finished ? 'Permit finaled (City of LA)' : 'Building permit issued (City of LA)'
      l.caseDate = best.p.date
      l.caseValue = best.p.value
      l.caseDetail = best.p.detail
      l.cityPermit = best.p.raw.permit_nbr
    }
  }
}

/* ---------- Vacant lots ---------- */

async function vacantLots(bbox, { signal }) {
  const rows = await arcgisAll(
    PARCELS,
    { ...envelope(bbox), where: "UseCode LIKE '%V'", outFields: 'AIN,SitusFullAddress,UseCode,UseDescription,TaxRateCity,CENTER_LAT,CENTER_LON' },
    { signal, max: 6000 },
  )
  return rows
    .map((f) => f.attributes)
    .filter((a) => a.CENTER_LAT && a.CENTER_LON)
    .map((a) => ({
      id: `v-${a.AIN}`,
      lng: a.CENTER_LON,
      lat: a.CENTER_LAT,
      ain: String(a.AIN),
      kind: 'vacant',
      lotType: /^0[1-5]/.test(a.UseCode) ? (/^0[2-5]/.test(a.UseCode) ? 'apartments' : 'homes') : 'commercial',
      title: `Vacant ${/^0/.test(a.UseCode) ? 'residential' : /^[1-2]/.test(a.UseCode) ? 'commercial' : /^3/.test(a.UseCode) ? 'industrial' : ''} land`.replace('  ', ' '),
      address: title(a.SitusFullAddress) || null,
      city: title(a.TaxRateCity),
      detail: a.UseDescription ? `Assessor use: ${a.UseDescription}` : null,
      source: 'LA County Assessor',
    }))
}

/* ---------- Everything for the view ---------- */

/**
 * Loads what's switched on, for the box on screen. Returns
 *   { items, notes } — items are map points; notes say what wasn't loaded
 *   (zoomed out too far, or a source didn't answer).
 */
export async function loadOpportunities(bbox, zoom, { kinds, since }, { signal } = {}) {
  const want = (group) => Object.entries(KINDS).some(([k, v]) => v.group === group && kinds[k])
  const notes = []
  const tasks = {}
  const needFire = want('fire') && zoom >= MIN_ZOOM.fire
  const needPermits = (want('permit') && zoom >= MIN_ZOOM.permit) || (needFire && zoom >= MIN_ZOOM.permit)
  if (want('fire') && !needFire) notes.push('Zoom in to load fire lots')
  if (want('permit') && zoom < MIN_ZOOM.permit) notes.push('Zoom in further to load permits')
  if (kinds.vacant && zoom < MIN_ZOOM.land) notes.push('Zoom in further to load vacant lots')

  if (needFire) tasks.fire = fireLots(bbox, { signal })
  if (needPermits) tasks.permits = cityPermits(bbox, needFire ? (since < FIRE_DATE ? since : FIRE_DATE) : since, { signal })
  if (kinds.vacant && zoom >= MIN_ZOOM.land) tasks.vacant = vacantLots(bbox, { signal })

  const names = Object.keys(tasks)
  const settled = await Promise.allSettled(names.map((n) => tasks[n]))
  const got = Object.fromEntries(names.map((n, i) => [n, settled[i]]))
  for (const [n, r] of Object.entries(got)) if (r.status === 'rejected' && !signal?.aborted) notes.push(`${{ fire: 'Fire lots', permits: 'City permits', vacant: 'Vacant lots' }[n]} didn’t load — try again`)

  const permits = got.permits?.status === 'fulfilled' ? got.permits.value : []
  const items = []
  if (got.fire?.status === 'fulfilled') {
    const lots = got.fire.value
    applyCityRebuilds(lots, permits)
    for (const l of lots) {
      const kind = fireKind(l)
      if (!kinds[kind]) continue
      items.push({
        ...l,
        kind,
        title: `${l.fire} fire — ${KINDS[kind].label.toLowerCase()}`,
        date: l.caseDate,
        status: l.stage || (l.cleared ? 'Debris cleared' : l.damage),
        value: l.caseValue,
        detail: l.caseDetail ? l.caseDetail.slice(0, 220) : `Damage: ${l.damage}${l.community ? ` · ${l.community}` : ''}`,
        source: l.cityPermit ? 'LA County (fire lots) + City of LA (permit)' : 'LA County Public Works / EPIC-LA',
      })
    }
  }
  for (const p of permits) if (kinds[p.kind] && p.date >= since) items.push(p)
  if (got.vacant?.status === 'fulfilled') items.push(...got.vacant.value)
  return { items, notes }
}

/** Current results as CSV text (no personal data). */
export function toCSV(items) {
  const cols = ['category', 'title', 'address', 'status', 'date', 'value_usd', 'lat', 'lng', 'apn', 'source', 'detail']
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const rows = items.map((i) => [KINDS[i.kind].label, i.title, i.address, i.status, i.date, i.value, i.lat, i.lng, i.ain, i.source, i.detail].map(esc).join(','))
  return [cols.join(','), ...rows].join('\n')
}
