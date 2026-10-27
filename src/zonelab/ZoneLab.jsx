import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supportsWebGL } from '../core/webgl.js'
import { lookupApn, lookupAt } from './data/lookup.js'
import { LotMap, ZONE_COLORS } from './LotMap.jsx'
import { LotReport } from './LotReport.jsx'
import { SearchBox } from './SearchBox.jsx'
import { loadSite } from './site/siteData.js'
import { lotSides } from './rules/lotSides.js'
import { rulesFor } from './rules/engine.js'
import { lotSlope } from './rules/slope.js'
import { defaultFilters, designOptions } from './design/generate.js'
import { planFloor } from './design/floorPlans.js'
import { streetPresets, walkKeys } from './site/StreetScene.jsx'
import { closeZoneLab, setZoneLabLot, zoneLab } from './zoneLabState.js'
import '../styles/zonelab.css'

const SiteModel = lazy(() => import('./site/SiteModel.jsx').then((m) => ({ default: m.SiteModel })))

/**
 * Zone Lab: pick any lot in the City of Los Angeles and see, live from the
 * City and County, how it's zoned, what special rules and hazards apply,
 * and the lot itself in 3D among its real neighbours.
 *
 * "What you can build" (rules/engine.js) turns the zoning into heights,
 * setbacks, floor area and homes, each linked to its code section, and the
 * 3D view shows the largest building those rules allow.
 */

/** Real lots, read live when tapped — so the chips never show stale zoning. */
const SAMPLES = [
  { apn: '2120005023', name: 'Reseda', note: 'House lot' },
  { apn: '5089020034', name: 'Miracle Mile', note: 'Historic district' },
  { apn: '4238012021', name: 'Venice', note: 'Coastal' },
  { apn: '5502016014', name: 'Koreatown', note: 'Apartments' },
]

const LEGEND = ZONE_COLORS.filter(([, , label]) => label)

const isPhone = () => window.matchMedia('(max-width: 760px)').matches

/** Map padding that keeps the lot clear of the panel. */
function padding() {
  if (isPhone()) return { top: 70, bottom: Math.round(window.innerHeight * 0.08), left: 30, right: 30 }
  return { top: 90, bottom: 70, left: 70, right: 70 }
}

