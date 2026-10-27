import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Fog,
  PlaneGeometry,
  Shape,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { designFacade, HouseLikeBuildings, StreetCam, Streets, Trees } from './StreetScene.jsx'

/**
 * The lot in 3D, on the real ground: the aerial photo draped over measured
 * ground heights, every neighbouring building at its surveyed roof height,
 * and the lot outlined in gold with the length of each edge.
 *
 * Renders only when something moves (frameloop 'demand'), so it sits idle
 * on the GPU while the visitor reads the report.
 *
 * Site data comes from siteData.js (metres, x = east, y = north); here north
 * becomes three.js −z.
 */

const FT = 0.3048
const SKY = '#dfe3e4'
const GOLD = '#ffd27a'

/** Local (x east, y north, h up) → three.js position. */
const P = (x, y, h = 0) => [x, h, -y]

/* ---------- Ground ---------- */

function Ground({ site, onTap }) {
  const { gl } = useThree()
  const geom = useMemo(() => {
    const { half, ground, imagery } = site
    const seg = 96
    const g = new PlaneGeometry(half * 2, half * 2, seg, seg)
    const pos = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      pos.setZ(i, ground([x, y]))
      if (imagery) uv.setXY(i, ...imagery.uvAt([x, y]))
    }
    g.rotateX(-Math.PI / 2)
    g.computeVertexNormals()
    return g
  }, [site])

  const tex = useMemo(() => {
    if (!site.imagery) return null
    const t = new CanvasTexture(site.imagery.canvas)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    return t
  }, [site, gl])

  useEffect(
    () => () => {
      geom.dispose()
      tex?.dispose()
    },
    [geom, tex],
  )

  return (
    <mesh
      geometry={geom}
      receiveShadow
      onPointerUp={onTap ? (e) => e.delta < 6 && onTap([e.point.x, -e.point.z]) : undefined}
    >
      <meshLambertMaterial map={tex} color={tex ? '#ffffff' : '#cfc8bc'} />
    </mesh>
  )
}

/* ---------- Buildings ---------- */

/** Lowest ground under a footprint, so no building floats on a slope. */
const baseOf = (site, outer) => Math.min(...outer.map((p) => site.ground(p)))

function extrude(site, b) {
  const shape = new Shape(b.outer.map(([x, y]) => new Vector2(x, y)))
  for (const h of b.holes) shape.holes.push(new Shape(h.map(([x, y]) => new Vector2(x, y))))
  const g = new ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false, curveSegments: 1 })
  g.rotateX(-Math.PI / 2)
  g.translate(0, baseOf(site, b.outer), 0)
  return g
}

function mergedBuildings(site, onLot) {
  const parts = []
  for (const b of site.buildings) {
    if (b.onLot !== onLot) continue
    try {
      parts.push(extrude(site, b))
    } catch {
      /* a malformed outline — skip that one building */
    }
  }
  if (!parts.length) return null
  const g = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  return g
}

function Buildings({ site, hideLot = false, skipAround = false }) {
  const around = useMemo(() => mergedBuildings(site, false), [site])
  const onLot = useMemo(() => mergedBuildings(site, true), [site])
  useEffect(
    () => () => {
      around?.dispose()
      onLot?.dispose()
    },
    [around, onLot],
  )
  return (
    <>
      {around && !skipAround && (
        <mesh geometry={around} castShadow receiveShadow>
          <meshLambertMaterial color="#f2eee7" />
        </mesh>
      )}
      {onLot && !hideLot && (
        <mesh geometry={onLot} castShadow renderOrder={2}>
          <meshLambertMaterial color="#e9c77e" transparent opacity={0.62} depthWrite={false} />
        </mesh>
      )}
    </>
  )
}

/* ---------- The lot ---------- */

/** Lot edges, with near-straight runs of short segments joined into one edge. */
export function lotEdges(lot) {
  const pts = lot[0][0] === lot.at(-1)[0] && lot[0][1] === lot.at(-1)[1] ? lot.slice(0, -1) : lot
  const keep = pts.filter((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length]
    const b = pts[(i + 1) % pts.length]
    const ux = p[0] - a[0]
    const uy = p[1] - a[1]
    const vx = b[0] - p[0]
    const vy = b[1] - p[1]
    const cos = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1)
    return cos < 0.996 // corners turn more than ~5°
  })
  const corners = keep.length >= 3 ? keep : pts
  return corners.map((a, i) => {
    const b = corners[(i + 1) % corners.length]
    return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) }
  })
}

