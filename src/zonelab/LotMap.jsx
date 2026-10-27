import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { AttributionControl, LngLatBounds, Map as MapLibre, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getJSON } from './data/arcgis.js'

setWorkerUrl(workerUrl)

/**
 * The live map of Los Angeles: satellite imagery, 3D buildings, the County's
 * lot lines, and the City's current zoning coloured by category (fetched for
 * whatever is on screen, straight from City Planning's GeoHub layer).
 *
 * All free sources, credited in the corner: Esri World Imagery,
 * OpenFreeMap (OpenStreetMap data), City of LA GeoHub, LA County GIS.
 */

const ZONING_URL = 'https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/Zoning/FeatureServer/15'
const PARCEL_TILES = 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/tile/{z}/{y}/{x}'
const FONT = ['Noto Sans Regular']
const FONT_BOLD = ['Noto Sans Bold']

/** Zoning categories → colours (conventional planning palette). */
export const ZONE_COLORS = [
  ['Single Family Residential', '#f3d35b', 'Single-family'],
  ['Suburban', '#f6e39b', null],
  ['Residential', '#efc24a', null],
  ['Multiple Family Residential', '#f0954a', 'Multi-family'],
  ['Residential-Mixed', '#e69a62', null],
  ['Commercial', '#e5534b', 'Commercial'],
  ['Commercial-Mixed', '#d4588a', 'Mixed use'],
  ['Industrial', '#8f5bd6', 'Industrial'],
  ['Industrial-Mixed', '#a97bd9', null],
  ['Hybrid Industrial', '#a87ad8', null],
  ['Manufacturing', '#7a4fc0', null],
  ['Open Space', '#5fc58b', 'Open space'],
  ['Agricultural', '#9fc271', null],
  ['Public Facilities', '#4fb9e3', 'Public'],
  ['Public', '#7fb2d4', null],
  ['Parking', '#b9b9b9', null],
  ['Freeway', '#9a9a9a', null],
]

const colorExpr = ['match', ['get', 'CATEGORY'], ...ZONE_COLORS.flatMap(([k, c]) => [k, c]), '#cccccc']

const EMPTY = { type: 'FeatureCollection', features: [] }
const LA_VIEW = { center: [-118.36, 34.04], zoom: 10.4, pitch: 38, bearing: -12 }

function style() {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      sat: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      },
      omt: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      },
      parcels: {
        type: 'raster',
        tiles: [PARCEL_TILES],
        tileSize: 256,
        minzoom: 15,
        maxzoom: 20,
        attribution: 'Parcels © LA County',
      },
      zoning: { type: 'geojson', data: EMPTY, attribution: 'Zoning © City of Los Angeles' },
      lot: { type: 'geojson', data: EMPTY },
      ping: { type: 'geojson', data: EMPTY },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#1c1715' } },
      { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.25, 'raster-contrast': 0.05, 'raster-brightness-max': 0.92 } },
      {
        id: 'zoning-fill',
        type: 'fill',
        source: 'zoning',
        paint: { 'fill-color': colorExpr, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.42, 18, 0.28] },
      },
      {
        id: 'zoning-line',
        type: 'line',
        source: 'zoning',
        paint: { 'line-color': colorExpr, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.8, 18, 2] },
      },
      { id: 'parcels', type: 'raster', source: 'parcels', minzoom: 16, paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 16, 0, 17, 0.75] } },
      {
        id: 'roads',
        type: 'symbol',
        source: 'omt',
        'source-layer': 'transportation_name',
        minzoom: 13,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 18, 13],
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(20,16,14,0.85)', 'text-halo-width': 1.4 },
      },
      {
        id: 'buildings',
        type: 'fill-extrusion',
        source: 'omt',
        'source-layer': 'building',
        minzoom: 14,
        filter: ['!=', ['get', 'hide_3d'], true],
        paint: {
          'fill-extrusion-color': '#f4f1ea',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 5],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.82],
        },
      },
      {
        id: 'zoning-label',
        type: 'symbol',
        source: 'zoning',
        minzoom: 15.5,
        layout: {
          'text-field': ['get', 'Zoning'],
          'text-font': FONT_BOLD,
          'text-size': 11,
          'text-max-width': 14,
          'symbol-placement': 'point',
        },
        paint: { 'text-color': '#28211e', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.5 },
      },
      { id: 'lot-fill', type: 'fill', source: 'lot', paint: { 'fill-color': '#c99b41', 'fill-opacity': 0.28 } },
      {
        id: 'lot-glow',
        type: 'line',
        source: 'lot',
        paint: { 'line-color': '#ddb75f', 'line-width': 10, 'line-blur': 8, 'line-opacity': 0.55 },
      },
      { id: 'lot-line', type: 'line', source: 'lot', paint: { 'line-color': '#ffd27a', 'line-width': 2.6 } },
      {
        id: 'ping',
        type: 'circle',
        source: 'ping',
        paint: {
          'circle-radius': 9,
          'circle-color': 'rgba(201,155,65,0.35)',
          'circle-stroke-color': '#ffd27a',
          'circle-stroke-width': 2,
        },
      },
    ],
  }
}