export default function ZoneLab() {
  const mapRef = useRef(null)
  const lookupAbort = useRef(null)
  const siteAbort = useRef(null)
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [zoningOn, setZoningOn] = useState(true)
  const [zoningState, setZoningState] = useState('zoom')
  // 'map' → 'entering' (map flies in while the site loads) → '3d'
  const [mode, setMode] = useState('map')
  const [site, setSite] = useState(null)
  const [bearing, setBearing] = useState(0)
  const [webgl] = useState(supportsWebGL)
  // Which edge of the lot is the street — needed for setbacks and the 3D envelope.
  const [sides, setSides] = useState({ state: 'idle', value: null })
  const [showEnv, setShowEnv] = useState(true)
  // Hillside lots: a slope estimate from terrain data, for the floor-area estimate.
  const [slope, setSlope] = useState(null)

  /** Look up a lot (by point or APN), showing the report as each tier arrives. */
  const run = useCallback(async (find, point) => {
    lookupAbort.current?.abort()
    siteAbort.current?.abort()
    const ctrl = new AbortController()
    lookupAbort.current = ctrl
    const map = mapRef.current
    setBusy(true)
    setError(null)
    setSite(null)
    setSides({ state: 'idle', value: null })
    setSlope(null)
    setMode('map')
    map?.ping(point || null)
    let flown = false
    const onUpdate = (r) => {
      if (ctrl.signal.aborted) return
      setReport(r)
      if (!flown) {
        flown = true
        map?.showLot(r.parcel.ring)
        map?.flyToLot(r.parcel.ring, padding())
        setZoneLabLot(r.parcel.ain)
        if (r.inCity) {
          setSides({ state: 'loading', value: null })
          lotSides(r.parcel, { signal: ctrl.signal })
            .then((v) => !ctrl.signal.aborted && setSides({ state: 'ok', value: v }))
            .catch((e) => {
              if (ctrl.signal.aborted) return
              console.warn('Zone Lab lot sides failed', e)
              setSides({ state: 'error', value: null })
            })
          if (r.overlays.some((o) => o.id === 'hillside'))
            lotSlope(r.parcel, { signal: ctrl.signal })
              .then((v) => !ctrl.signal.aborted && setSlope(v))
              .catch((e) => console.warn('Zone Lab slope failed', e))
        }
      }
    }
    try {
      const r = await find({ onUpdate, signal: ctrl.signal })
      if (ctrl.signal.aborted) return
      if (!r) {
        setReport(null)
        map?.clearLot()
        setError('No lot there — tap inside a property line, or search an address.')
      } else onUpdate(r)
    } catch (e) {
      if (!ctrl.signal.aborted) setError('The County’s lot service didn’t answer. Try again in a moment.')
      console.warn('Zone Lab lookup failed', e)
    } finally {
      if (!ctrl.signal.aborted) {
        setBusy(false)
        map?.ping(null)
      }
    }
  }, [])

  const pickPoint = useCallback(([lng, lat]) => run((o) => lookupAt(lng, lat, o), [lng, lat]), [run])
  const pickApn = useCallback((apn) => run((o) => lookupApn(apn, o)), [run])

  const clear = () => {
    lookupAbort.current?.abort()
    siteAbort.current?.abort()
    setReport(null)
    setBusy(false)
    setError(null)
    setSite(null)
    setSides({ state: 'idle', value: null })
    setSlope(null)
    setMode('map')
    mapRef.current?.clearLot()
    mapRef.current?.ping(null)
    setZoneLabLot(null)
  }

  const enter = async () => {
    if (!report || !webgl) return
    siteAbort.current?.abort()
    const ctrl = new AbortController()
    siteAbort.current = ctrl
    setMode('entering')
    const map = mapRef.current
    try {
      const [s] = await Promise.all([loadSite(report.parcel, { signal: ctrl.signal }), map?.flyIn(report.parcel.ring, padding())])
      if (ctrl.signal.aborted) return
      setBearing(map?.map?.getBearing() ?? 0)
      if (new URLSearchParams(location.search).has('debug')) window.__site = s
      setSite(s)
      setMode('3d')
    } catch (e) {
      if (ctrl.signal.aborted) return
      console.warn('Zone Lab site failed', e)
      setMode('map')
      setError('Couldn’t build the 3D view just now. The report is still live — try again in a moment.')
    }
  }

  const back = () => {
    siteAbort.current?.abort()
    setMode('map')
    if (report) mapRef.current?.flyToLot(report.parcel.ring, padding())
  }

  // A shared link (#zone?apn=…) opens straight onto that lot.
  // (Started on the next tick, so React's development double-mount can't
  // cancel it halfway.)
  useEffect(() => {
    const { apn } = zoneLab.get()
    if (!apn) return
    const t = setTimeout(() => {
      zoneLab.set({ apn: null })
      pickApn(apn)
    }, 0)
    return () => clearTimeout(t)
  }, [pickApn])

  // While open: page scroll is held; Escape steps back, then closes.
  const modeRef = useRef(mode)
  modeRef.current = mode
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('is-zonelab')
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (modeRef.current !== 'map') back()
      else closeZoneLab()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      root.classList.remove('is-zonelab')
      window.removeEventListener('keydown', onKey)
      lookupAbort.current?.abort()
      siteAbort.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const in3d = mode === '3d' && site
  const rules = useMemo(() => (report?.inCity ? rulesFor(report, sides.value, { slope }) : null), [report, sides.value, slope])

  // Design options (Phase 3): filters start from the lot's own limits and reset per lot.
  const [filters, setFilters] = useState(null)
  const [selected, setSelected] = useState(null)
  const limitsKey = rules?.limits ? `${report?.parcel.ain}|${rules.limits.kind}|${rules.limits.zone}` : null
  useEffect(() => {
    setFilters(rules?.limits ? defaultFilters(rules.limits) : null)
    setSelected(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitsKey])
  const design = useMemo(
    () => (rules?.limits && filters && sides.value ? designOptions({ sides: sides.value, rules, filters }) : null),
    [rules, filters, sides.value],
  )
  const shown = design?.options.find((o) => o.id === selected && !o.unavailable) || design?.options.find((o) => !o.unavailable) || null
  const [showDesign, setShowDesign] = useState(true)
  // 3D view: from above, or standing in the street.
  const [view, setView] = useState('aerial')
  const [presetId, setPresetId] = useState(null)
  const [presetKey, setPresetKey] = useState(0)
  const [aerialKey, setAerialKey] = useState(0)
  // Floor picked in the plan view (null = all floors); the 3D model cuts away above it.
  const [floor, setFloor] = useState(null)
  useEffect(() => setFloor(null), [shown?.id, limitsKey])
  const presets = useMemo(() => (site ? streetPresets(site, sides.value) : []), [site, sides.value])
  const preset = presets.find((p) => p.id === presetId) || presets[0] || null
  useEffect(() => {
    setView('aerial')
    setPresetId(null)
  }, [report?.parcel.ain])
  const goStreet = (id) => {
    setView('street')
    setPresetId(id ?? presets[0]?.id ?? null)
    setPresetKey((k) => k + 1)
  }
  const goAerial = () => {
    setView('aerial')
    setAerialKey((k) => k + 1)
  }
  const cutPlan = useMemo(() => (shown && floor != null ? planFloor(shown, floor, filters) : null), [shown, floor, filters])
  if (new URLSearchParams(location.search).has('debug')) window.__rules = rules
  const zoningMsg = {
    zoom: 'Zoom in to see zoning',
    loading: 'Loading zoning…',
    error: 'Zoning layer unavailable',
  }[zoningState]

  return (
    <div className={`zl ${report ? 'has-report' : ''} is-${mode}`} role="dialog" aria-modal="true" aria-labelledby="zl-title" data-lenis-prevent>
      <div className="zl__view">
        <LotMap ref={mapRef} onPick={pickPoint} zoningOn={zoningOn} onZoningState={setZoningState} />

        {!in3d && (
          <div className="zl-key">
            <button type="button" className={`zl-toggle ${zoningOn ? 'is-on' : ''}`} aria-pressed={zoningOn} onClick={() => setZoningOn((v) => !v)}>
              <span className="zl-toggle__sw" aria-hidden="true" />
              Zoning colours
            </button>
            {zoningOn && (
              <>
                {zoningMsg && <p className="zl-key__msg">{zoningMsg}</p>}
                {zoningState === 'on' && (
                  <ul className="zl-key__list">
                    {LEGEND.map(([k, c, label]) => (
                      <li key={k}>
                        <i style={{ background: c }} />
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {mode === 'entering' && (
          <p className="zl-entering" role="status">
            <span className="zl-spin" aria-hidden="true" />
            Building the block from County survey data…
          </p>
        )}

        {in3d && (
          <div className="zl-site">
            <Suspense fallback={null}>
              <SiteModel
                key={report.parcel.ain}
                site={site}
                report={report}
                envelope={showEnv ? rules?.envelope : null}
                design={showDesign ? shown : null}
                cutFloor={showDesign ? floor : null}
                cutPlan={showDesign ? cutPlan : null}
                heightLimitM={rules?.limits?.heightFt ? (rules.limits.flatRoofFt ?? rules.limits.heightFt) * 0.3048 : null}
                bearing={bearing}
                view={view}
                preset={preset ? { ...preset, key: presetKey } : null}
                resetKey={aerialKey}
              />
            </Suspense>
            <button type="button" className="zl-site__back" onClick={back}>
              ← Back to map
            </button>

            <div className="zl-view" role="group" aria-label="3D view">
              <div className="zl-view__seg">
                <button type="button" aria-pressed={view === 'aerial'} className={view === 'aerial' ? 'is-on' : ''} onClick={goAerial}>
                  Aerial
                </button>
                <button type="button" aria-pressed={view === 'street'} className={view === 'street' ? 'is-on' : ''} onClick={() => goStreet(presetId)}>
                  Street level
                </button>
              </div>
              {view === 'street' && (
                <div className="zl-view__presets">
                  {presets.map((p) => (
                    <button key={p.id} type="button" className={preset?.id === p.id ? 'is-on' : ''} onClick={() => goStreet(p.id)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {view === 'street' && (
              <>
                <p className="zl-view__hint">Drag to look around · W A S D or arrows to walk (Shift to hurry) · tap the ground to walk there</p>
                <div className="zl-pad" aria-label="Walk">
                  {[
                    ['f', '↑', 'Walk forward'],
                    ['l', '←', 'Step left'],
                    ['b', '↓', 'Walk back'],
                    ['r', '→', 'Step right'],
                  ].map(([k, sym, label]) => (
                    <button
                      key={k}
                      type="button"
                      className={`zl-pad__${k}`}
                      aria-label={label}
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture?.(e.pointerId)
                        walkKeys[k] = 1
                      }}
                      onPointerUp={() => (walkKeys[k] = 0)}
                      onPointerCancel={() => (walkKeys[k] = 0)}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="zl-site__key">
              <span>
                <i className="is-lot" /> This lot
              </span>
              <span>
                <i className="is-now" /> On the lot today
              </span>
              <span>
                <i className="is-nb" /> Neighbours, at surveyed height
              </span>
              {rules?.envelope && (
                <button type="button" aria-pressed={showEnv} onClick={() => setShowEnv((v) => !v)}>
                  <i className="is-env" /> Largest building allowed
                </button>
              )}
              {shown && (
                <button type="button" aria-pressed={showDesign} onClick={() => setShowDesign((v) => !v)}>
                  <i className="is-design" /> Design: {shown.name}
                </button>
              )}
            </div>
            <p className="zl-site__credit">
              Buildings &amp; heights: LARIAC, LA County · Streets &amp; street trees: City of LA (widths are typical for each street type) · Aerial: Esri, Maxar · Ground: AWS Terrain Tiles (USGS)
              {site.missing.length > 0 && <b> · Not loaded: {site.missing.join(', ')}</b>}
            </p>
          </div>
        )}

        <button type="button" className="zl__close" onClick={closeZoneLab} aria-label="Close Zone Lab">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M4 4l12 12M16 4 4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <aside className="zl__panel">
        {!report && (
          <div className="zl-intro">
            <p className="eyebrow">Zone Lab · City of Los Angeles</p>
            <h2 id="zl-title" className="zl__title">
              What’s the story of <span className="accent">your lot?</span>
            </h2>
            <p className="zl__lede">
              Search an address or tap any lot on the map. We read the City’s zoning and the County’s records live, the moment
              you ask.
            </p>
          </div>
        )}
        {report && (
          <h2 id="zl-title" className="sr-only">
            Zone Lab
          </h2>
        )}

        <SearchBox onFound={(hit) => pickPoint([hit.lng, hit.lat])} busy={busy} />

        {error && (
          <p className="zl-warn" role="status">
            {error}
          </p>
        )}

        {!report && (
          <div className="zl-samples">
            <p>Or try a lot:</p>
            <ul>
              {SAMPLES.map((s) => (
                <li key={s.apn}>
                  <button type="button" onClick={() => pickApn(s.apn)} disabled={busy}>
                    <b>{s.name}</b>
                    <small>{s.note}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {busy && !report && (
          <p className="zl-loading" role="status">
            <span className="zl-spin" aria-hidden="true" />
            Reading the lot from the County Assessor…
          </p>
        )}

        {report && (
          <LotReport
            report={report}
            rules={rules}
            sidesState={sides.state}
            onEnter={webgl ? enter : null}
            onClear={clear}
            entering={mode === 'entering'}
            in3d={!!in3d}
            designProps={{ option: shown, limits: rules?.limits, design, filters, setFilters, selected: shown?.id, setSelected: (id) => (setSelected(id), setShowDesign(true)), floor, setFloor: (f) => (setFloor(f), setShowDesign(true)) }}
          />
        )}

        {!report && (
          <p className="zl-fine">
            Feasibility information, not a legal determination — and not a ReMo plan, price or approval.
          </p>
        )}
      </aside>
    </div>
  )
}
