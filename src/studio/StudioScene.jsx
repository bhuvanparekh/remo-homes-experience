import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, BoxGeometry, EdgesGeometry, Object3D, Shape, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CEILING, DECK_DEPTH, FLOOR_Y, ZONE } from './generator.js'
import { SETBACKS_FT } from './spec.js'
import { SkyLight, StudioHouse } from './StudioHouse.jsx'
import { TourCamera } from './TourCamera.jsx'

/**
 * The studio's 3D view: an architect's white model of the visitor's lot, and
 * the massing — one block per room, coloured by use — rising onto it.
 *
 * Lot coordinates are metres with the lot centred on the origin and the
 * street along +z (towards the default camera). The compass turns with the
 * visitor's "street side" answer; the sun follows the compass.
 */

export const ZONE_COLORS = {
  living: '#f0dfc2',
  sleep: '#dde3e8',
  work: '#e6dccb',
  wet: '#c6dde3',
  service: '#e1dcd2',
  hall: '#f7f5f1',
}

const BG = '#e9e6e0'
const RISE = 0.75 // seconds per block
const STAGGER = 0.085

/* ---------- shared geometry ---------- */

const UNIT = new BoxGeometry(1, 1, 1)
UNIT.translate(0, 0.5, 0) // origin at the base, so scaling y grows upward
const UNIT_EDGES = new EdgesGeometry(UNIT)

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const easeOutBack = (t) => {
  const c = 1.4
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}
const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

/** Compass bearing (0 = N, 90 = E) → unit direction on the lot, given the street side. */
function bearingDir(bearing, street) {
  const s = { north: 0, east: 90, south: 180, west: 270 }[street]
  const a = ((bearing - s) * Math.PI) / 180
  return [-Math.sin(a), Math.cos(a)]
}

/** Plan point (house-local x, z) → lot coordinates. */
export function toLot(site, x, z) {
  const c = Math.cos(site.rotY)
  const s = Math.sin(site.rotY)
  return [site.x + x * c + z * s, site.z - x * s + z * c]
}

/* ---------- Massing ---------- */

/**
 * One block. It rises when the build starts (staggered by `order`) and
 * glides to new sizes when the plan changes, so editing the brief after the
 * build reshapes the model instead of rebuilding it.
 */
function Block({ box, y0, height, color, order, startRef, sinkRef, edges = true }) {
  const ref = useRef(null)
  const cur = useRef(null)

  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    const target = { cx: (box.x0 + box.x1) / 2, cz: (box.z0 + box.z1) / 2, w: box.x1 - box.x0, d: box.z1 - box.z0 }
    if (!cur.current) cur.current = { ...target }
    const c = cur.current
    const k = 1 - Math.exp(-dt * 9)
    for (const key of ['cx', 'cz', 'w', 'd']) c[key] += (target[key] - c[key]) * k

    const start = startRef.current
    const t = start == null ? 0 : (performance.now() / 1000 - start - order * STAGGER) / RISE
    let rise = t >= 1 ? 1 : easeOutBack(clamp01(t))
    // Sinks back into the ground when the real house starts to go up.
    const sink = sinkRef?.current
    if (sink != null) rise *= 1 - clamp01((performance.now() / 1000 - sink) / 0.45)
    const h = Math.max(0.001, height * rise)
    m.visible = rise > 0.001
    m.position.set(c.cx, y0, c.cz)
    m.scale.set(c.w - 0.05, h, c.d - 0.05)
  })

  return (
    <mesh ref={ref} geometry={UNIT} castShadow receiveShadow visible={false}>
      <meshStandardMaterial color={color} roughness={0.9} />
      {edges && (
        <lineSegments geometry={UNIT_EDGES}>
          <lineBasicMaterial color="#6b625b" transparent opacity={0.45} />
        </lineSegments>
      )}
    </mesh>
  )
}

