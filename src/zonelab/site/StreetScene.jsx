import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  IcosahedronGeometry,
  MeshLambertMaterial,
  Object3D,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { nearestStreet } from './streets.js'

/**
 * The street at eye level: asphalt roads at their official widths with
 * concrete sidewalks, centre lines on the bigger streets, street trees from
 * StreetsLA's inventory, neighbouring buildings with house-like walls and
 * windows, and a first-person camera that walks along it all.
 *
 * Site frame: metres, x = east, y = north; three.js: (x, height, −y).
 */

const P = (x, y, h = 0) => [x, h, -y]
const FT = 0.3048

/* ---------- Ground that matches the terrain mesh ---------- */

/**
 * Height lookup on the same grid the ground mesh uses, so roads and kerbs
 * sit on the drawn surface instead of floating or sinking on slopes.
 */
export function gridGround(site, seg = 96) {
  const { half, ground } = site
  const n = seg + 1
  const step = (half * 2) / seg
  const h = new Float32Array(n * n)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = ground([-half + i * step, -half + j * step])
  return ([x, y]) => {
    const fx = Math.min(seg - 1e-6, Math.max(0, (x + half) / step))
    const fy = Math.min(seg - 1e-6, Math.max(0, (y + half) / step))
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    const tx = fx - i
    const ty = fy - j
    const a = h[j * n + i]
    const b = h[j * n + i + 1]
    const c = h[(j + 1) * n + i]
    const d = h[(j + 1) * n + i + 1]
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty
  }
}

/* ---------- Ribbons along polylines ---------- */

/** Densify a polyline so ribbons follow the ground (≤ step m apart). */
function densify(pts, step = 5) {
  const out = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]
    const [bx, by] = pts[i]
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step))
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n])
  }
  return out
}

/** Left-hand normals at each vertex (averaged at bends, miter-limited). */
function normals(pts) {
  const seg = []
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0]
    const dy = pts[i + 1][1] - pts[i][1]
    const l = Math.hypot(dx, dy) || 1
    seg.push([-dy / l, dx / l])
  }
  return pts.map((_, i) => {
    const a = seg[Math.max(0, i - 1)]
    const b = seg[Math.min(seg.length - 1, i)]
    let nx = a[0] + b[0]
    let ny = a[1] + b[1]
    const l = Math.hypot(nx, ny) || 1
    nx /= l
    ny /= l
    const k = Math.min(2, 1 / Math.max(0.5, nx * b[0] + ny * b[1]))
    return [nx * k, ny * k]
  })
}

/** Triangles of a band between offsets o0 and o1 (m) along a polyline, h m above ground. */
function band(pts, nrm, o0, o1, h, hAt, pos) {
  for (let i = 0; i < pts.length - 1; i++) {
    const q = [i, i + 1].flatMap((k) => {
      const [x, y] = pts[k]
      const [nx, ny] = nrm[k]
      const p0 = [x + nx * o0, y + ny * o0]
      const p1 = [x + nx * o1, y + ny * o1]
      return [P(...p0, hAt(p0) + h), P(...p1, hAt(p1) + h)]
    })
    // q: a0, a1, b0, b1
    pos.push(...q[0], ...q[2], ...q[1], ...q[1], ...q[2], ...q[3])
  }
}

function geometry(pos) {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.computeVertexNormals()
  return g
}

export function Streets({ site }) {
  const geo = useMemo(() => {
    const hAt = gridGround(site)
    const road = []
    const walk = []
    const lines = []
    const alley = []
    for (const r of site.roads) {
      const pts = densify(r.pts)
      if (pts.length < 2) continue
      const nrm = normals(pts)
      const half = r.road / 2
      if (r.kind === 'alley') {
        band(pts, nrm, -half, half, 0.12, hAt, alley)
        continue
      }
      // Sidewalk + parkway either side, then the roadway on top.
      band(pts, nrm, half, r.row / 2, 0.14, hAt, walk)
      band(pts, nrm, -r.row / 2, -half, 0.14, hAt, walk)
      band(pts, nrm, -half, half, 0.17, hAt, road)
      if (r.arterial) {
        band(pts, nrm, -0.22, -0.1, 0.19, hAt, lines)
        band(pts, nrm, 0.1, 0.22, 0.19, hAt, lines)
      }
    }
    return { road: geometry(road), walk: geometry(walk), lines: geometry(lines), alley: geometry(alley) }
  }, [site])

  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  return (
    <group>
      <mesh geometry={geo.walk} receiveShadow renderOrder={1}>
        <meshLambertMaterial side={2} color="#cfcac1" polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={geo.alley} receiveShadow renderOrder={1}>
        <meshLambertMaterial side={2} color="#9d9890" polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={geo.road} receiveShadow renderOrder={2}>
        <meshLambertMaterial side={2} color="#4a4a4c" polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
      </mesh>
      <mesh geometry={geo.lines} renderOrder={3}>
        <meshBasicMaterial side={2} color="#e2b84b" polygonOffset polygonOffsetFactor={-6} polygonOffsetUnits={-6} />
      </mesh>
    </group>
  )
}

