import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BOUNDS } from '../config/floorplan.js'
import { damp } from '../core/math.js'
import { cameraPath, journey } from '../scroll/journey.js'

// ?snap disables damping — used by screenshot checks, where the headless
// renderer is too slow for the glide to settle.
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
const SNAP = params.has('snap')
// ?explore hands the camera to the mouse (drag to orbit, right-drag to pan,
// pinch/ctrl-wheel to zoom) for reviewing the model. Scroll still changes the
// time of day.
export const EXPLORE = params.has('explore')

function ExploreControls() {
  const camera = useThree((s) => s.camera)
  const dom = useThree((s) => s.gl.domElement)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    camera.position.set(20, 9, 22)
    camera.near = 0.05
    camera.updateProjectionMatrix()
    const controls = new OrbitControls(camera, dom)
    controls.target.set(0, 1.6, 0)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI * 0.495
    controls.minDistance = 0.5
    controls.maxDistance = 400
    controls.zoomToCursor = true
    controls.update()
    let frame = requestAnimationFrame(function tick() {
      controls.update()
      frame = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(frame)
      controls.dispose()
    }
  }, [camera, dom, invalidate])

  return null
}

/** Within the footprint (plus the front deck) at standing height. */
const isInside = ([x, y, z]) => Math.abs(x) < BOUNDS.x1 + 0.6 && Math.abs(z) < BOUNDS.z1 + 1.5 && y < 4

const FOV_OUT = 42
const FOV_IN = 58

const target = [0, 0, 0]
const look = [0, 0, 0]

/**
 * Puts the camera wherever scroll progress says it should be.
 *
 * Lenis already smooths the scroll itself; this adds a light second-order
 * damping on top so a flick of a trackpad becomes a glide instead of a jump.
 * It snaps on the very first frame so the page never opens mid-swoop.
 */
export function CameraRig() {
  return EXPLORE ? <ExploreControls /> : <ScrollCamera />
}

function ScrollCamera() {
  const lookAt = useRef(new Vector3())
  const primed = useRef(false)

  useFrame(({ camera }, delta) => {
    cameraPath.sample(journey.get().progress, target, look)
    const dt = Math.min(delta, 0.1)

    // Portrait phones: the keys are framed for landscape, so outdoor shots
    // pull back along the view line until the subject fits the narrow frame.
    // Indoors the wide lens already copes, and backing up would leave the room.
    // Capped at 40 m from the subject so it never backs into the treeline.
    const dist = Math.hypot(target[0] - look[0], target[1] - look[1], target[2] - look[2])
    const pull = Math.max(1, Math.min(2.2, 1 / camera.aspect, 40 / dist))
    if (pull > 1 && !isInside(target)) {
      for (let a = 0; a < 3; a++) target[a] = look[a] + (target[a] - look[a]) * pull
    }

    if (!primed.current || SNAP) {
      camera.position.set(...target)
      lookAt.current.set(...look)
      primed.current = true
    } else {
      camera.position.x = damp(camera.position.x, target[0], 6, dt)
      camera.position.y = damp(camera.position.y, target[1], 6, dt)
      camera.position.z = damp(camera.position.z, target[2], 6, dt)
      lookAt.current.x = damp(lookAt.current.x, look[0], 6, dt)
      lookAt.current.y = damp(lookAt.current.y, look[1], 6, dt)
      lookAt.current.z = damp(lookAt.current.z, look[2], 6, dt)
    }

    camera.lookAt(lookAt.current)

    // Indoors the lens widens to an interior photographer's ~24 mm, the way
    // ReMo's own renders are shot; outside it stays a natural 42° (vertical).
    const { y } = camera.position
    const inside = isInside([camera.position.x, y, camera.position.z])
    const fov = SNAP ? (inside ? FOV_IN : FOV_OUT) : damp(camera.fov, inside ? FOV_IN : FOV_OUT, 3, dt)

    // Near plane rides with altitude: metres-scale up in the clouds (depth
    // precision for 15 km of terrain), centimetres inside the house.
    const near = Math.min(4, Math.max(0.05, y * 0.002))
    if (Math.abs(near - camera.near) > 0.01 || Math.abs(fov - camera.fov) > 0.01) {
      camera.near = near
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}