function Massing({ plan, startRef, sinkRef }) {
  const group = useRef(null)
  const { house, site } = plan
  const L = house.length
  const D = house.depth

  // Rooms rise from one end of the house to the other.
  const rooms = useMemo(() => [...house.rooms].sort((a, b) => a.x0 - b.x0 || b.z1 - a.z1), [house.rooms])

  // The whole model glides (and turns) when the lot forces a new placement.
  const cur = useRef(null)
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    if (!cur.current) cur.current = { x: site.x, z: site.z, r: site.rotY }
    const c = cur.current
    const k = 1 - Math.exp(-dt * 6)
    c.x += (site.x - c.x) * k
    c.z += (site.z - c.z) * k
    c.r += (site.rotY - c.r) * k
    g.position.set(c.x, 0, c.z)
    g.rotation.y = c.r
  })

  return (
    <group ref={group}>
      {/* Floor platform: three steps up, like the SupReMo. */}
      <Block
        box={{ x0: -L / 2, x1: L / 2, z0: -D / 2, z1: D / 2 }}
        y0={0}
        height={FLOOR_Y}
        color="#cbc5bc"
        order={-2}
        startRef={startRef}
        sinkRef={sinkRef}
      />
      {rooms.map((r, i) => (
        <Block
          key={r.id}
          box={r}
          y0={FLOOR_Y}
          height={r.kind === 'hall' ? CEILING - 0.35 : CEILING}
          color={ZONE_COLORS[ZONE[r.kind]]}
          order={i}
          startRef={startRef}
          sinkRef={sinkRef}
        />
      ))}
      {house.decks.map((d) => (
        <Block
          key={d.id}
          box={{
            x0: d.x0,
            x1: d.x1,
            z0: d.side === 'front' ? D / 2 : -D / 2 - DECK_DEPTH,
            z1: d.side === 'front' ? D / 2 + DECK_DEPTH : -D / 2,
          }}
          y0={0}
          height={FLOOR_Y - 0.1}
          color="#c9b393"
          order={rooms.length}
          startRef={startRef}
          sinkRef={sinkRef}
        />
      ))}
    </group>
  )
}

/* ---------- The lot and its surroundings ---------- */

/** A dashed rectangle of flat strips (WebGL lines are 1 px, too thin to read). */
function DashedRect({ rect, color, y = 0.03, dash = 0.9, gap = 0.55, width = 0.12 }) {
  const ref = useRef(null)
  const dashes = useMemo(() => {
    const out = []
    const edges = [
      [[rect.x0, rect.z0], [rect.x1, rect.z0]],
      [[rect.x1, rect.z0], [rect.x1, rect.z1]],
      [[rect.x1, rect.z1], [rect.x0, rect.z1]],
      [[rect.x0, rect.z1], [rect.x0, rect.z0]],
    ]
    for (const [a, b] of edges) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const dx = (b[0] - a[0]) / len
      const dz = (b[1] - a[1]) / len
      for (let s = 0; s < len; s += dash + gap) {
        const l = Math.min(dash, len - s)
        const m = s + l / 2
        out.push({ x: a[0] + dx * m, z: a[1] + dz * m, l, rot: Math.atan2(-dz, dx) })
      }
    }
    return out
  }, [rect, dash, gap])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    dashes.forEach((d, i) => {
      o.position.set(d.x, y, d.z)
      o.rotation.set(0, d.rot, 0)
      o.scale.set(d.l, 0.01, width)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.count = dashes.length
    mesh.instanceMatrix.needsUpdate = true
  }, [dashes, y, width])

  return (
    <instancedMesh ref={ref} args={[UNIT, undefined, 400]} frustumCulled={false}>
      <meshBasicMaterial color={color} />
    </instancedMesh>
  )
}

/** Solid outline of the lot. */
function Outline({ w, d, color = '#ffffff', width = 0.16 }) {
  const strips = [
    [0, -d / 2, w, width],
    [0, d / 2, w, width],
    [-w / 2, 0, width, d],
    [w / 2, 0, width, d],
  ]
  return strips.map(([x, z, sx, sz], i) => (
    <mesh key={i} geometry={UNIT} position={[x, 0.025, z]} scale={[sx, 0.01, sz]}>
      <meshBasicMaterial color={color} />
    </mesh>
  ))
}

/** A plain neighbouring house, so the lot reads at the right scale. */
function Neighbour({ x, lotW, lotD }) {
  const w = Math.min(lotW * 0.62, 11)
  const d = Math.min(lotD * 0.38, 13)
  const front = lotD / 2 - SETBACKS_FT.front * 0.3048
  return (
    <group position={[x, 0, front - d / 2]}>
      <mesh geometry={UNIT} scale={[w, 3.0, d]} receiveShadow>
        <meshStandardMaterial color="#efede8" roughness={0.95} transparent opacity={0.55} depthWrite={false} />
        <lineSegments geometry={UNIT_EDGES}>
          <lineBasicMaterial color="#8a827b" transparent opacity={0.3} />
        </lineSegments>
      </mesh>
    </group>
  )
}