/* ---------- Street trees ---------- */

const TRUNK = new CylinderGeometry(0.16, 0.24, 1, 6).translate(0, 0.5, 0)
const PALM_TRUNK = new CylinderGeometry(0.17, 0.24, 1, 6).translate(0, 0.5, 0)
const CROWN = new IcosahedronGeometry(1, 1)
const CONE = new ConeGeometry(1, 1, 7).translate(0, 0.5, 0)
const FROND = new SphereGeometry(1, 7, 4)

export function Trees({ site }) {
  const refs = { trunk: useRef(), crown: useRef(), cone: useRef(), palm: useRef(), frond: useRef() }
  const hAt = useMemo(() => gridGround(site), [site])

  const sets = useMemo(() => {
    const out = { trunk: [], crown: [], cone: [], palm: [], frond: [] }
    for (const t of site.trees) {
      const g = hAt(t.at)
      const r = (t.seed % 97) / 97 // per-tree variety
      if (t.kind === 'palm') {
        const h = 9 + r * 9
        out.palm.push({ p: P(...t.at, g), s: [1, h, 1] })
        out.frond.push({ p: P(...t.at, g + h), s: [2.6, 1.1, 2.6] })
      } else if (t.kind === 'conifer') {
        const h = 7 + r * 6
        out.trunk.push({ p: P(...t.at, g), s: [1, 2, 1] })
        out.cone.push({ p: P(...t.at, g + 1.5), s: [2 + r, h, 2 + r] })
      } else {
        const h = 3 + r * 3
        const c = 2.2 + r * 2
        out.trunk.push({ p: P(...t.at, g), s: [1, h, 1] })
        out.crown.push({ p: P(...t.at, g + h + c * 0.6), s: [c, c * 0.85, c] })
      }
    }
    return out
  }, [site, hAt])

  useEffect(() => {
    const o = new Object3D()
    for (const [k, list] of Object.entries(sets)) {
      const mesh = refs[k].current
      if (!mesh) continue
      list.forEach((it, i) => {
        o.position.set(...it.p)
        o.scale.set(...it.s)
        o.rotation.set(0, i * 1.7, 0)
        o.updateMatrix()
        mesh.setMatrixAt(i, o.matrix)
      })
      mesh.count = list.length
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets])

  const n = (k) => Math.max(1, sets[k].length)
  return (
    <group>
      <instancedMesh ref={refs.trunk} args={[TRUNK, undefined, n('trunk')]} castShadow>
        <meshLambertMaterial color="#6b5544" />
      </instancedMesh>
      <instancedMesh ref={refs.crown} args={[CROWN, undefined, n('crown')]} castShadow receiveShadow>
        <meshLambertMaterial color="#5f7a45" flatShading />
      </instancedMesh>
      <instancedMesh ref={refs.cone} args={[CONE, undefined, n('cone')]} castShadow>
        <meshLambertMaterial color="#4a6640" flatShading />
      </instancedMesh>
      <instancedMesh ref={refs.palm} args={[PALM_TRUNK, undefined, n('palm')]} castShadow>
        <meshLambertMaterial color="#8a7660" />
      </instancedMesh>
      <instancedMesh ref={refs.frond} args={[FROND, undefined, n('frond')]} castShadow>
        <meshLambertMaterial color="#6f8a4c" flatShading />
      </instancedMesh>
    </group>
  )
}

/* ---------- House-like neighbours ---------- */

/** One storey of stucco wall with a window, repeating every 4 m × 3 m. */
function facadeTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 128, 128)
  // Window: dark glass in a light frame, sill line under it.
  g.fillStyle = '#d9d4cc'
  g.fillRect(38, 34, 52, 52)
  g.fillStyle = '#4a5560'
  g.fillRect(42, 38, 44, 44)
  g.fillStyle = '#6d7a86'
  g.fillRect(42, 38, 44, 10)
  g.fillStyle = '#c9c3b9'
  g.fillRect(34, 86, 60, 4)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(1 / 4, 1 / 3)
  t.anisotropy = 4
  return t
}

