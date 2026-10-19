import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { EquirectangularReflectionMapping } from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { boxM } from '../stage/house/geometry.js'
import { MaterialsProvider, useBuildMaterials } from '../stage/house/materials.js'
import { Wall } from '../stage/house/Shell.jsx'
import { StaticBatch } from '../stage/house/StaticBatch.jsx'
import { envUrl } from '../stage/world/assets.js'
import { CEILING, DECK_DEPTH, DEPTH, FLOOR_Y } from './generator.js'
import { buildHouse } from './houseModel.js'
import { roomFurniture } from './furniture.jsx'
import { styledMaterials } from './styles.js'

/**
 * The visitor's plan as a finished ReMo-style house: white panel walls with
 * black window surrounds, glass doors onto oak decks, a flat white roof with
 * solar — and inside, every room furnished.
 *
 * Stages (driven by the studio):
 *   house     floors, then walls rise, then the roof is set down on top
 *   interior  the roof lifts away and furniture drops into each room
 * Editing the brief rebuilds the model in place without replaying anything.
 */

const ROOF_T = 0.32
const OVERHANG = 0.12
const LID_LIFT = 9
const TILT = (6 * Math.PI) / 180

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const easeOut = (t) => 1 - (1 - t) ** 3
const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2

/** Reflections from the same Poly Haven sky as the main site. */
export function SkyLight() {
  const scene = useThree((s) => s.scene)
  const hdr = useLoader(HDRLoader, envUrl('sky_1k.hdr'))
  useEffect(() => {
    hdr.mapping = EquirectangularReflectionMapping
    scene.environment = hdr
    scene.environmentIntensity = 0.5
    return () => {
      scene.environment = null
    }
  }, [hdr, scene])
  return null
}

/* ---------- parts ---------- */

function Floors({ m, house }) {
  const L = house.length
  return (
    <group>
      {/* Platform and skirt down to the gravel */}
      <mesh geometry={boxM(L - 0.02, FLOOR_Y - 0.05, DEPTH - 0.02)} material={m.skirt} position={[0, (FLOOR_Y + 0.05) / 2, 0]} castShadow receiveShadow />
      {house.rooms.map((r) => {
        const tile = ['bath', 'ensuite', 'laundry'].includes(r.kind)
        return (
          <mesh
            key={r.id}
            geometry={boxM(r.x1 - r.x0, 0.01, r.z1 - r.z0)}
            material={tile ? m.tile : m.floor}
            position={[(r.x0 + r.x1) / 2, FLOOR_Y + 0.005 + (tile ? 0.002 : 0), (r.z0 + r.z1) / 2]}
            receiveShadow
          />
        )
      })}
    </group>
  )
}

/** Oak decks with three steps down, and black canopies over the glass doors. */
function Decks({ m, house }) {
  const D = DEPTH
  return house.decks.map((d) => {
    const s = d.side === 'front' ? 1 : -1
    const w = d.x1 - d.x0
    const cx = (d.x0 + d.x1) / 2
    const zIn = s * (D / 2)
    const top = FLOOR_Y - 0.04
    return (
      <group key={d.id}>
        <mesh geometry={boxM(w, top, DECK_DEPTH)} material={m.deck} position={[cx, top / 2, zIn + (s * DECK_DEPTH) / 2]} castShadow receiveShadow />
        {[1, 2].map((i) => (
          <mesh
            key={i}
            geometry={boxM(w * 0.7, (top * (3 - i)) / 3, 0.3)}
            material={m.deck}
            position={[cx, (top * (3 - i)) / 6, zIn + s * (DECK_DEPTH + 0.15 + (i - 1) * 0.3)]}
            castShadow
            receiveShadow
          />
        ))}
        <mesh
          geometry={boxM(w + 0.3, 0.09, DECK_DEPTH - 0.1)}
          material={m.frame}
          position={[cx, FLOOR_Y + 2.62, zIn + s * ((DECK_DEPTH - 0.1) / 2)]}
          castShadow
        />
      </group>
    )
  })
}