/** The lot boundary sampled every metre, so lines follow the ground. */
function drape(site, lot, step = 1) {
  const out = []
  for (let i = 0; i < lot.length - 1; i++) {
    const [ax, ay] = lot[i]
    const [bx, by] = lot[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step))
    for (let k = 0; k < n; k++) {
      const t = k / n
      const p = [ax + (bx - ax) * t, ay + (by - ay) * t]
      out.push([p[0], p[1], site.ground(p)])
    }
  }
  out.push(out[0])
  return out
}

/** Gold ribbon on the ground and a soft glowing fence along the lot line. */
function LotOutline({ site }) {
  const { ribbon, fence } = useMemo(() => {
    const ring = site.lot.at(-1)[0] === site.lot[0][0] ? site.lot : [...site.lot, site.lot[0]]
    const pts = drape(site, ring)
    const W = 0.22
    const H = 1.6
    const rPos = []
    const fPos = []
    const fCol = []
    const gold = new Color(GOLD)
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay, ah] = pts[i]
      const [bx, by, bh] = pts[i + 1]
      const len = Math.hypot(bx - ax, by - ay) || 1
      const nx = (-(by - ay) / len) * W
      const ny = ((bx - ax) / len) * W
      const lift = 0.12
      const q = [P(ax - nx, ay - ny, ah + lift), P(ax + nx, ay + ny, ah + lift), P(bx + nx, by + ny, bh + lift), P(bx - nx, by - ny, bh + lift)]
      rPos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3])
      const f = [P(ax, ay, ah), P(bx, by, bh), P(bx, by, bh + H), P(ax, ay, ah + H)]
      fPos.push(...f[0], ...f[1], ...f[2], ...f[0], ...f[2], ...f[3])
      // Bright at the ground, fading out at the top.
      const lo = [gold.r, gold.g, gold.b, 0.5]
      const hi = [gold.r, gold.g, gold.b, 0]
      fCol.push(...lo, ...lo, ...hi, ...lo, ...hi, ...hi)
    }
    const ribbon = new BufferGeometry()
    ribbon.setAttribute('position', new BufferAttribute(new Float32Array(rPos), 3))
    const fence = new BufferGeometry()
    fence.setAttribute('position', new BufferAttribute(new Float32Array(fPos), 3))
    fence.setAttribute('color', new BufferAttribute(new Float32Array(fCol), 4))
    return { ribbon, fence }
  }, [site])

  useEffect(
    () => () => {
      ribbon.dispose()
      fence.dispose()
    },
    [ribbon, fence],
  )

  return (
    <>
      <mesh geometry={ribbon} renderOrder={3}>
        <meshBasicMaterial color={GOLD} toneMapped={false} side={DoubleSide} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      <mesh geometry={fence} renderOrder={4}>
        <meshBasicMaterial vertexColors transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
    </>
  )
}

/* ---------- The largest building the rules allow ---------- */

const ENV = '#8fd6ea'

/**
 * The legal envelope from the rules engine: a glassy solid with bright edges,
 * standing on the real ground (heights are measured from grade, so each
 * corner rises from the ground beneath it).
 */
function Envelope({ site, env }) {
  const { fill, edges } = useMemo(() => {
    const at = ([x, y, z]) => P(x, y, site.ground([x, y]) + z)
    const tri = []
    const seg = []
    for (const f of env.faces) {
      const v = f.map(at)
      for (let i = 1; i < v.length - 1; i++) tri.push(...v[0], ...v[i], ...v[i + 1])
      for (let i = 0; i < v.length; i++) seg.push(...v[i], ...v[(i + 1) % v.length])
    }
    const fill = new BufferGeometry()
    fill.setAttribute('position', new BufferAttribute(new Float32Array(tri), 3))
    fill.computeVertexNormals()
    const edges = new BufferGeometry()
    edges.setAttribute('position', new BufferAttribute(new Float32Array(seg), 3))
    return { fill, edges }
  }, [site, env])

  useEffect(
    () => () => {
      fill.dispose()
      edges.dispose()
    },
    [fill, edges],
  )

  return (
    <>
      <mesh geometry={fill} renderOrder={5}>
        <meshBasicMaterial color={ENV} transparent opacity={0.2} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <lineSegments geometry={edges} renderOrder={6}>
        <lineBasicMaterial color={ENV} transparent opacity={0.95} toneMapped={false} />
      </lineSegments>
    </>
  )
}


