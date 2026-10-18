import { createContext, useContext, useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
} from 'three'

/**
 * Every surface of the SupReMo, matched to ReMo's renders: white fibre-cement
 * panels with black window surrounds outside; warm oak, taupe cabinetry,
 * white marble and pale stone tile inside.
 *
 * Photographic textures are Poly Haven CC0 (public/tex). The panel joints,
 * marble veining, bath tile and solar cells are drawn here on canvases —
 * none of the stock textures matched ReMo's look.
 *
 * All textures repeat in metres: geometry carries metre-scale UVs (see
 * geometry.js), so `repeat` is simply 1 / (metres one tile covers).
 */

const TEX = `${import.meta.env.BASE_URL}tex/`
const TEXTURE_FILES = ['floor', 'oak', 'deck', 'gravel', 'grass', 'linen', 'bark'].flatMap((n) => [
  `${TEX}${n}_diff.jpg`,
  `${TEX}${n}_nor.jpg`,
])

/* ---------- Canvas-drawn textures ---------- */

function canvas(size, draw) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  return t
}

function rng(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/** 2.44 m square of exterior panel: joints every 1.22 m, faint trowel noise. */
function panelTextures() {
  const draw = (ctx, size, joints) => {
    const r = rng(5)
    ctx.fillStyle = joints ? '#808080' : '#efeeea'
    ctx.fillRect(0, 0, size, size)
    if (!joints) {
      for (let i = 0; i < 9000; i++) {
        const v = 232 + r() * 14
        ctx.fillStyle = `rgba(${v},${v},${v - 2},0.25)`
        ctx.fillRect(r() * size, r() * size, 2, 2)
      }
    }
    const j = size / 2
    ctx.fillStyle = joints ? '#2a2a2a' : '#b5b4ae'
    for (const x of [0, j]) ctx.fillRect(x - 3, 0, 6, size)
  }
  const map = canvas(1024, (ctx, s) => draw(ctx, s, false))
  map.colorSpace = SRGBColorSpace
  const bump = canvas(512, (ctx, s) => draw(ctx, s, true))
  return { map, bump }
}

/** White Carrara-style marble: soft grey veins on warm white. */
function marbleTexture() {
  const t = canvas(1024, (ctx, size) => {
    const r = rng(17)
    ctx.fillStyle = '#f2f0ec'
    ctx.fillRect(0, 0, size, size)
    for (let v = 0; v < 14; v++) {
      let x = r() * size
      let y = r() * size
      const width = 0.6 + r() * 2.2
      ctx.strokeStyle = `rgba(120,118,115,${0.12 + r() * 0.3})`
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(x, y)
      const angle = 0.6 + r() * 0.4
      for (let s = 0; s < 60; s++) {
        x += Math.cos(angle) * 22 + (r() - 0.5) * 26
        y += Math.sin(angle) * 22 + (r() - 0.5) * 26
        ctx.lineTo(x % size, y % size)
        if (x > size || y > size) {
          ctx.stroke()
          x %= size
          y %= size
          ctx.beginPath()
          ctx.moveTo(x, y)
        }
      }
      ctx.stroke()
    }
  })
  t.colorSpace = SRGBColorSpace
  return t
}

/** 60 × 120 cm pale stone tile, as in ReMo's bathroom renders. Covers 1.2 m. */
function tileTexture() {
  const t = canvas(1024, (ctx, size) => {
    const r = rng(29)
    const tw = size / 2
    const th = size
    for (let col = 0; col < 2; col++) {
      const base = 196 + r() * 12
      ctx.fillStyle = `rgb(${base},${base - 1},${base - 4})`
      ctx.fillRect(col * tw, 0, tw, th)
      for (let i = 0; i < 2500; i++) {
        const v = base - 14 + r() * 28
        ctx.fillStyle = `rgba(${v},${v},${v - 3},0.35)`
        ctx.fillRect(col * tw + r() * tw, r() * th, 3, 3)
      }
    }
    ctx.fillStyle = '#9d9a95'
    ctx.fillRect(0, 0, size, 3)
    ctx.fillRect(0, 0, 3, size)
    ctx.fillRect(tw - 1.5, 0, 3, size)
  })
  t.colorSpace = SRGBColorSpace
  return t
}

/** Monocrystalline cell grid for the roof array. One texture per panel. */
function solarTexture() {
  const t = canvas(256, (ctx, size) => {
    ctx.fillStyle = '#c9ced4'
    ctx.fillRect(0, 0, size, size)
    const n = 6
    const cell = (size - 8) / n
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = '#172235'
        ctx.fillRect(4 + i * cell + 1, 4 + j * cell + 1, cell - 2, cell - 2)
        ctx.fillStyle = 'rgba(80,100,130,0.35)'
        ctx.fillRect(4 + i * cell + cell / 2 - 0.5, 4 + j * cell + 1, 1, cell - 2)
      }
    }
  })
  t.colorSpace = SRGBColorSpace
  return t
}

