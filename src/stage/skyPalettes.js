import { Color } from 'three'
import { CHAPTERS } from '../config/chapters.config.js'
import { range, smoothstep } from '../core/math.js'

/**
 * Time-of-day grading. The sky itself is a real photo (SkyDome); these
 * palettes only *tint* it and set the light falling on the house, so the
 * journey still runs dawn → day → golden hour → dusk.
 *
 * `fog` is [near, far] in metres for scene objects (the house); the terrain
 * and clouds carry their own physically-shaped haze.
 */
const RAW = {
  dawn: {
    skyTint: '#ffffff', groundTint: '#f3e6dc', ground: '#8d8a84',
    sun: '#ffd6ad', sunIntensity: 2.2, ambient: '#b9c6dc', ambientIntensity: 1.1,
    fog: [900, 6000],
  },
  morning: {
    skyTint: '#ffffff', groundTint: '#ffffff', ground: '#8c8a79',
    sun: '#fff1dc', sunIntensity: 2.6, ambient: '#c3d3e6', ambientIntensity: 1.15,
    fog: [400, 4000],
  },
  day: {
    skyTint: '#ffffff', groundTint: '#ffffff', ground: '#8a8a78',
    sun: '#ffffff', sunIntensity: 2.8, ambient: '#c9d9ea', ambientIntensity: 1.2,
    fog: [300, 3000],
  },
  golden: {
    skyTint: '#ffe9cf', groundTint: '#ffe2c2', ground: '#7d705f',
    sun: '#ffc382', sunIntensity: 2.4, ambient: '#d9b99a', ambientIntensity: 1.0,
    fog: [250, 2400],
  },
  interior: {
    skyTint: '#fff3e6', groundTint: '#fff0e0', ground: '#8a7f70',
    sun: '#ffe3c2', sunIntensity: 1.8, ambient: '#f3e4d2', ambientIntensity: 2.6,
    fog: [200, 2000],
  },
  dusk: {
    skyTint: '#b9898c', groundTint: '#9a7f80', ground: '#4a4250',
    sun: '#ff9563', sunIntensity: 0.95, ambient: '#8a82ab', ambientIntensity: 0.68,
    fog: [250, 2400],
  },
}

const COLOR_KEYS = ['skyTint', 'groundTint', 'ground', 'sun', 'ambient']

const PALETTES = Object.fromEntries(
  Object.entries(RAW).map(([id, p]) => [
    id,
    { ...p, ...Object.fromEntries(COLOR_KEYS.map((k) => [k, new Color(p[k])])) },
  ]),
)

/** Reused output — the grade is mixed every frame, so never allocate. */
const mixed = {
  ...Object.fromEntries(COLOR_KEYS.map((k) => [k, new Color()])),
  sunIntensity: 0,
  ambientIntensity: 0,
  fogNear: 0,
  fogFar: 0,
}

const BLEND_FROM = 0.75

/**
 * Each chapter holds its own palette and blends into the next chapter's over
 * its final quarter, so time-of-day shifts happen *during* camera moves.
 */
export function mixSky(index, t) {
  const a = PALETTES[CHAPTERS[index].sky]
  const b = PALETTES[CHAPTERS[Math.min(index + 1, CHAPTERS.length - 1)].sky]
  const k = smoothstep(range(t, BLEND_FROM, 1))

  for (const key of COLOR_KEYS) mixed[key].lerpColors(a[key], b[key], k)
  mixed.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * k
  mixed.ambientIntensity = a.ambientIntensity + (b.ambientIntensity - a.ambientIntensity) * k
  mixed.fogNear = a.fog[0] + (b.fog[0] - a.fog[0]) * k
  mixed.fogFar = a.fog[1] + (b.fog[1] - a.fog[1]) * k
  return mixed
}
