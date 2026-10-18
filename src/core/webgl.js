/**
 * One-time WebGL availability probe.
 *
 * Corporate laptops with blocklisted drivers, hardened browsers and some
 * remote-desktop sessions have no WebGL at all. Showing a blank black rectangle
 * in a client meeting is a worse outcome than showing a good static hero, so
 * the app checks once and picks.
 */
let cached = null

export function supportsWebGL() {
  if (cached !== null) return cached

  try {
    const canvas = document.createElement('canvas')
    cached = Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    )
  } catch {
    cached = false
  }

  return cached
}