/* ---------- Design massing (Phase 3) ---------- */

const USE_COLOR = {
  home: '#f6f3ec',
  adu: '#ecc98f',
  garage: '#a3a9ae',
  parking: '#959ca2',
}
const OVER = '#e5534b'
const ROOF_M = 1.5 * FT

/**
 * A design option as solid floors on the real ground: each storey its own
 * block (a hair apart so the floors read), coloured by use. Any storey whose
 * roof would rise above the height limit turns red.
 */
function Massing({ site, design, heightLimitM, cutFloor = null, cutPlan = null }) {
  const facade = useMemo(designFacade, [])
  useEffect(() => () => facade.dispose(), [facade])
  const { solid, edges, walls } = useMemo(() => {
    const pos = []
    const col = []
    const seg = []
    const wall = []
    const uvs = []
    const c = new Color()
    // One level pad per building: the lowest ground under any of its blocks.
    const padOf = new Map()
    for (const v of design.vols) {
      const key = v.group ?? v.label
      const low = Math.min(...v.poly.map((p) => site.ground(p)))
      padOf.set(key, Math.min(padOf.get(key) ?? Infinity, low))
    }
    const CUT = 1.2 // the picked floor is cut at waist height so its rooms show
    for (const v of design.vols) {
      if (cutFloor != null && v.floor > cutFloor) continue
      const pad = padOf.get(v.group ?? v.label)
      const z0 = pad + v.z0 + (v.z0 > 0 ? 0.04 : 0)
      const z1 = cutFloor != null && v.floor === cutFloor ? pad + v.z0 + CUT : pad + v.z1 - 0.04
      const over = heightLimitM != null && v.z1 + ROOF_M > heightLimitM + 0.01
      c.set(over ? OVER : USE_COLOR[v.use] || USE_COLOR.home)
      const b = v.poly.map(([x, y]) => P(x, y, z0))
      const t = v.poly.map(([x, y]) => P(x, y, z1))
      const mid = [...b, ...t].reduce((m, p) => [m[0] + p[0] / 8, m[1] + p[1] / 8, m[2] + p[2] / 8], [0, 0, 0])
      // Each face is wound to point away from the block's centre, so light lands on its outside.
      const windows = v.use === 'home' || v.use === 'adu'
      // uv: u = metres along the wall / 3.5 m bay, v = 0..1 up one storey; caps and garages sample plain panel.
      const quad = (a, bb, cc, d, side = false) => {
        const len = Math.hypot(bb[0] - a[0], bb[2] - a[2])
        const vt = side && windows ? (z1 - z0) / (10 * FT) : 0
        const u1 = side && windows ? len / 3.5 : 0
        const uvA = [0, 0]
        const uvB = [u1, 0]
        const uvC = [u1, vt]
        const uvD = [0, vt]
        const e1 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]]
        const e2 = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]]
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
        const f = [(a[0] + cc[0]) / 2 - mid[0], (a[1] + cc[1]) / 2 - mid[1], (a[2] + cc[2]) / 2 - mid[2]]
        if (n[0] * f[0] + n[1] * f[1] + n[2] * f[2] < 0) {
          pos.push(...a, ...cc, ...bb, ...a, ...d, ...cc)
          uvs.push(...uvA, ...uvC, ...uvB, ...uvA, ...uvD, ...uvC)
        } else {
          pos.push(...a, ...bb, ...cc, ...a, ...cc, ...d)
          uvs.push(...uvA, ...uvB, ...uvC, ...uvA, ...uvC, ...uvD)
        }
        for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b)
      }
      quad(t[0], t[1], t[2], t[3])
      quad(b[3], b[2], b[1], b[0])
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4
        quad(b[i], b[j], t[j], t[i], true)
        seg.push(...b[i], ...b[j], ...t[i], ...t[j], ...b[i], ...t[i])
      }
    }
    // Room walls of the cut floor, drawn on its cut top.
    if (cutPlan && design.toXY) {
      for (const b of cutPlan.buildings) {
        const pad = padOf.get(b.name) ?? 0
        const z = pad + cutFloor * 10 * FT + CUT + 0.02
        for (const r of b.rooms) {
          const q = [
            [r.u0, r.v0],
            [r.u1, r.v0],
            [r.u1, r.v1],
            [r.u0, r.v1],
          ].map((p) => P(...design.toXY(p), z))
          for (let i = 0; i < 4; i++) wall.push(...q[i], ...q[(i + 1) % 4])
        }
      }
    }
    const walls = new BufferGeometry()
    walls.setAttribute('position', new BufferAttribute(new Float32Array(wall), 3))

    const solid = new BufferGeometry()
    solid.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    solid.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
    solid.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
    solid.computeVertexNormals()
    const edges = new BufferGeometry()
    edges.setAttribute('position', new BufferAttribute(new Float32Array(seg), 3))
    return { solid, edges, walls }
  }, [site, design, heightLimitM, cutFloor, cutPlan])

  useEffect(
    () => () => {
      solid.dispose()
      edges.dispose()
      walls.dispose()
    },
    [solid, edges, walls],
  )

  return (
    <>
      <mesh geometry={solid} castShadow receiveShadow renderOrder={3}>
        <meshLambertMaterial vertexColors side={DoubleSide} map={facade} />
      </mesh>
      <lineSegments geometry={edges} renderOrder={4}>
        <lineBasicMaterial color="#3a3330" transparent opacity={0.55} />
      </lineSegments>
      {cutPlan && (
        <lineSegments geometry={walls} renderOrder={5}>
          <lineBasicMaterial color="#c99b41" toneMapped={false} />
        </lineSegments>
      )}
    </>
  )
}

