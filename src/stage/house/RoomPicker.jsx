import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CHAPTERS } from '../../config/chapters.config.js'
import { EXTERIOR_WALLS, HOUSE, INTERIOR_WALLS, ROOMS_PLAN } from '../../config/floorplan.js'
import { PICKER, STOPS } from '../../config/tour.config.js'
import { range, smoothstep } from '../../core/math.js'
import { journey } from '../../scroll/journey.js'
import { useJourney } from '../../scroll/JourneyProvider.jsx'
import { picker } from '../../scroll/tourState.js'
import { boxM } from './geometry.js'

const HOME = CHAPTERS.findIndex((c) => c.id === 'home')
const TOUR = CHAPTERS.findIndex((c) => c.id === 'tour')

/** Top of the walls, where the section caps sit once the lid is off. */
const WALL_TOP = HOUSE.floorY + HOUSE.ceiling
/** Everything that lifts off as the lid: roof slab, fascia, solar, ceiling. */
const LID = ['roof', 'fascia', 'solar', 'solarFrame', 'ceiling', 'downlight']

/** 0 = lid on, 1 = lid fully off: lifts away, holds, comes back. */
function lidLift() {
  const { index, t } = journey.get()
  if (index !== HOME) return 0
  const off = smoothstep(range(t, ...PICKER.cut))
  const on = smoothstep(range(t, ...PICKER.restore))
  return Math.min(off, 1 - on)
}

const ink = new MeshStandardMaterial({ color: '#2b2522', roughness: 0.9 })
const hit = new MeshBasicMaterial({ colorWrite: false, depthWrite: false })
const glow = new MeshBasicMaterial({ color: '#d9ad55', transparent: true, opacity: 0.38, depthWrite: false })

const stopFor = (roomId) => STOPS.find((s) => s.plan === roomId)

const rectOf = (room) => {
  const xs = room.poly.map((p) => p[0])
  const zs = room.poly.map((p) => p[1])
  const x0 = Math.min(...xs)
  const z0 = Math.min(...zs)
  return { x0, z0, w: Math.max(...xs) - x0, d: Math.max(...zs) - z0 }
}

/**
 * The dollhouse view. The roof, solar array and ceiling (merged meshes of
 * the assembled house) lift off as one lid and disappear; dark caps — an
 * architect's section fill — then sit on the wall tops. No clipping planes:
 * a clip `discard` in every house shader would cost the whole tour its early
 * depth test. Invisible floor tiles per room take the pointer: hover lights
 * a room (and its line in the list card), click walks to it if it's on the
 * tour.
 */
export function RoomPicker({ materials, modulesRef }) {
  const gl = useThree((s) => s.gl)
  const { goToChapter } = useJourney()
  const caps = useRef(null)
  const highlight = useRef(null)
  const active = useRef(false)
  const lastLift = useRef(-1)
  const lid = useRef(null)
  const lidMaterials = useMemo(() => LID.map((n) => materials[n]), [materials])

  const capGeometry = useMemo(() => {
    const parts = [...EXTERIOR_WALLS, ...INTERIOR_WALLS].map((w) => {
      const dx = w.b[0] - w.a[0]
      const dz = w.b[1] - w.a[1]
      const len = Math.hypot(dx, dz)
      const thick = (EXTERIOR_WALLS.includes(w) ? HOUSE.extWall : HOUSE.intWall) + 0.02
      const g = boxM(len + thick, 0.03, thick).clone()
      g.rotateY(-Math.atan2(dz, dx))
      g.translate((w.a[0] + w.b[0]) / 2, 0, (w.a[1] + w.b[1]) / 2)
      return g
    })
    return mergeGeometries(parts, false)
  }, [])

  useEffect(
    () =>
      picker.subscribe(({ hover }) => {
        const room = ROOMS_PLAN.find((r) => r.id === hover)
        if (!highlight.current) return
        highlight.current.visible = !!room
        if (!room) return
        const { x0, z0, w, d } = rectOf(room)
        highlight.current.position.set(x0 + w / 2, HOUSE.floorY + 0.04, z0 + d / 2)
        highlight.current.scale.set(w - 0.1, d - 0.1, 1)
      }),
    [],
  )

  useFrame(() => {
    const { index, t } = journey.get()
    active.current = index === HOME && t >= PICKER.hold[0] - 0.02 && t <= PICKER.hold[1] + 0.01
    if (!active.current && picker.get().hover) {
      picker.set({ hover: null })
      document.body.style.cursor = ''
    }

    if (!lid.current && modulesRef.current) lid.current = modulesRef.current.wholeMeshes(lidMaterials)
    if (!lid.current) return
    const k = lidLift()
    if (k === lastLift.current) return
    lastLift.current = k
    // Rises 5 m over the first half of the move, then is gone.
    const rise = Math.min(1, k * 2) * 5
    for (const m of lid.current) {
      m.position.y = rise
      m.updateMatrix()
      m.visible = k < 0.5
    }
    caps.current.visible = k >= 0.5
    gl.shadowMap.needsUpdate = true
  })

  const over = (id) => (e) => {
    if (!active.current) return
    e.stopPropagation()
    if (picker.get().hover !== id) picker.set({ hover: id })
    document.body.style.cursor = stopFor(id) ? 'pointer' : 'default'
  }
  const out = (id) => () => {
    if (picker.get().hover === id) picker.set({ hover: null })
    document.body.style.cursor = ''
  }
  const click = (id) => (e) => {
    if (!active.current) return
    e.stopPropagation()
    const stop = stopFor(id)
    if (stop) goToChapter(TOUR, stop.from + 0.012)
  }

  return (
    <group>
      <mesh ref={caps} geometry={capGeometry} material={ink} position-y={WALL_TOP + 0.016} visible={false} />
      <mesh ref={highlight} rotation-x={-Math.PI / 2} material={glow} visible={false} renderOrder={5}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      {ROOMS_PLAN.map((r) => {
        const { x0, z0, w, d } = rectOf(r)
        return (
          <mesh
            key={r.id}
            material={hit}
            rotation-x={-Math.PI / 2}
            position={[x0 + w / 2, HOUSE.floorY + 0.03, z0 + d / 2]}
            onPointerMove={over(r.id)}
            onPointerOut={out(r.id)}
            onClick={click(r.id)}
          >
            <planeGeometry args={[w, d]} />
          </mesh>
        )
      })}
    </group>
  )
}
