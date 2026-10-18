import {
  Color,
  Data3DTexture,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  RedFormat,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
} from 'three'
import GEO from '../../config/geo.manifest.json'
import { smoothstep } from '../../core/math.js'

/**
 * Real-world data for the descent, produced by scripts/build_assets.py:
 * NAIP aerial photos, 3DEP terrain and a Poly Haven sky. This module turns
 * the files into three.js objects and owns the conventions that tie them
 * together (metres, lot at the origin, +X east, -Z north).
 */
export { GEO }

const base = import.meta.env.BASE_URL
export const geoUrl = (file) => `${base}geo/${file}`
export const envUrl = (file) => `${base}env/${file}`

export const LAYER_URLS = ['near', 'mid', 'far'].map((k) => geoUrl(GEO.layers[k].image))
export const SKY_URL = envUrl(GEO.sky.image)

/* ---------- Sun & sky colours ---------- */

/**
 * Rotate the sky photo so its sun rises in the east-north-east: the opening
 * shot looks north at the San Gabriel Mountains and the low sun rims every
 * cloud from the right.
 */
export const SKY_YAW = (40 * Math.PI) / 180

const sunAzimuth = (GEO.sky.sunU - 0.5) * Math.PI * 2 + SKY_YAW
const sunElevation = (0.5 - GEO.sky.sunV) * Math.PI

export const SUN_DIR = new Vector3(
  Math.sin(sunAzimuth) * Math.cos(sunElevation),
  Math.sin(sunElevation),
  -Math.cos(sunAzimuth) * Math.cos(sunElevation),
).normalize()

const srgb = ([r, g, b]) => new Color().setRGB(r, g, b, SRGBColorSpace)
export const SKY_COLORS = {
  zenith: srgb(GEO.sky.zenith),
  upper: srgb(GEO.sky.upper),
  horizon: srgb(GEO.sky.horizon),
}

/* ---------- Binary data ---------- */

const cache = new Map()
const loadBinary = (url) => {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${url}`)
        return r.arrayBuffer()
      }),
    )
  }
  return cache.get(url)
}

/** The lot is graded flat; real relief fades in beyond this radius. */
const FLAT_INNER = 350
const FLAT_OUTER = 1500

/**
 * Terrain heights (metres above the lot) on a square grid, row 0 = north.
 * Heights near the lot are eased to zero so the aerial photo, the building
 * pad and the house all agree on "ground".
 */
export const terrainPromise = loadBinary(geoUrl(GEO.terrain.file)).then((buf) => {
  const raw = new Int16Array(buf)
  const { grid, half } = GEO.terrain
  const heights = new Float32Array(raw.length)
  const step = (half * 2) / (grid - 1)
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const x = -half + c * step
      const z = -half + r * step
      const i = r * grid + c
      heights[i] = raw[i] * smoothstep((Math.hypot(x, z) - FLAT_INNER) / (FLAT_OUTER - FLAT_INNER))
    }
  }

  // Same field as a half-float texture, so the cloud shader can stop rays at
  // mountainsides instead of drawing cloud over a peak that's in front of it.
  const half16 = new Uint16Array(heights.length)
  for (let i = 0; i < heights.length; i++) half16[i] = DataUtils.toHalfFloat(heights[i])
  const texture = new DataTexture(half16, grid, grid, RedFormat, HalfFloatType)
  texture.magFilter = texture.minFilter = LinearFilter
  texture.needsUpdate = true

  return { heights, grid, half, texture }
})

/** 64³ tileable Perlin-Worley (R) + three Worley octaves (GBA) for cloud detail. */
export const noisePromise = loadBinary(geoUrl(GEO.noise.file)).then((buf) => {
  const n = GEO.noise.size
  const tex = new Data3DTexture(new Uint8Array(buf), n, n, n)
  tex.format = RGBAFormat
  tex.type = UnsignedByteType
  tex.magFilter = tex.minFilter = LinearFilter
  tex.wrapS = tex.wrapT = tex.wrapR = RepeatWrapping
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
})
