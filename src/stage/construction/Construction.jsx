import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Plane, Vector3 } from 'three'
import { CHAPTERS } from '../../config/chapters.config.js'
import { BUILD, CRANE, MODULES, MODULE_COUNT, MODULE_TOP, TRUCK } from '../../config/construction.config.js'
import { range, smoothstep } from '../../core/math.js'
import { journey } from '../../scroll/journey.js'
import { EXPLORE } from '../CameraRig.jsx'
import { buildMembers, galv, Members } from '../house/SteelFrame.jsx'
import { Blueprint, Footings } from './Groundworks.jsx'
import { Crane, HOOK_DROP, Truck } from './Machines.jsx'

const BUILD_CHAPTER = CHAPTERS.findIndex((c) => c.id === 'construction')

/** 0 before the construction chapter, its local time during it, 1 after. */
function buildProgress() {
  if (EXPLORE) return 1
  const { index, t } = journey.get()
  return index < BUILD_CHAPTER ? 0 : index > BUILD_CHAPTER ? 1 : t
}

const ease = (p, [a, b]) => smoothstep(range(p, a, b))
const lerp = (a, b, t) => a + (b - a) * t

/** Height a module is carried at between the truck and its slot. */
const CARRY = TRUCK.bed + 6.5
/** Where the hook waits above the truck for the next load. */
const HOOK_PARK = TRUCK.bed + MODULE_TOP + HOOK_DROP

/**
 * Where module `k` is at build progress `p`: its offset from its final place,
 * whether it's visible, and whether it's hanging from the crane.
 */
function moduleState(k, p, out) {
  const slot = MODULES[k].cx
  const onTruckX = TRUCK.x - slot
  const [d0, d1] = BUILD.deliver
  const s = range(p, d0, d1) * MODULE_COUNT - k // this module's own 0..1 window

  out.attached = false
  if (s >= 0.85) return out.set(0, 0, 0, true)
  if (k > 0 && s <= 0) return out.set(0, 0, 0, false)

  // Riding in on the truck (module 0 was built on it, so it's already there).
  const truckZ = k === 0 ? TRUCK.z : lerp(TRUCK.enterZ, TRUCK.z, smoothstep(s / 0.25))
  if (s < 0.25) return out.set(onTruckX, TRUCK.bed, truckZ, true)

  // Lift, swing over, lower.
  out.attached = true
  const u = (s - 0.25) / 0.6
  const rise = smoothstep(u / 0.25)
  const travel = smoothstep((u - 0.25) / 0.5)
  const lower = smoothstep((u - 0.75) / 0.25)
  const y = u < 0.75 ? lerp(TRUCK.bed, CARRY, rise) : lerp(CARRY, 0, lower)
  return out.set(lerp(onTruckX, 0, travel), y, lerp(TRUCK.z, 0, travel), true)
}

/** Truck z (or null when it's off site) at progress `p`. */
function truckZ(p) {
  const [m0] = BUILD.manufacture
  const [d0, d1] = BUILD.deliver
  if (p < m0 - 0.005 || p > d1) return null
  if (p < d0) return lerp(TRUCK.enterZ, TRUCK.z, smoothstep(range(p, m0 - 0.005, m0 + 0.025)))
  const w = range(p, d0, d1) * MODULE_COUNT
  const k = Math.min(MODULE_COUNT - 1, Math.floor(w))
  const s = w - k
  if (s < 0.25) return k === 0 ? TRUCK.z : lerp(TRUCK.enterZ, TRUCK.z, smoothstep(s / 0.25))
  if (s < 0.85) return TRUCK.z
  return lerp(TRUCK.z, TRUCK.enterZ, smoothstep((s - 0.85) / 0.15))
}

class State {
  constructor() {
    this.x = 0
    this.y = 0
    this.z = 0
    this.visible = false
    this.attached = false
  }
  set(x, y, z, visible) {
    this.x = x
    this.y = y
    this.z = z
    this.visible = visible
    return this
  }
}

/**
 * Chapter 03 as one scroll-driven build, on the real lot:
 *   design      gold wireframe of the digital model rises over the dirt
 *   approve     foundation comes up out of the ground
 *   manufacture module 1's steel frame, then its finished shell, on the truck
 *   deliver     the crane sets modules 1–4; the truck fetches each next one
 *   landscape   decks and path settle in, lawn spreads, planting grows
 *
 * Everything is a pure function of scroll progress, so scrolling back
 * un-builds the house. Shadows re-render only while something is moving.
 */
