import { catmullRom, clamp, findSegment, smoothstep } from '../core/math.js'

/**
 * Pure: chapters' local camera keys → one samplable path over global progress.
 *
 * Positions run through a Catmull-Rom spline so the camera curves between
 * keys instead of turning corners. The look-at target is eased per segment
 * (smoothstep) rather than splined: a splined target overshoots and makes the
 * view wobble, which reads as a cheap handheld effect.
 *
 * A short hold is added before the first and after the last key, so the
 * opening frame and the final frame both sit still for a beat.
 */
export function buildCameraPath(chapters, timeline) {
  const keys = []
  chapters.forEach((chapter, index) => {
    for (const key of chapter.camera) {
      keys.push({ at: timeline.toGlobal(index, key.at), pos: key.pos, look: key.look, hold: key.hold })
    }
  })
  keys.sort((a, b) => a.at - b.at)

  const first = keys[0]
  const last = keys[keys.length - 1]
  if (first.at > 0) keys.unshift({ ...first, at: 0 })
  if (last.at < 1) keys.push({ ...last, at: 1 })

  const axis = (a, b, c, d, i, t) => catmullRom(a[i], b[i], c[i], d[i], t)

  return {
    keys,

    /** Writes into `outPos` / `outLook` (arrays of 3) — no allocation per frame. */
    sample(progress, outPos, outLook) {
      const p = clamp(progress)
      const i = findSegment(keys, p)
      const k1 = keys[i]
      const k2 = keys[i + 1]
      const k0 = keys[i - 1] ?? k1
      const k3 = keys[i + 2] ?? k2
      const span = k2.at - k1.at
      const t = span > 0 ? (p - k1.at) / span : 0

      // A hold (two keys with the same pose) stands perfectly still; the
      // spline alone would drift through it and swing back.
      if (k1.hold && k1.hold === k2.hold) {
        for (let a = 0; a < 3; a++) {
          outPos[a] = k1.pos[a]
          outLook[a] = k1.look[a]
        }
        return
      }

      for (let a = 0; a < 3; a++) {
        outPos[a] = axis(k0.pos, k1.pos, k2.pos, k3.pos, a, t)
        outLook[a] = k1.look[a] + (k2.look[a] - k1.look[a]) * smoothstep(t)
      }
    },
  }
}