function Lot({ plan }) {
  const { lot } = plan.site
  const { w, d, build } = lot
  const street = plan.spec.street

  const north = bearingDir(0, street)
  const compass = [-w / 2 - 3.2, d / 2 - 2.5]

  return (
    <group>
      {/* Ground, street and pavement */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#e3e0d9" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, d / 2 + 1.0]} receiveShadow>
        <planeGeometry args={[600, 2]} />
        <meshStandardMaterial color="#efede8" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.012, d / 2 + 6.5]} receiveShadow>
        <planeGeometry args={[600, 9]} />
        <meshStandardMaterial color="#c3c1bc" roughness={1} />
      </mesh>
      <DashedRect rect={{ x0: -300, x1: 300, z0: d / 2 + 6.45, z1: d / 2 + 6.55 }} color="#f7f5f0" y={0} dash={2.4} gap={2.2} width={0.14} />

      {/* The visitor's lot, its neighbours and the buildable area */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#d7dfcc" roughness={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh rotation-x={-Math.PI / 2} position={[side * w, -0.005, 0]} receiveShadow>
            <planeGeometry args={[w - 0.3, d]} />
            <meshStandardMaterial color="#dfe3d7" roughness={1} />
          </mesh>
          <Neighbour x={side * w} lotW={w} lotD={d} />
        </group>
      ))}
      <Outline w={w} d={d} />
      <DashedRect rect={build} color="#c99b41" />

      {/* North arrow */}
      <group position={[compass[0], 0.03, compass[1]]} rotation-y={Math.atan2(-north[0], -north[1])}>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.5, 40]} />
          <meshBasicMaterial color="#f7f5f0" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0.15]}>
          <shapeGeometry args={[arrowShape()]} />
          <meshBasicMaterial color="#28211e" />
        </mesh>
      </group>
    </group>
  )
}

let arrow = null
function arrowShape() {
  if (arrow) return arrow
  arrow = new Shape()
  arrow.moveTo(0, 1.25)
  arrow.lineTo(0.55, -0.7)
  arrow.lineTo(0, -0.35)
  arrow.lineTo(-0.55, -0.7)
  arrow.closePath()
  return arrow
}

/* ---------- Light ---------- */

function Sun({ plan }) {
  const ref = useRef(null)
  const { scene } = useThree()
  const { w, d } = plan.site.lot
  const [sx, sz] = bearingDir(215, plan.spec.street) // mid-afternoon, south-west
  const reach = Math.max(w, d) * 0.8 + 10

  useEffect(() => {
    const light = ref.current
    if (!light) return
    scene.add(light.target)
    light.target.position.set(0, 0, 0)
    return () => scene.remove(light.target)
  }, [scene])

  useEffect(() => {
    const light = ref.current
    if (!light) return
    const cam = light.shadow.camera
    cam.left = cam.bottom = -reach
    cam.right = cam.top = reach
    cam.near = 1
    cam.far = 260
    cam.updateProjectionMatrix()
  }, [reach])

  return (
    <directionalLight
      ref={ref}
      position={[sx * 70, 85, sz * 70]}
      intensity={2.6}
      color="#fff4e6"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
    />
  )
}

/* ---------- Camera ---------- */

/**
 * Orbit controls plus scripted flights: to the whole lot before the build,
 * down to the house once it rises, and again whenever the lot changes.
 */
