import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { sampleTour, stopAt } from './tour.js'
import { tourRefs, tourState } from './tourState.js'

/**
 * Walks the camera along the tour route at eye height. While walking it looks
 * ahead along the path; on arriving in a room it turns to the room's view
 * and holds. Lens widens indoors (as on the main site's tour).
 *
 * `site` places the house on the lot: plan → lot is a rotation by rotY and a
 * shift to (x, z).
 */

const FOV_TOUR = 64
const ahead = new Vector3()

export function TourCamera({ tour, site, lampRef }) {
  const { camera } = useThree()
  const cur = useRef(null)
  const c = Math.cos(site.rotY)
  const s = Math.sin(site.rotY)
  const toLot = (x, z) => [site.x + x * c + z * s, site.z - x * s + z * c]
  const toPlan = (x, z) => {
    const dx = x - site.x
    const dz = z - site.z
    return [dx * c - dz * s, dx * s + dz * c]
  }

  // Wide lens and a close near plane while indoors; restored on exit.
  useEffect(() => {
    const was = { fov: camera.fov, near: camera.near }
    camera.fov = FOV_TOUR
    camera.near = 0.05
    camera.updateProjectionMatrix()
    tourState.set({ t: 0, stop: 0, playing: true, ended: false, fade: false, snap: true })
    cur.current = null
    return () => {
      camera.fov = was.fov
      camera.near = was.near
      camera.updateProjectionMatrix()
      if (lampRef.current) lampRef.current.intensity = 0
    }
  }, [tour, camera, lampRef])

  useFrame((_, dt) => {
    const st = tourState.get()
    let t = st.t
    if (st.playing && !st.ended) t = Math.min(tour.total, t + Math.min(dt, 0.12))
    const ended = t >= tour.total - 1e-3
    const stop = stopAt(tour, t)
    if (t !== st.t || stop !== st.stop || ended !== st.ended) {
      tourState.set({ t, stop, ended, playing: ended ? false : st.playing })
    }

    // Where to stand.
    const [px, pz] = sampleTour(tour, t)
    const [wx, wz] = toLot(px, pz)
    const pos = new Vector3(wx, tour.eye, wz)

    // Where to look: the room's view around a stop, otherwise ahead on the path.
    const here = tour.stops[stop]
    let look
    if (t >= here.at - 1.4 && t <= here.end) {
      const [lx, lz] = toLot(here.look[0], here.look[1])
      look = new Vector3(lx, here.lookY, lz)
    } else {
      const [ax, az] = sampleTour(tour, t + 1.1)
      const [awx, awz] = toLot(ax, az)
      ahead.set(awx, tour.eye, awz)
      if (ahead.distanceTo(pos) < 0.25) {
        const next = tour.stops[Math.min(stop + 1, tour.stops.length - 1)]
        const [lx, lz] = toLot(next.look[0], next.look[1])
        look = new Vector3(lx, next.lookY, lz)
      } else {
        look = ahead.clone()
      }
    }

    if (!cur.current || st.snap) {
      cur.current = { pos: pos.clone(), look: look.clone() }
      if (st.snap) tourState.set({ snap: false })
    }
    const k = cur.current
    k.pos.lerp(pos, 1 - Math.exp(-dt * 6))
    k.look.lerp(look, 1 - Math.exp(-dt * 2.8))
    camera.position.copy(k.pos)
    camera.lookAt(k.look)

    // A soft lamp that walks with the visitor, so rooms never read as dark boxes.
    const lamp = lampRef.current
    if (lamp) {
      lamp.position.set(k.pos.x, k.pos.y + 0.9, k.pos.z)
      lamp.intensity = 5
    }

    // Mini-plan marker and progress bar.
    if (tourRefs.marker) {
      const [mx, mz] = toPlan(k.pos.x, k.pos.z)
      const [fx, fz] = toPlan(k.pos.x + (k.look.x - k.pos.x), k.pos.z + (k.look.z - k.pos.z))
      const deg = (Math.atan2(fz - mz, fx - mx) * 180) / Math.PI
      tourRefs.marker.setAttribute('transform', `translate(${mx.toFixed(2)} ${mz.toFixed(2)}) rotate(${deg.toFixed(1)})`)
    }
    if (tourRefs.progress) tourRefs.progress.style.transform = `scaleX(${(t / tour.total).toFixed(4)})`
  })

  return null
}