/* ---------- Light ---------- */

function Sun({ site }) {
  const { scene } = useThree()
  const light = useRef(null)
  const r = Math.min(site.half, 260)
  useEffect(() => {
    const l = light.current
    scene.add(l.target)
    const cam = l.shadow.camera
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = 1
    cam.far = r * 4
    cam.updateProjectionMatrix()
    return () => scene.remove(l.target)
  }, [scene, r])
  return (
    <>
      <hemisphereLight args={['#f4f6f8', '#8c7d6a', 0.85]} />
      {/* Afternoon sun from the south-west. */}
      <directionalLight
        ref={light}
        position={P(-r * 0.9, -r * 1.1, r * 1.5)}
        intensity={2.8}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.4}
      />
    </>
  )
}

/* ---------- Camera ---------- */

const clamp01 = (t) => Math.min(1, Math.max(0, t))
const easeOut = (t) => 1 - (1 - t) ** 3

/**
 * Orbit camera around the lot. It arrives from the map's own view (same
 * compass bearing, steeper) and settles into a three-quarter view.
 */
function Rig({ site, bearing, resetKey, active = true }) {
  const { camera, gl, invalidate } = useThree()
  const controls = useRef(null)
  const flight = useRef(null)

  const { span } = site

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true
    c.dampingFactor = 0.09
    c.maxPolarAngle = 1.36
    c.minDistance = 12
    c.maxDistance = site.half * 1.5
    c.screenSpacePanning = false
    c.addEventListener('change', () => invalidate())
    controls.current = c
    return () => c.dispose()
  }, [camera, gl, invalidate, site.half])

  useEffect(() => {
    const c = controls.current
    const b = (bearing * Math.PI) / 180
    // Look the way the map was looking: forward = compass bearing.
    const fwd = new Vector3(Math.sin(b), 0, -Math.cos(b))
    const target = new Vector3(0, 1, 0)
    const at = (dist, elev) =>
      target
        .clone()
        .addScaledVector(fwd, -dist * Math.cos(elev))
        .add(new Vector3(0, dist * Math.sin(elev), 0))
    flight.current = { t0: performance.now(), dur: 1700, from: at(span * 1.45, 1.15), to: at(span, 0.62), target }
    camera.position.copy(flight.current.from)
    c.target.copy(target)
    c.update()
    invalidate()
  }, [camera, bearing, span, resetKey, invalidate])

  useFrame(() => {
    const c = controls.current
    if (!c) return
    c.enabled = active && (!flight.current || flight.current.done)
    if (!active) return
    const f = flight.current
    if (f && !f.done) {
      const t = clamp01((performance.now() - f.t0) / f.dur)
      camera.position.lerpVectors(f.from, f.to, easeOut(t))
      c.target.copy(f.target)
      c.enabled = t >= 1
      if (t >= 1) f.done = true
      invalidate()
    }
    // Damping keeps easing after a drag ends — keep drawing until it stops.
    if (c.update()) invalidate()
  })

  return null
}