const WALLS = ['#efe6d6', '#e9dfcf', '#f4f0e8', '#ddd3c4', '#e8d8c3', '#dcd7cf', '#f1e2cd', '#e6e0d6']
const ROOFS = ['#8d8883', '#a3654a', '#7b7977', '#b1a99d', '#93705c']

/** Split an ExtrudeGeometry into its caps (roof/floor) and side walls. */
function splitExtrude(g) {
  const pos = g.attributes.position.array
  const uv = g.attributes.uv.array
  const pick = (grp) => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos.slice(grp.start * 3, (grp.start + grp.count) * 3), 3))
    geo.setAttribute('uv', new BufferAttribute(uv.slice(grp.start * 2, (grp.start + grp.count) * 2), 2))
    return geo
  }
  const [caps, sides] = g.groups
  return { caps: pick(caps), sides: pick(sides) }
}

/** Neighbouring buildings with stucco walls, windows and darker roofs. */
export function HouseLikeBuildings({ site, baseOf }) {
  const geo = useMemo(() => {
    const walls = []
    const roofs = []
    const c = new Color()
    site.buildings.forEach((b, i) => {
      if (b.onLot) return
      try {
        const shape = new Shape(b.outer.map(([x, y]) => new Vector2(x, y)))
        for (const h of b.holes) shape.holes.push(new Shape(h.map(([x, y]) => new Vector2(x, y))))
        const g = new ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false, curveSegments: 1 })
        g.rotateX(-Math.PI / 2)
        g.translate(0, baseOf(site, b.outer), 0)
        const { caps, sides } = splitExtrude(g)
        g.dispose()
        const tint = (geo2, hex) => {
          c.set(hex)
          const n = geo2.attributes.position.count
          const col = new Float32Array(n * 3)
          for (let k = 0; k < n; k++) col.set([c.r, c.g, c.b], k * 3)
          geo2.setAttribute('color', new BufferAttribute(col, 3))
          geo2.computeVertexNormals()
          return geo2
        }
        walls.push(tint(sides, WALLS[i % WALLS.length]))
        roofs.push(tint(caps, ROOFS[(i * 7) % ROOFS.length]))
      } catch {
        /* skip a malformed outline */
      }
    })
    const w = walls.length ? mergeGeometries(walls, false) : null
    const r = roofs.length ? mergeGeometries(roofs, false) : null
    walls.forEach((g) => g.dispose())
    roofs.forEach((g) => g.dispose())
    return { walls: w, roofs: r }
  }, [site, baseOf])

  const tex = useMemo(facadeTexture, [])
  const wallMat = useMemo(() => new MeshLambertMaterial({ map: tex, vertexColors: true }), [tex])
  const roofMat = useMemo(() => new MeshLambertMaterial({ vertexColors: true }), [])

  useEffect(
    () => () => {
      geo.walls?.dispose()
      geo.roofs?.dispose()
      tex.dispose()
      wallMat.dispose()
      roofMat.dispose()
    },
    [geo, tex, wallMat, roofMat],
  )

  return (
    <group>
      {geo.walls && <mesh geometry={geo.walls} material={wallMat} castShadow receiveShadow />}
      {geo.roofs && <mesh geometry={geo.roofs} material={roofMat} castShadow receiveShadow />}
    </group>
  )
}

/* ---------- Design facade (ReMo-style panels and tall windows) ---------- */

/** One storey × 3.5 m of white panel with a tall black-framed window. */
export function designFacade() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#e9e7e2'
  g.fillRect(0, 0, 2, 128) // panel joint
  g.fillStyle = '#1f2123'
  g.fillRect(44, 18, 40, 92) // frame
  g.fillStyle = '#5d6d78'
  g.fillRect(48, 22, 32, 84) // glass
  g.fillStyle = '#7f909b'
  g.fillRect(48, 22, 32, 18)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 4
  return t
}

/* ---------- Viewpoints ---------- */