/** Ceiling, roof slab, fascia and a solar array over the front half. */
function Lid({ m, house }) {
  const L = house.length
  const base = FLOOR_Y + CEILING + 0.02
  const top = base + ROOF_T
  const W = L + OVERHANG * 2
  const Dd = DEPTH + OVERHANG * 2

  const panels = useMemo(() => {
    const p = 1.0
    const gap = 0.06
    const cols = Math.max(2, Math.floor((L * 0.82) / (p + gap)))
    const rows = 3
    const x1 = (cols * (p + gap)) / 2
    const out = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x1 - p / 2 - c * (p + gap), 0.35 + p / 2 + r * (p + gap)])
    return out
  }, [L])

  return (
    <group>
      <mesh geometry={boxM(L - 0.1, 0.02, DEPTH - 0.1)} material={m.ceiling} position={[0, base - 0.01, 0]} receiveShadow />
      <mesh geometry={boxM(W, ROOF_T, Dd)} material={m.roof} position={[0, base + ROOF_T / 2, 0]} castShadow receiveShadow />
      <mesh geometry={boxM(W + 0.02, 0.06, Dd + 0.02)} material={m.fascia} position={[0, top + 0.03, 0]} castShadow />
      <mesh geometry={boxM(W - 0.3, 0.02, Dd - 0.3)} material={m.roof} position={[0, top + 0.05, 0]} receiveShadow />
      {panels.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, top + 0.2, z]} rotation-x={-TILT}>
          <mesh geometry={boxM(1.0, 0.035, 1.0)} material={m.solarFrame} castShadow />
          <mesh position={[0, 0.019, 0]} rotation-x={-Math.PI / 2} material={m.solar}>
            <planeGeometry args={[0.97, 0.97]} />
          </mesh>
        </group>
      ))}
      <mesh geometry={boxM(1.6, 0.5, 1.0)} material={m.fascia} position={[-L / 2 + 1.6, top + 0.3, -DEPTH / 2 + 1.1]} castShadow />
    </group>
  )
}

/* ---------- the house ---------- */

