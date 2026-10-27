/**
 * Small helpers for the public ArcGIS REST services the City of Los Angeles
 * and LA County publish (ZIMAS, GeoHub, County GIS). Everything is read live,
 * straight from the agency, at the moment the visitor asks.
 *
 * Each call has its own timeout so one slow server can't hold up the report;
 * a source that fails is reported as unavailable, never silently skipped.
 */

const DEFAULT_TIMEOUT = 12000

/** fetch → JSON, with a timeout and ArcGIS's in-body errors turned into throws. */
export async function getJSON(url, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('timed out')), timeout)
  const onAbort = () => ctrl.abort(signal.reason)
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data?.error) throw new Error(data.error.message || 'service error')
    return data
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

const qs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v)}`)
    .join('&')

/**
 * Features of a layer that intersect any of the given points ([lng, lat]).
 * Several points (lot centre + inner points) catch lots that straddle a
 * boundary without counting a hairline overlap at the lot edge.
 */
export async function queryPoints(layerUrl, points, { fields = '*', geometry = false, distance, ...opts } = {}) {
  const geom =
    points.length === 1
      ? { x: points[0][0], y: points[0][1], spatialReference: { wkid: 4326 } }
      : { points, spatialReference: { wkid: 4326 } }
  const data = await getJSON(
    `${layerUrl}/query?${qs({
      geometry: geom,
      geometryType: points.length === 1 ? 'esriGeometryPoint' : 'esriGeometryMultipoint',
      inSR: 4326,
      spatialRel: 'esriSpatialRelIntersects',
      outFields: fields,
      returnGeometry: geometry,
      outSR: 4326,
      // Optional search radius around the point(s), in metres.
      distance,
      units: distance ? 'esriSRUnit_Meter' : undefined,
      f: 'json',
    })}`,
    opts,
  )
  return data.features || []
}

/** Features in a lng/lat box. */
export async function queryEnvelope(layerUrl, [w, s, e, n], { fields = '*', geometry = true, where, ...opts } = {}) {
  const data = await getJSON(
    `${layerUrl}/query?${qs({
      geometry: `${w},${s},${e},${n}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: 4326,
      spatialRel: 'esriSpatialRelIntersects',
      where,
      outFields: fields,
      returnGeometry: geometry,
      outSR: 4326,
      resultRecordCount: 2000,
      f: 'json',
    })}`,
    opts,
  )
  return data.features || []
}

/** Features matching an attribute filter. */
export async function queryWhere(layerUrl, where, { fields = '*', geometry = true, ...opts } = {}) {
  const data = await getJSON(
    `${layerUrl}/query?${qs({ where, outFields: fields, returnGeometry: geometry, outSR: 4326, f: 'json' })}`,
    opts,
  )
  return data.features || []
}

/** Run named lookups in parallel; each settles to { ok, value | error, ms }. */
export async function allSettled(tasks) {
  const names = Object.keys(tasks)
  const t0 = performance.now()
  const results = await Promise.allSettled(names.map((n) => tasks[n]()))
  return Object.fromEntries(
    results.map((r, i) => [
      names[i],
      r.status === 'fulfilled'
        ? { ok: true, value: r.value, ms: Math.round(performance.now() - t0) }
        : { ok: false, error: String(r.reason?.message || r.reason) },
    ]),
  )
}