/** Redraw once when `on` changes (the canvas only draws on demand). */
function Invalidate({ on }) {
  const { invalidate } = useThree()
  useEffect(() => invalidate(), [on, invalidate])
  return null
}

/* ---------- Labels ---------- */

function Projector({ tags, els, hide = false }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new Vector3(), [])
  useFrame(() => {
    for (const t of tags) {
      const el = els.current.get(t.id)
      if (!el) continue
      v.set(...t.at).project(camera)
      const hidden = hide || v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1
      el.classList.toggle('is-hidden', hidden)
      if (!hidden) {
        const x = (v.x * 0.5 + 0.5) * size.width
        const y = (-v.y * 0.5 + 0.5) * size.height
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      }
    }
  })
  return null
}

function useTags(site, report, env) {
  return useMemo(() => {
    const tags = []
    if (env) {
      // Label the envelope at its top front corner, clear of the lot's own label.
      const c = env.labelAt
      tags.push({ id: 'env', kind: 'env', text: env.label, sub: env.sub, at: P(c[0], c[1], site.ground(c) + c[2] + 1) })
    }
    lotEdges(site.lot).forEach((e, i) => {
      if (e.length < 3) return
      const m = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2]
      tags.push({ id: `edge${i}`, kind: 'edge', text: `${Math.round(e.length / FT)} ft`, at: P(m[0], m[1], site.ground(m) + 0.8) })
    })
    const top = Math.max(0, ...site.buildings.filter((b) => b.onLot).map((b) => baseOf(site, b.outer) + b.height))
    tags.push({
      id: 'lot',
      kind: 'lot',
      text: report.parcel.address || 'This lot',
      sub: report.zoning?.raw || null,
      // Above the envelope too, so the two labels don't collide.
      at: P(0, 0, Math.max(top, env ? site.ground(env.labelAt) + env.topM : 0) + 7),
    })
    const n = site.half * 0.55
    tags.push({ id: 'north', kind: 'north', text: 'N', at: P(0, n, site.ground([0, n]) + 1) })
    return tags
  }, [site, report, env])
}

/* ---------- Scene ---------- */

export function SiteModel({ site, report, envelope = null, design = null, cutFloor = null, cutPlan = null, heightLimitM = null, bearing = 0, resetKey = 0, view = 'aerial', preset = null }) {
  const street = view === 'street'
  const [walkTo, setWalkTo] = useState(null)
  const tags = useTags(site, report, envelope)
  const els = useRef(new Map())
  const fog = useMemo(() => new Fog(SKY, site.span * 1.4, site.half * 2.2), [site.span, site.half])

  return (
    <div className="zl-site__stage">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        shadows="percentage"
        camera={{ fov: 40, near: 0.5, far: site.half * 6, position: [0, 200, 200] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = ACESFilmicToneMapping
          gl.outputColorSpace = SRGBColorSpace
          scene.background = new Color(SKY)
          scene.fog = fog
          if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __siteGl: gl, __siteScene: scene })
        }}
      >
        <Sun site={site} />
        <Ground site={site} onTap={street ? (at) => setWalkTo({ at, key: performance.now() }) : null} />
        <Streets site={site} />
        <Trees site={site} />
        <HouseLikeBuildings site={site} baseOf={baseOf} />
        <Buildings site={site} hideLot={!!design} skipAround />
        <LotOutline site={site} />
        {design && <Massing site={site} design={design} heightLimitM={heightLimitM} cutFloor={cutFloor} cutPlan={cutPlan} />}
        {envelope && <Envelope site={site} env={envelope} />}
        <Invalidate on={envelope} />
        <Invalidate on={design} />
        <Invalidate on={cutPlan} />
        <Rig site={site} bearing={bearing} resetKey={resetKey} active={!street} />
        {street && <StreetCam site={site} preset={preset} walkTo={walkTo} />}
        <Invalidate on={view} />
        <Projector tags={tags} els={els} hide={street} />
      </Canvas>
      <div className="zl-tags" aria-hidden="true">
        {tags.map((t) => (
          <div
            key={t.id}
            ref={(el) => (el ? els.current.set(t.id, el) : els.current.delete(t.id))}
            className={`zl-tag zl-tag--${t.kind} is-hidden`}
          >
            <span className="zl-tag__in">
              {t.text}
              {t.sub && <small>{t.sub}</small>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