const ZONING_MIN_ZOOM = 14

/**
 * Props: onPick([lng, lat]) when the visitor taps the map; zoningOn.
 * Ref API: showLot(ring), clearLot(), ping([lng, lat]), flyToLot(ring, padding),
 * flyHome(), map (the MapLibre instance).
 */
export const LotMap = forwardRef(function LotMap({ onPick, zoningOn = true, onZoningState }, ref) {
  const el = useRef(null)
  const map = useRef(null)
  const zoningAbort = useRef(null)
  const pickRef = useRef(onPick)
  const zoningRef = useRef(zoningOn)
  const stateRef = useRef(onZoningState)
  pickRef.current = onPick
  stateRef.current = onZoningState

  useEffect(() => {
    const m = new MapLibre({
      container: el.current,
      style: style(),
      ...LA_VIEW,
      maxPitch: 75,
      attributionControl: false,
      // Keep to the LA basin.
      maxBounds: [
        [-119.2, 33.4],
        [-117.6, 34.7],
      ],
    })
    map.current = m
    m.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')
    m.addControl(new AttributionControl({ compact: true, customAttribution: 'Search by Esri' }), 'bottom-right')
    // Start with the credits folded into the ⓘ button (MapLibre opens them on load).
    m.once('load', () => m.getContainer().querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'))
    m.getCanvas().style.cursor = 'crosshair'

    m.on('click', (e) => pickRef.current?.([e.lngLat.lng, e.lngLat.lat]))

    // City zoning for what's on screen, straight from City Planning's layer.
    const loadZoning = async () => {
      zoningAbort.current?.abort()
      if (!zoningRef.current || m.getZoom() < ZONING_MIN_ZOOM) {
        stateRef.current?.(m.getZoom() < ZONING_MIN_ZOOM ? 'zoom' : 'off')
        if (!zoningRef.current) m.getSource('zoning')?.setData(EMPTY)
        return
      }
      const ctrl = new AbortController()
      zoningAbort.current = ctrl
      const b = m.getBounds()
      const pad = 0.002
      const tol = m.getZoom() >= 17 ? 0.000005 : 0.00002
      const url = `${ZONING_URL}/query?geometry=${b.getWest() - pad},${b.getSouth() - pad},${b.getEast() + pad},${b.getNorth() + pad}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=Zoning,CATEGORY&outSR=4326&maxAllowableOffset=${tol}&resultRecordCount=2000&f=geojson`
      stateRef.current?.('loading')
      try {
        const data = await getJSON(url, { signal: ctrl.signal, timeout: 15000 })
        if (ctrl.signal.aborted) return
        m.getSource('zoning')?.setData(data)
        stateRef.current?.('on')
      } catch {
        if (!ctrl.signal.aborted) stateRef.current?.('error')
      }
    }
    m.on('moveend', loadZoning)
    m.on('load', loadZoning)
    m.__loadZoning = loadZoning

    return () => {
      zoningAbort.current?.abort()
      m.remove()
    }
  }, [])

  useEffect(() => {
    zoningRef.current = zoningOn
    const m = map.current
    if (!m) return
    const vis = zoningOn ? 'visible' : 'none'
    const apply = () => {
      for (const id of ['zoning-fill', 'zoning-line', 'zoning-label']) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', vis)
      m.__loadZoning?.()
    }
    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [zoningOn])

  useImperativeHandle(ref, () => ({
    get map() {
      return map.current
    },
    showLot(ring) {
      map.current?.getSource('lot')?.setData({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: {},
      })
    },
    clearLot() {
      map.current?.getSource('lot')?.setData(EMPTY)
    },
    ping(lngLat) {
      map.current?.getSource('ping')?.setData(lngLat ? { type: 'Feature', geometry: { type: 'Point', coordinates: lngLat }, properties: {} } : EMPTY)
    },
    flyToLot(ring, padding) {
      const m = map.current
      if (!m) return
      const b = ring.reduce((acc, p) => acc.extend(p), new LngLatBounds(ring[0], ring[0]))
      const cam = m.cameraForBounds(b, { padding, maxZoom: 19.2 })
      if (!cam) return
      m.flyTo({ ...cam, zoom: Math.min(cam.zoom, 19.2), pitch: 52, bearing: m.getBearing(), duration: 1800, essential: true })
    },
    flyIn(ring, padding) {
      const m = map.current
      if (!m) return Promise.resolve()
      const b = ring.reduce((acc, p) => acc.extend(p), new LngLatBounds(ring[0], ring[0]))
      const cam = m.cameraForBounds(b, { padding, maxZoom: 20 })
      return new Promise((resolve) => {
        m.once('moveend', resolve)
        m.flyTo({ center: cam.center, zoom: Math.min(20, cam.zoom + 0.6), pitch: 70, bearing: m.getBearing() + 25, duration: 1500, essential: true })
      })
    },
    flyHome() {
      map.current?.flyTo({ ...LA_VIEW, duration: 1600 })
    },
  }))

  return <div ref={el} className="zl-map" />
})