/* ---------- Material set ---------- */

/** Each material gets its own texture clones (shared image) so repeats don't collide. */
function textured(maps, name, metres, opts = {}) {
  const diff = maps[name][0].clone()
  const nor = maps[name][1].clone()
  for (const t of [diff, nor]) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(1 / metres, 1 / metres)
    t.anisotropy = 8
  }
  diff.colorSpace = SRGBColorSpace
  return new MeshStandardMaterial({ map: diff, normalMap: nor, roughness: 0.8, ...opts })
}

function buildMaterials(maps) {
  const panel = panelTextures()
  for (const t of [panel.map, panel.bump]) t.repeat.set(1 / 2.44, 1 / 2.44)
  const marbleMap = marbleTexture()
  marbleMap.repeat.set(1 / 1.6, 1 / 1.6)
  const tileMap = tileTexture()
  tileMap.repeat.set(1 / 1.2, 1 / 1.2)

  const m = {
    // Envelope
    panel: new MeshStandardMaterial({ map: panel.map, bumpMap: panel.bump, bumpScale: 0.6, roughness: 0.78 }),
    plaster: new MeshStandardMaterial({ color: '#f3f0eb', roughness: 0.92 }),
    ceiling: new MeshStandardMaterial({ color: '#f6f4f0', roughness: 0.95 }),
    roof: new MeshStandardMaterial({ color: '#e9e8e4', roughness: 0.9 }),
    // Own material (same look as `white`) so the roof can lift off as one lid.
    fascia: new MeshStandardMaterial({ color: '#f5f3ef', roughness: 0.6 }),
    frame: new MeshStandardMaterial({ color: '#1f2123', roughness: 0.45, metalness: 0.35 }),
    glass: new MeshPhysicalMaterial({
      color: '#b8c6cc',
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.18,
      envMapIntensity: 1.6,
      depthWrite: false,
      side: DoubleSide,
    }),
    skirt: new MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.9 }),
    solar: new MeshStandardMaterial({ map: solarTexture(), roughness: 0.25, metalness: 0.4 }),
    solarFrame: new MeshStandardMaterial({ color: '#b9bec4', roughness: 0.35, metalness: 0.8 }),

    // Floors & surfaces
    floor: textured(maps, 'floor', 2.0, { roughness: 0.55 }),
    tile: new MeshStandardMaterial({ map: tileMap, color: '#d4cdc4', roughness: 0.35 }),
    marble: new MeshStandardMaterial({ map: marbleMap, roughness: 0.18 }),
    oak: textured(maps, 'oak', 1.2, { roughness: 0.6 }),
    oakDark: textured(maps, 'oak', 1.2, { roughness: 0.6, color: new Color('#8a6a52') }),
    taupe: new MeshStandardMaterial({ color: '#b39d8e', roughness: 0.55 }),
    taupeDark: new MeshStandardMaterial({ color: '#8f7869', roughness: 0.6 }),
    white: new MeshStandardMaterial({ color: '#f5f3ef', roughness: 0.6 }),
    porcelain: new MeshStandardMaterial({ color: '#fbfbf9', roughness: 0.12 }),
    steel: new MeshStandardMaterial({ color: '#c3c6c8', roughness: 0.42, metalness: 0.9, envMapIntensity: 0.45 }),
    blackSteel: new MeshStandardMaterial({ color: '#2a2b2d', roughness: 0.35, metalness: 0.7 }),
    brass: new MeshStandardMaterial({ color: '#b08d57', roughness: 0.35, metalness: 1 }),
    screen: new MeshStandardMaterial({ color: '#0d0f12', roughness: 0.15, metalness: 0.2 }),
    mirror: new MeshStandardMaterial({ color: '#8e9497', roughness: 0.08, metalness: 1, envMapIntensity: 0.12 }),
    ledStrip: new MeshStandardMaterial({ color: '#000', emissive: '#ffd9a6', emissiveIntensity: 2.2 }),
    downlight: new MeshStandardMaterial({ color: '#000', emissive: '#fff1dc', emissiveIntensity: 3 }),

    // Soft furnishings
    linen: textured(maps, 'linen', 0.5, { color: new Color('#f1efea'), roughness: 0.95 }),
    linenGrey: textured(maps, 'linen', 0.5, { color: new Color('#9a9692'), roughness: 0.95 }),
    linenSand: textured(maps, 'linen', 0.5, { color: new Color('#cdb79a'), roughness: 0.95 }),
    sofa: textured(maps, 'linen', 0.35, { color: new Color('#97704f'), roughness: 0.85 }),
    rug: textured(maps, 'linen', 0.25, { color: new Color('#d8d2c8'), roughness: 1 }),
    rugDark: textured(maps, 'linen', 0.25, { color: new Color('#8f877c'), roughness: 1 }),
    plant: new MeshStandardMaterial({ color: '#56693f', roughness: 0.8 }),
    clothes: [
      new MeshStandardMaterial({ color: '#e9e4dc', roughness: 0.95 }),
      new MeshStandardMaterial({ color: '#3d4350', roughness: 0.95 }),
      new MeshStandardMaterial({ color: '#b9a48c', roughness: 0.95 }),
      new MeshStandardMaterial({ color: '#6f6a64', roughness: 0.95 }),
    ],

    // Site
    deck: textured(maps, 'deck', 1.6, { color: new Color('#a8927c'), roughness: 0.8 }),
    gravel: textured(maps, 'gravel', 1.4, { roughness: 1 }),
    grass: textured(maps, 'grass', 2.5, { roughness: 1, color: new Color('#a9c98a') }),
    paver: new MeshStandardMaterial({ color: '#c5c3bd', roughness: 0.85 }),
    bark: textured(maps, 'bark', 1.0, { roughness: 1 }),
    leaves: new MeshStandardMaterial({ color: '#4d6236', roughness: 0.9, flatShading: true }),
    shrub: new MeshStandardMaterial({ color: '#3f5a2e', roughness: 0.9, flatShading: true }),
  }
  return m
}

const MaterialsContext = createContext(null)

/** Loads the textures once and builds the shared material set. */
export function useBuildMaterials() {
  const textures = useLoader(TextureLoader, TEXTURE_FILES)
  const gl = useThree((s) => s.gl)
  return useMemo(() => {
    const maps = {}
    for (let i = 0; i < textures.length; i += 2) {
      const name = TEXTURE_FILES[i].split('/').pop().replace('_diff.jpg', '')
      maps[name] = [textures[i], textures[i + 1]]
    }
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy())
    for (const t of textures) t.anisotropy = aniso
    return buildMaterials(maps)
  }, [textures, gl])
}

export const MaterialsProvider = MaterialsContext.Provider

export function useMaterials() {
  const m = useContext(MaterialsContext)
  if (!m) throw new Error('useMaterials must be used inside <MaterialsProvider>')
  return m
}
