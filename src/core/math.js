/**
 * Pure scalar maths used by the tour engine.
 *
 * SRP: this module knows nothing about React, three.js, scrolling or houses.
 * Everything here is a plain function of its arguments, which is what makes
 * the camera path and label timing reasoning easy to verify by hand.
 */

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

export const lerp = (a, b, t) => a + (b - a) * t

/** Inverse lerp: where does `value` sit between a and b, as 0..1? */
export const invLerp = (a, b, value) => (a === b ? 0 : (value - a) / (b - a))

/** Inverse lerp, clamped to 0..1. The workhorse for "progress within a window". */
export const range = (value, from, to) => clamp(invLerp(from, to, value))

/** Classic smoothstep easing. Zero velocity at both ends. */
export const smoothstep = (t) => {
  const x = clamp(t)
  return x * x * (3 - 2 * x)
}

/** Ken Perlin's smootherstep. Zero velocity *and* acceleration at the ends. */
export const smootherstep = (t) => {
  const x = clamp(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * Frame-rate independent damping.
 *
 * A naive `current += (target - current) * 0.1` moves faster on a 144Hz screen
 * than on a 60Hz one. The exponential form converges at the same wall-clock
 * rate no matter the frame rate, which is why the camera feels identical on
 * every machine.
 */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

/**
 * Uniform Catmull-Rom spline through p1 and p2, shaped by its neighbours.
 * Gives the camera an organic curved path instead of robotic straight legs.
 */
export const catmullRom = (p0, p1, p2, p3, t) => {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

/**
 * Fade-in / hold / fade-out envelope for a value crossing a [from, to] window.
 * Used for label and caption opacity so nothing ever pops on or off.
 */
export const envelope = (t, from, to, fade = 0.06) => {
  if (t <= from || t >= to) return 0
  const span = to - from
  const edge = Math.min(fade, span / 2)
  const rising = range(t, from, from + edge)
  const falling = range(t, to, to - edge)
  return smoothstep(Math.min(rising, falling))
}

/** Binary search for the last index whose `key` is <= value. Never returns the final index. */
export const findSegment = (items, value, key = 'at') => {
  let lo = 0
  let hi = items.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (items[mid][key] <= value) lo = mid
    else hi = mid
  }
  return lo
}