/**
 * Where to stand for each preset (site frame): across the street, down the
 * street, from the neighbour's side, from the back. Each looks at the lot.
 */
export function streetPresets(site, sides) {
  const lot = site.lot
  const c = lot.reduce((a, p) => [a[0] + p[0] / lot.length, a[1] + p[1] / lot.length], [0, 0])
  const look = [c[0], c[1], 3.2]
  const mid = (e) => [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2]
  const front = sides?.edges.find((e) => e.kind === 'front')
  const out = []
  if (front) {
    const m = mid(front)
    const n = front.n
    const ns = nearestStreet(site.roads, m)
    if (ns && ns.dist < 60) {
      // Far sidewalk, then a spot down the street on this side.
      const across = [ns.at[0] + n[0] * (ns.road.road / 2 + 1.8), ns.at[1] + n[1] * (ns.road.road / 2 + 1.8)]
      out.push({ id: 'across', label: 'Across the street', pos: across, look })
      const along = ns.dir
      const near = [ns.at[0] - n[0] * (ns.road.road / 2 + 1.8), ns.at[1] - n[1] * (ns.road.road / 2 + 1.8)]
      out.push({ id: 'down', label: 'Down the street', pos: [near[0] + along[0] * 32, near[1] + along[1] * 32], look })
    } else {
      out.push({ id: 'across', label: 'In front', pos: [m[0] + n[0] * 14, m[1] + n[1] * 14], look })
    }
  }
  if (front) {
    // Diagonal view from the pavement just past the lot's front corner.
    const m = mid(front)
    const n = front.n
    const ax = front.a[0] - m[0]
    const ay = front.a[1] - m[1]
    const l = Math.hypot(ax, ay) || 1
    out.push({ id: 'corner', label: 'From the corner', pos: [front.a[0] + n[0] * 5 + (ax / l) * 9, front.a[1] + n[1] * 5 + (ay / l) * 9], look, out: [ax / l, ay / l] })
  }
  const rear = sides?.edges.find((e) => e.kind === 'rear')
  if (rear) out.push({ id: 'rear', label: 'Over the back fence', pos: [mid(rear)[0] + rear.n[0] * 4, mid(rear)[1] + rear.n[1] * 4], look, out: rear.n })
  if (!out.length) out.push({ id: 'across', label: 'In front', pos: [c[0], c[1] - 25], look })

  // Never stand inside a building: step outward until clear, or drop the view.
  const inside = ([x, y], pts) => {
    let hit = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]
      const [xj, yj] = pts[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
    }
    return hit
  }
  const blocked = (p) => site.buildings.some((b) => !b.onLot && inside(p, b.outer))
  return out
    .map((v) => {
      const dir = v.out || [v.pos[0] - c[0], v.pos[1] - c[1]].map((k, _, arr) => k / (Math.hypot(...arr) || 1))
      let p = v.pos
      for (let k = 0; k < 20 && blocked(p); k++) p = [p[0] + dir[0], p[1] + dir[1]]
      return blocked(p) ? null : { ...v, pos: p }
    })
    .filter(Boolean)
}

/* ---------- First-person camera ---------- */

/** Shared with the on-screen arrow pad: which directions are held. */
export const walkKeys = { f: 0, b: 0, l: 0, r: 0, run: 0 }
const EYE = 1.65

/**
 * Eye-level camera: drag to look around, W/A/S/D or arrows to walk (Shift
 * runs), tap the ground to walk there. `preset` moves it to a viewpoint.
 */
