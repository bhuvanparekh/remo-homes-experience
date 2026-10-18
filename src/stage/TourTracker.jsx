import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { CHAPTERS } from '../config/chapters.config.js'
import { clamp, envelope } from '../core/math.js'
import { journey } from '../scroll/journey.js'
import { labelEls, liveCamera } from '../scroll/tourState.js'

const TOUR = CHAPTERS.findIndex((c) => c.id === 'tour')
const v = new Vector3()
const dir = new Vector3()

/** Shortens a → b by `cut` px at the b end. */
function pull(ax, ay, bx, by, cut) {
  const len = Math.hypot(bx - ax, by - ay) || 1
  return [bx - ((bx - ax) / len) * cut, by - ((by - ay) / len) * cut]
}

/**
 * The bridge from the 3D camera to the walkthrough overlay. Each frame, after
 * the camera has moved, it records where the camera really is (for the
 * mini-plan's "you are here") and pins every arrow label to its point on the
 * model: the text sits at a fixed screen offset from the anchor and a curved
 * arrow — ReMo's Instagram callout style — runs from the text to it.
 *
 * Runs after the camera rig and the render (priority 2), writes only styles
 * and SVG path data, and does nothing outside the walkthrough chapter.
 */
export function TourTracker() {
  useFrame(({ camera, size }) => {
    camera.getWorldDirection(dir)
    liveCamera.x = camera.position.x
    liveCamera.y = camera.position.y
    liveCamera.z = camera.position.z
    liveCamera.heading = Math.atan2(dir.z, dir.x)

    const { index, t } = journey.get()
    const inTour = index === TOUR
    const k = clamp(size.width / 1440, 0.62, 1)

    for (const label of labelEls.values()) {
      const o = inTour ? envelope(t, label.window[0], label.window[1], 0.015) : 0
      if (o <= 0.001) {
        if (label.shown) {
          label.root.style.opacity = 0
          label.path.style.opacity = 0
          label.shown = false
        }
        continue
      }

      v.set(label.anchor[0], label.anchor[1], label.anchor[2]).project(camera)
      if (v.z > 1) continue
      const W = size.width
      const H = size.height
      const ax = ((v.x + 1) / 2) * W
      const ay = ((1 - v.y) / 2) * H

      // Text goes on the side of the anchor facing the middle of the screen,
      // then the whole text box is kept clear of the edges, the header, the
      // room card (left) and the rail + plan panel (right).
      const text = label.root.firstChild
      if (!label.w) {
        label.w = text.offsetWidth
        label.h = text.offsetHeight
      }
      const left = ax > W * 0.56 ? true : ax < W * 0.44 ? false : label.dx < 0
      const up = label.dy < 0
      if (left !== label.left) {
        text.classList.toggle('is-left', left)
        label.left = left
      }
      const phone = W < 760
      const gutter = clamp(W * 0.04, 16, 48)
      const minX = phone ? 16 : gutter + 440 + 24
      const maxX = phone ? W - 16 : W - gutter - 170
      // Phones: the plan panel owns the top right, the room card the bottom.
      const minY = phone ? H * 0.38 : 96
      const maxY = phone ? H * 0.62 : H - 24
      let sx = ax + Math.abs(label.dx) * k * (left ? -1 : 1)
      let sy = ay + label.dy * k
      sx = left ? clamp(sx, minX + label.w, maxX) : clamp(sx, minX, maxX - label.w)
      sy = up ? clamp(sy, minY + label.h, maxY) : clamp(sy, minY, maxY - label.h)

      label.root.style.transform = `translate3d(${sx}px, ${sy}px, 0)`
      label.root.style.opacity = o
      label.path.style.opacity = o
      label.shown = true

      // Arrow: from just off the text corner to just short of the anchor,
      // bowed sideways like a hand-drawn stroke, with an open arrowhead.
      const [x0, y0] = pull(ax, ay, sx, sy, 10)
      const [x1, y1] = pull(sx, sy, ax, ay, 7)
      const mx = (x0 + x1) / 2
      const my = (y0 + y1) / 2
      const bow = 0.28 * (left ? -1 : 1) * (up ? 1 : -1)
      const cx = mx - (y1 - y0) * bow
      const cy = my + (x1 - x0) * bow
      const tl = Math.hypot(x1 - cx, y1 - cy) || 1
      const tx = (x1 - cx) / tl
      const ty = (y1 - cy) / tl
      const wing = 9
      const c = Math.cos(0.5)
      const s = Math.sin(0.5)
      const w1x = x1 - wing * (tx * c - ty * s)
      const w1y = y1 - wing * (ty * c + tx * s)
      const w2x = x1 - wing * (tx * c + ty * s)
      const w2y = y1 - wing * (ty * c - tx * s)
      label.path.setAttribute(
        'd',
        `M${x0.toFixed(1)} ${y0.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}` +
          `M${w1x.toFixed(1)} ${w1y.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}L${w2x.toFixed(1)} ${w2y.toFixed(1)}`,
      )
    }
  }, 2)

  return null
}