export function StudioHouse({ plan, stage, stageAt, prevStage, style }) {
  const base = useBuildMaterials()
  const m = useMemo(() => styledMaterials(base, style), [base, style])
  const { house, site, spec } = plan
  const model = useMemo(() => buildHouse(house, spec), [house, spec])
  const rooms = useMemo(
    () =>
      [...house.rooms]
        .sort((a, b) => a.x0 - b.x0 || b.z1 - a.z1)
        .map((r) => ({ room: r, f: roomFurniture(r, model.doors, house.length) }))
        .filter((x) => x.f),
    [house, model],
  )

  const root = useRef(null)
  const floors = useRef(null)
  const walls = useRef(null)
  const decks = useRef(null)
  const lid = useRef(null)
  const furniture = useRef([])

  // A build plays only when the visitor has just stepped up from the massing
  // (allowing a few seconds for textures to load the first time); a rebuild
  // after editing the brief appears finished.
  const anim = useRef(null)
  if (anim.current === null) {
    const now = performance.now() / 1000
    const fresh = stage === 'house' && prevStage === 'massing' && now - stageAt < 6
    anim.current = {
      fresh,
      // Set once the shaders are compiled (see below); until then nothing shows.
      buildStart: fresh ? Infinity : -100,
      lift: stage === 'interior' ? LID_LIFT : 0,
      stage,
      roomStart: rooms.map(() => (stage === 'interior' || stage === 'tour' ? -100 : null)),
      pos: null,
    }
  }

  // Compile every material before the build starts. Otherwise the first
  // frames stall on shader compiles and the animation is over before it's seen.
  const { gl, camera, scene } = useThree()
  useEffect(() => {
    const groups = [floors.current, walls.current, decks.current, lid.current, ...furniture.current].filter(Boolean)
    const was = groups.map((g) => g.visible)
    groups.forEach((g) => (g.visible = true))
    const done = gl.compileAsync(root.current, camera, scene).catch(() => {})
    groups.forEach((g, i) => (g.visible = was[i]))
    const start = () => {
      const a = anim.current
      if (a.fresh && a.buildStart === Infinity) a.buildStart = performance.now() / 1000 + 0.05
    }
    let live = true
    done.then(() => live && start())
    // Never leave the visitor waiting on a compile that doesn't report back.
    const fallback = setTimeout(start, 2500)
    return () => {
      live = false
      clearTimeout(fallback)
    }
  }, [gl, camera, scene])

  useFrame((_, dt) => {
    const a = anim.current
    const now = performance.now() / 1000

    // Glide with the plan when the lot turns the house.
    if (!a.pos) a.pos = { x: site.x, z: site.z, r: site.rotY }
    const k = 1 - Math.exp(-dt * 6)
    a.pos.x += (site.x - a.pos.x) * k
    a.pos.z += (site.z - a.pos.z) * k
    a.pos.r += (site.rotY - a.pos.r) * k
    root.current.position.set(a.pos.x, 0, a.pos.z)
    root.current.rotation.y = a.pos.r

    // Build: floors → walls → decks → roof.
    const tb = now - a.buildStart
    floors.current.scale.y = Math.max(0.001, easeOut(clamp01(tb / 0.5)))
    walls.current.scale.y = Math.max(0.001, easeOut(clamp01((tb - 0.35) / 1.1)))
    walls.current.visible = tb > 0.35
    const dk = easeOut(clamp01((tb - 1.0) / 0.5))
    decks.current.scale.set(1, Math.max(0.001, dk), 1)
    decks.current.visible = tb > 1.0
    const drop = 5 * (1 - easeOutBack(clamp01((tb - 1.45) / 0.9)))

    // Roof off for the interior, back on for the house.
    const inside = stage === 'interior' || stage === 'tour'
    if (stage !== a.stage) {
      const was = a.stage
      a.stage = stage
      // Furniture drops in when the roof first comes off; it's already in
      // place when moving between the interior view and the walkthrough.
      if (stage === 'interior' && was !== 'tour') a.roomStart = rooms.map((_, i) => now + 0.55 + i * 0.09)
      if (stage === 'tour' && was !== 'interior') a.roomStart = rooms.map(() => -100)
    }
    const liftTarget = stage === 'interior' ? LID_LIFT : 0
    a.lift += (liftTarget - a.lift) * (1 - Math.exp(-dt * 2.6))
    lid.current.position.y = drop + a.lift
    lid.current.visible = tb > 1.45 && a.lift < LID_LIFT - 0.4

    // Furniture drops in, room by room, once the roof is up.
    rooms.forEach((_, i) => {
      const g = furniture.current[i]
      if (!g) return
      const start = a.roomStart[i]
      if (!inside) {
        // Keep it while the roof comes back down, then stop drawing it.
        g.visible = a.lift > 0.6
        if (!g.visible) a.roomStart[i] = null
        return
      }
      const t = start == null ? 1 : clamp01((now - start) / 0.6)
      g.visible = start == null || now >= start
      g.position.y = 1.4 * (1 - easeOutBack(t))
    })
  })

  return (
    <MaterialsProvider value={m}>
      <group ref={root}>
        <group ref={floors}>
          <Floors m={m} house={house} />
        </group>
        <group ref={walls}>
          {model.exteriorWalls.map((w) => (
            <Wall key={w.id} wall={w} exterior />
          ))}
          <StaticBatch>
            {model.interiorWalls.map((w) => (
              <Wall key={w.id} wall={w} />
            ))}
          </StaticBatch>
        </group>
        <group ref={decks}>
          <Decks m={m} house={house} />
        </group>
        <group ref={lid}>
          <Lid m={m} house={house} />
        </group>
        {rooms.map(({ room, f }, i) => (
          <group key={room.id} ref={(el) => (furniture.current[i] = el)} visible={false}>
            <group position={[f.pos[0], FLOOR_Y + 0.01, f.pos[1]]} rotation-y={f.rot}>
              <StaticBatch>
                <f.Comp m={m} {...f.props} />
              </StaticBatch>
            </group>
          </group>
        ))}
      </group>
    </MaterialsProvider>
  )
}