function Rig({ view, active = true }) {
  const { camera, gl } = useThree()
  const controls = useRef(null)
  const flight = useRef(null)

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.maxPolarAngle = 1.38
    c.minDistance = 6
    c.maxDistance = 220
    c.screenSpacePanning = false
    controls.current = c
    return () => c.dispose()
  }, [camera, gl])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    flight.current = {
      t0: performance.now(),
      dur: flight.current ? 1500 : 0,
      fromPos: camera.position.clone(),
      fromTarget: c.target.clone(),
      toPos: new Vector3(...view.pos),
      toTarget: new Vector3(...view.target),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.key])

  useFrame(() => {
    const c = controls.current
    if (!c) return
    // The walkthrough drives the camera itself.
    c.enabled = active && (!flight.current || flight.current.done)
    if (!active) return
    const f = flight.current
    if (f && !f.done) {
      const t = f.dur ? clamp01((performance.now() - f.t0) / f.dur) : 1
      const e = easeInOut(t)
      camera.position.lerpVectors(f.fromPos, f.toPos, e)
      c.target.lerpVectors(f.fromTarget, f.toTarget, e)
      c.enabled = t >= 1
      if (t >= 1) f.done = true
    }
    c.update()
  })

  return null
}

function viewFor(plan, stage, buildKey) {
  const { lot } = plan.site
  if (stage !== 'brief' && plan.site.ok) {
    const { x, z, rotated } = plan.site
    const size = Math.max(plan.house.length, plan.house.depth) * 1.25 + 6
    // Three-quarter view of the front door side (east when the house is turned).
    const [ax, az] = rotated ? [0.95, 0.62] : [0.62, 0.95]
    const placed = `${buildKey}|${rotated}|${plan.spec.lotW}|${plan.spec.lotD}`
    if (stage === 'interior' || stage === 'tour') {
      // Higher and steeper, to look down into the rooms. (The tour flies its
      // own camera; its key just makes leaving it fly back here.)
      return {
        key: `${stage}|${placed}`,
        target: [x, 0.6, z],
        pos: [x + size * ax * 0.42, size * 1.02, z + size * az * 0.5],
      }
    }
    return { key: `house|${placed}`, target: [x, 1.4, z], pos: [x + size * ax, size * 0.62, z + size * az] }
  }
  const k = Math.max(lot.w, lot.d) * 0.95 + 12
  return {
    key: `lot|${plan.spec.lotW}|${plan.spec.lotD}`,
    target: [0, 0, 2],
    pos: [k * 0.3, k * 0.95, k * 0.78],
  }
}

/* ---------- Labels ---------- */

/**
 * Projects each label's 3D point to the screen every frame (no React
 * re-render). Room labels are placed biggest room first; a label that would
 * overlap one already placed is hidden until the view opens up.
 */
function TagProjector({ tags, els }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new Vector3(), [])
  const ordered = useMemo(() => [...tags].sort((a, b) => (b.prio ?? 1e9) - (a.prio ?? 1e9)), [tags])
  const placed = useMemo(() => [], [])

  useFrame(() => {
    placed.length = 0
    for (const t of ordered) {
      const el = els.current.get(t.id)
      if (!el) continue
      v.set(...t.at).project(camera)
      const x = (v.x * 0.5 + 0.5) * size.width
      const y = (-v.y * 0.5 + 0.5) * size.height
      let hidden = v.z > 1
      if (!hidden && t.kind === 'room') {
        const inner = el.firstChild
        const w = inner.offsetWidth + 6
        const h = inner.offsetHeight + 4
        const r = { x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y }
        hidden = placed.some((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0)
        if (!hidden) placed.push(r)
      }
      el.classList.toggle('is-hidden', hidden)
      if (!hidden) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    }
  })
  return null
}

function useTags(plan) {
  return useMemo(() => {
    const { site, house } = plan
    const { lot } = site
    const { build, w, d } = lot
    const tags = [
      { id: 'street', kind: 'site', text: 'Street', at: [0, 0, d / 2 + 6.5] },
      { id: 'front-sb', kind: 'site', text: `${SETBACKS_FT.front} ft setback`, at: [-w / 4, 0, (build.z1 + d / 2) / 2] },
      { id: 'rear-sb', kind: 'site', text: `${SETBACKS_FT.rear} ft`, at: [0, 0, (build.z0 - d / 2) / 2] },
      { id: 'side-sb', kind: 'site', text: `${SETBACKS_FT.side} ft`, at: [(build.x1 + w / 2) / 2, 0, 0] },
      { id: 'north', kind: 'compass', text: 'N', at: northTip(plan) },
    ]
    if (site.ok) {
      const top = FLOOR_Y + CEILING + 0.05
      const order = [...house.rooms].sort((a, b) => a.x0 - b.x0 || b.z1 - a.z1).map((r) => r.id)
      for (const r of house.rooms) {
        if (r.kind === 'hall') continue
        const [x, z] = toLot(site, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2)
        const area = Math.round(((r.x1 - r.x0) * (r.z1 - r.z0)) / 0.0929)
        const small = ['closet', 'storage', 'laundry'].includes(r.kind)
        tags.push({
          id: `room-${r.id}`,
          kind: 'room',
          text: r.name,
          sub: small ? null : `${area} sq ft`,
          at: [x, top, z],
          order: order.indexOf(r.id),
          prio: area,
        })
      }
    }
    return tags
  }, [plan])
}