export function Construction({ modulesRef, hardscapeRef, lawnRef, plantingRef }) {
  const gl = useThree((s) => s.gl)
  const blueprint = useRef(null)
  const bpFill = useRef(null)
  const bpLines = useRef(null)
  const footings = useRef(null)
  const truck = useRef(null)
  const crane = useRef(null)
  const craneApi = useRef(null)
  const frameGroup = useRef(null)
  const last = useRef(-1)
  const state = useMemo(() => new State(), [])
  const hookAt = useMemo(() => new Vector3(), [])

  // The factory frame of module 1: same members as the X-ray frame, clipped
  // to that module and revealed upward by its own plane.
  const frameTop = useMemo(() => new Plane(new Vector3(0, -1, 0), 0), [])
  const frame = useMemo(() => {
    const { studs, beams, frame: chassis } = buildMembers()
    return { items: [...studs, ...beams, ...chassis], material: galv.clone() }
  }, [])

  useEffect(() => {
    gl.localClippingEnabled = true
  }, [gl])

  const root = useRef(null)
  const warmed = useRef(false)

  useFrame(({ camera, scene }) => {
    const api = modulesRef.current
    if (!api) return

    // Compile every construction-only material up front (clipped module
    // clones, frame, machines), so the build doesn't stutter the first time
    // each piece appears. Hidden objects are skipped by compile, so they are
    // made visible for the call and restored.
    if (!warmed.current) {
      warmed.current = true
      const targets = [root.current, ...api.units.map((u) => u.group)]
      const hidden = []
      for (const t of targets) t.traverse((o) => !o.visible && (hidden.push(o), (o.visible = true)))
      for (const t of targets) gl.compileAsync(t, camera, scene).catch(() => {})
      for (const o of hidden) o.visible = false
    }
    const p = buildProgress()

    // Attach the frame to module 1's group once the modules exist.
    if (frameGroup.current && frameGroup.current.parent !== api.units[0].group) {
      api.units[0].group.add(frameGroup.current)
      const u = api.units[0]
      frame.material.clippingPlanes = [u.left, u.right, frameTop]
    }

    if (p === last.current) return
    last.current = p
    gl.shadowMap.needsUpdate = true

    // Design + approval: the wireframe model.
    const show = ease(p, [0.01, 0.07]) * (1 - ease(p, [BUILD.manufacture[0] + 0.02, BUILD.manufacture[0] + 0.1]))
    blueprint.current.visible = show > 0.001
    blueprint.current.scale.y = Math.max(0.004, ease(p, [0.07, BUILD.design[1] - 0.01]))
    bpFill.current.material.opacity = 0.12 * show
    bpLines.current.material.opacity = 0.95 * show

    // Foundation.
    const f = ease(p, [BUILD.approve[0] + 0.03, BUILD.approve[1] - 0.03])
    footings.current.visible = f > 0.001
    footings.current.scale.y = Math.max(0.001, f)

    // Modules — while any is off its slot, render them separately; once the
    // last one lands, swap back to the single merged house.
    const [d0, d1] = BUILD.deliver
    const assembled = p >= d0 + ((MODULE_COUNT - 1 + 0.85) / MODULE_COUNT) * (d1 - d0)
    api.setAssembled(assembled)
    const [m0, m1] = BUILD.manufacture
    const framed = ease(p, [m0 + 0.02, m0 + 0.11])
    const closed = ease(p, [m0 + 0.1, m1 - 0.01])
    for (let k = 0; k < MODULE_COUNT; k++) {
      moduleState(k, p, state)
      const u = api.units[k]
      if (!assembled) u.group.visible = state.visible && (k > 0 || framed > 0)
      api.setOffset(k, state.x, state.y, state.z)
      if (k === 0) api.setReveal(0, closed >= 1 ? 1000 : closed * (MODULE_TOP + 0.05))
      if (state.attached) hookAt.set(MODULES[k].cx + state.x, state.y + MODULE_TOP + HOOK_DROP, state.z)
    }
    frameGroup.current.visible = framed > 0 && closed < 1
    frameTop.constant = TRUCK.bed + 0.02 + framed * (MODULE_TOP - 0.1)

    // Truck.
    const tz = truckZ(p)
    truck.current.visible = tz !== null
    if (tz !== null) truck.current.position.set(TRUCK.x, 0, tz)

    // Crane: drives in before manufacturing ends, leaves during landscaping.
    const arrive = ease(p, [m1 - 0.06, m1 - 0.01])
    const leave = ease(p, [d1 + 0.01, d1 + 0.07])
    const cz = CRANE.z + (1 - arrive) * 45 + leave * 45
    craneApi.current?.setVisible(arrive > 0 && leave < 1)
    crane.current.position.set(CRANE.x, 0, cz)
    const w = range(p, d0, d1) * MODULE_COUNT
    const k = Math.min(MODULE_COUNT - 1, Math.floor(w))
    const s = w - k
    let attached = false
    if (p >= d0 && p < d1 && s >= 0.25 && s < 0.85) {
      attached = true
    } else if (p >= d0 && p < d1 && s >= 0.85) {
      // Hook returns from the slot to wait over the truck.
      const back = smoothstep((s - 0.85) / 0.15)
      hookAt.set(lerp(MODULES[k].cx, TRUCK.x, back), lerp(MODULE_TOP + HOOK_DROP, HOOK_PARK + 1, back), lerp(0, TRUCK.z, back))
    } else {
      hookAt.set(TRUCK.x, HOOK_PARK + 1, TRUCK.z + (cz - CRANE.z))
    }
    craneApi.current?.pose(hookAt.x, hookAt.z, hookAt.y, attached)

    // Landscaping.
    const [l0, l1] = BUILD.landscape
    const hard = ease(p, [l0, l0 + 0.05])
    hardscapeRef.current.visible = hard > 0
    hardscapeRef.current.position.y = -0.7 * (1 - hard)
    const grass = ease(p, [l0 + 0.02, l1 - 0.01])
    lawnRef.current.opacity = grass
    lawnRef.current.visible = grass > 0.01
    plantingRef.current?.setOpacity(ease(p, [l0 + 0.03, l1]))
  })

  return (
    <group ref={root}>
      <Blueprint groupRef={blueprint} fillRef={bpFill} lineRef={bpLines} />
      <Footings groupRef={footings} />
      <group ref={frameGroup} visible={false}>
        <Members items={frame.items} material={frame.material} />
      </group>
      <Truck groupRef={truck} />
      <Crane groupRef={crane} apiRef={craneApi} />
    </group>
  )
}
