/**
 * Device capability detection, resolved once at boot into a quality tier.
 *
 * Every expensive decision in the app (pixel ratio, shadows, how many cloud
 * layers the descent draws, scene detail, whether labels get leader lines)
 * reads its answer from here rather than sniffing the device itself. One place
 * to tune, and the scene components stay ignorant of hardware.
 */

const TIERS = {
  high: {
    id: 'high',
    dpr: [1, 2],
    shadows: true,
    cloudLayers: 9,
    detail: 1,
    labelMode: 'leader',
    smoothScroll: true,
  },
  medium: {
    id: 'medium',
    dpr: [1, 1.5],
    shadows: true,
    cloudLayers: 6,
    detail: 0.7,
    labelMode: 'leader',
    smoothScroll: true,
  },
  low: {
    id: 'low',
    dpr: [1, 1.25],
    shadows: false,
    cloudLayers: 4,
    detail: 0.45,
    labelMode: 'stack',
    smoothScroll: false,
  },
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * Integrated GPUs (Intel UHD / Iris, basic Mali/Adreno) can run the journey,
 * but not at retina pixel density. The renderer string is the only reliable
 * tell; browsers that hide it are treated as capable.
 */
function isIntegratedGpu() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : ''
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return /Intel|UHD|Iris|Mali-G[0-5]|Adreno \(TM\) [0-5]|SwiftShader|llvmpipe/i.test(name)
  } catch {
    return false
  }
}

function detectTierId() {
  if (typeof window === 'undefined') return 'high'

  const width = window.innerWidth
  const coarse = window.matchMedia?.('(pointer: coarse)').matches === true
  const cores = navigator.hardwareConcurrency ?? 8
  const memory = navigator.deviceMemory ?? 8

  if (width < 900 || coarse) return 'low'
  if (cores <= 4 || memory <= 4 || width < 1280 || isIntegratedGpu()) return 'medium'
  return 'high'
}

/**
 * Resolve the tier for this device. Reduced-motion visitors keep the journey —
 * the camera only ever moves because *they* scrolled — but lose the scroll
 * smoothing and ambient drift they didn't ask for.
 */
export function resolveQuality() {
  const reduced = prefersReducedMotion()
  const tier = TIERS[detectTierId()]

  if (!reduced) return tier

  return { ...tier, smoothScroll: false, reducedMotion: true }
}

export const QUALITY = resolveQuality()