export function StreetCam({ site, preset, walkTo }) {
  const { camera, gl, invalidate } = useThree()
  const hAt = useMemo(() => gridGround(site), [site])
  const st = useRef(null)

  // Wider lens at eye level; put the old one back on the way out.
  useEffect(() => {
    const was = { fov: camera.fov, near: camera.near }
    camera.fov = 62
    camera.near = 0.2
    camera.updateProjectionMatrix()
    return () => {
      camera.fov = was.fov
      camera.near = was.near
      camera.updateProjectionMatrix()
    }
  }, [camera])

  // Fly to a preset.
  useEffect(() => {
    if (!preset) return
    const [lx, ly, lz] = preset.look
    const [px, py] = preset.pos
    const yaw = Math.atan2(lx - px, ly - py)
    const eye = hAt(preset.pos) + EYE
    const pitch = Math.atan2(lz + hAt([lx, ly]) - eye, Math.hypot(lx - px, ly - py))
    const cur = st.current
    st.current = {
      x: cur?.x ?? px,
      y: cur?.y ?? py,
      yaw: cur?.yaw ?? yaw,
      pitch: cur?.pitch ?? pitch,
      anim: { t0: performance.now(), dur: cur ? 1300 : 0, from: cur ? { x: cur.x, y: cur.y, yaw: cur.yaw, pitch: cur.pitch } : null, to: { x: px, y: py, yaw, pitch } },
    }
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.id, preset?.key])

  // Tap-to-walk target from the ground.
  useEffect(() => {
    if (!walkTo || !st.current) return
    const s = st.current
    const yaw = Math.atan2(walkTo.at[0] - s.x, walkTo.at[1] - s.y)
    s.anim = { t0: performance.now(), dur: Math.min(4000, Math.max(500, Math.hypot(walkTo.at[0] - s.x, walkTo.at[1] - s.y) * 260)), from: { x: s.x, y: s.y, yaw: s.yaw, pitch: s.pitch }, to: { x: walkTo.at[0], y: walkTo.at[1], yaw: s.yaw, pitch: s.pitch }, turn: yaw }
    invalidate()
  }, [walkTo, invalidate])

  // Drag to look; keys to walk.
  useEffect(() => {
    const el = gl.domElement
    let drag = null
    const down = (e) => (drag = { x: e.clientX, y: e.clientY })
    const move = (e) => {
      if (!drag || !st.current) return
      const s = st.current
      s.yaw -= (e.clientX - drag.x) * 0.0042
      s.pitch = Math.max(-1.1, Math.min(1.1, s.pitch + (e.clientY - drag.y) * 0.0042))
      s.anim = null
      drag = { x: e.clientX, y: e.clientY }
      invalidate()
    }
    const up = () => (drag = null)
    const KEY = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' }
    const key = (v) => (e) => {
      if (e.target?.tagName === 'INPUT') return
      if (KEY[e.code]) {
        walkKeys[KEY[e.code]] = v
        e.preventDefault()
      }
      if (e.key === 'Shift') walkKeys.run = v
    }
    const kd = key(1)
    const ku = key(0)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    // While anything is moving, keep drawing (the canvas renders on demand).
    let raf = 0
    const tick = () => {
      if (walkKeys.f || walkKeys.b || walkKeys.l || walkKeys.r || st.current?.anim) invalidate()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      cancelAnimationFrame(raf)
      Object.assign(walkKeys, { f: 0, b: 0, l: 0, r: 0, run: 0 })
    }
  }, [gl, invalidate])

  useFrame((_, dt) => {
    const s = st.current
    if (!s) return
    const lim = site.half * 0.85
    if (s.anim) {
      const a = s.anim
      const t = a.dur ? Math.min(1, (performance.now() - a.t0) / a.dur) : 1
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      const f = a.from || a.to
      // Turn the shortest way round.
      let dyaw = (a.turn ?? a.to.yaw) - f.yaw
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw))
      s.x = f.x + (a.to.x - f.x) * e
      s.y = f.y + (a.to.y - f.y) * e
      s.yaw = f.yaw + dyaw * Math.min(1, e * 1.6)
      if (a.turn == null) s.pitch = f.pitch + (a.to.pitch - f.pitch) * e
      if (t >= 1) s.anim = null
    } else {
      const speed = (walkKeys.run ? 4.5 : 1.7) * Math.min(dt, 0.1)
      const fwd = walkKeys.f - walkKeys.b
      const strafe = walkKeys.r - walkKeys.l
      if (fwd || strafe) {
        s.x += (Math.sin(s.yaw) * fwd + Math.cos(s.yaw) * strafe) * speed
        s.y += (Math.cos(s.yaw) * fwd - Math.sin(s.yaw) * strafe) * speed
      }
    }
    s.x = Math.max(-lim, Math.min(lim, s.x))
    s.y = Math.max(-lim, Math.min(lim, s.y))
    const eye = hAt([s.x, s.y]) + EYE
    camera.position.set(...P(s.x, s.y, eye))
    const cp = Math.cos(s.pitch)
    camera.lookAt(camera.position.x + Math.sin(s.yaw) * cp, eye + Math.sin(s.pitch), camera.position.z - Math.cos(s.yaw) * cp)
  })

  return null
}

export { FT }