function northTip(plan) {
  const { w, d } = plan.site.lot
  const [nx, nz] = bearingDir(0, plan.spec.street)
  return [-w / 2 - 3.2 + nx * 2.4, 0.05, d / 2 - 2.5 + nz * 2.4]
}

/* ---------- Scene ---------- */

/** A key that changes whenever the built house would look different. */
function houseKey(plan, style) {
  const r = plan.house.rooms.map((x) => `${x.id}${x.x0.toFixed(2)}${x.x1.toFixed(2)}`).join()
  return `${r}|${plan.house.decks.map((d) => d.id).join()}|${style}`
}

export function StudioScene({ plan, stage, stageAt, prevStage, buildKey, style, tour }) {
  const startRef = useRef(null)
  const sinkRef = useRef(null)
  const lampRef = useRef(null)
  const els = useRef(new Map())
  const tags = useTags(plan)
  const view = viewFor(plan, stage, buildKey)
  const ok = plan.site.ok
  const [lingering, setLingering] = useState(false)

  // Each build (or replay) restarts the rise from zero.
  useEffect(() => {
    startRef.current = stage === 'brief' ? null : performance.now() / 1000 + 0.9
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildKey])

  // Leaving the massing: the blocks sink while the house goes up.
  useEffect(() => {
    if (stage === 'massing' || stage === 'brief') {
      sinkRef.current = null
      return
    }
    if (prevStage !== 'massing') return
    sinkRef.current = performance.now() / 1000
    setLingering(true)
    const id = setTimeout(() => setLingering(false), 700)
    return () => clearTimeout(id)
  }, [stage, prevStage])

  const showMassing = ok && (stage === 'massing' || lingering)
  const showHouse = ok && (stage === 'house' || stage === 'interior' || stage === 'tour')
  const touring = ok && stage === 'tour' && tour
  const showRoomTags = ok && (stage === 'massing' || stage === 'interior')

  return (
    <div className="studio__stage">
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        camera={{ fov: 38, near: 0.3, far: 1200, position: view.pos }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 0.95
        }}
      >
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 120, 420]} />
        <hemisphereLight args={['#ffffff', '#cfc6b8', 1.35]} />
        <Sun plan={plan} />
        <Lot plan={plan} />
        {showMassing && <Massing key={buildKey} plan={plan} startRef={startRef} sinkRef={sinkRef} />}
        {showHouse && (
          <Suspense fallback={null}>
            <SkyLight />
            <StudioHouse key={houseKey(plan, style)} plan={plan} stage={stage} stageAt={stageAt} prevStage={prevStage} style={style} />
          </Suspense>
        )}
        {/* Always present (at zero when idle) so lights never change count and recompile shaders. */}
        <pointLight ref={lampRef} intensity={0} distance={7} decay={1.6} color="#fff1dc" />
        <Rig view={view} active={!touring} />
        {touring && <TourCamera tour={tour} site={plan.site} lampRef={lampRef} />}
        <TagProjector tags={tags} els={els} />
      </Canvas>

      <div className="stags" aria-hidden="true" key={showRoomTags ? `${stage}${buildKey}` : 'lot'}>
        {!touring && tags.map((t) =>
          t.kind === 'room' && !showRoomTags ? null : (
            <span
              key={t.id}
              ref={(el) => (el ? els.current.set(t.id, el) : els.current.delete(t.id))}
              className={`stag stag--${t.kind}`}
              style={t.kind === 'room' ? { '--d': `${1300 + t.order * STAGGER * 1000}ms` } : undefined}
            >
              <span className="stag__in">
                {t.text}
                {t.sub && <small>{t.sub}</small>}
              </span>
            </span>
          ),
        )}
      </div>
    </div>
  )
}
