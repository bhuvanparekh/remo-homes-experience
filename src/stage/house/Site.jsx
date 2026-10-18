import { useMemo } from 'react'
import { CanvasTexture } from 'three'
import { BOUNDS, HOUSE, SITE } from '../../config/floorplan.js'
import { boxM } from './geometry.js'
import { useMaterials } from './materials.js'

const { floorY } = HOUSE
const { x0, x1, z0, z1 } = BOUNDS

/* ---------------- Decks, steps, canopies ---------------- */

/** A board deck flush with the floor, with steps down to the gravel. */
function Deck({ deck }) {
  const m = useMaterials()
  const outward = deck.side === 'south' ? 1 : -1
  const wallZ = deck.side === 'south' ? z1 : z0
  const width = deck.x1 - deck.x0
  const cx = (deck.x0 + deck.x1) / 2
  const top = floorY - 0.03
  const rise = top / (deck.steps + 1)
  const tread = 0.32
  return (
    <group>
      <mesh
        geometry={boxM(width, 0.08, deck.depth)}
        material={m.deck}
        position={[cx, top - 0.04, wallZ + outward * (deck.depth / 2)]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={boxM(width - 0.1, top - 0.08, deck.depth - 0.1)}
        material={m.skirt}
        position={[cx, (top - 0.08) / 2, wallZ + outward * (deck.depth / 2)]}
      />
      {Array.from({ length: deck.steps }, (_, i) => {
        const y = top - rise * (i + 1)
        const z = wallZ + outward * (deck.depth + tread * (i + 0.5))
        return (
          <mesh key={i} geometry={boxM(width, y, tread)} material={m.deck} position={[cx, y / 2, z]} castShadow receiveShadow />
        )
      })}
    </group>
  )
}

function Canopy({ canopy }) {
  const m = useMaterials()
  const outward = canopy.side === 'south' ? 1 : -1
  const wallZ = canopy.side === 'south' ? z1 : z0
  const y = floorY + 2.62
  return (
    <mesh
      geometry={boxM(canopy.x1 - canopy.x0, 0.08, canopy.depth)}
      material={m.white}
      position={[(canopy.x0 + canopy.x1) / 2, y, wallZ + outward * (canopy.depth / 2)]}
      castShadow
      receiveShadow
    />
  )
}

/* ---------------- Ground ---------------- */

/**
 * Alpha mask for the lawn: solid over the lot, feathering to nothing over
 * the outer `edge` fraction so it melts into the aerial photo's cleared lot.
 */
function fadeTexture(edgeX, edgeY) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(256, 256)
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const u = Math.min(x, 255 - x) / 255
      const v = Math.min(y, 255 - y) / 255
      const k = Math.min(1, u / edgeX) * Math.min(1, v / edgeY)
      const a = Math.round(255 * k * k * (3 - 2 * k))
      const i = (y * 256 + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = a
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return new CanvasTexture(c)
}

/**
 * Lawn over the cleared lot, feathered into the aerial photo. `materialRef`
 * gets its material so the construction chapter can dissolve it in.
 */
export function Lawn({ materialRef }) {
  const m = useMaterials()
  const { w, d } = SITE.lot
  // The lot itself plus a feathered margin over the photo's own feather, so
  // the lawn sits inside the real lot outline seen from the air.
  const FEATHER = 2
  const LW = w + FEATHER * 2
  const LD = d + FEATHER * 2
  const lawn = useMemo(() => {
    // The plane has 0..1 UVs (the fade needs them), so the grass maps carry
    // the metre scaling in their own repeat.
    const mat = m.grass.clone()
    for (const key of ['map', 'normalMap']) {
      mat[key] = mat[key].clone()
      mat[key].repeat.set(LW / 2.5, LD / 2.5)
    }
    mat.alphaMap = fadeTexture((FEATHER / LW) * 1.6, (FEATHER / LD) * 1.6)
    mat.alphaHash = true
    return mat
  }, [m, LW, LD])
  if (materialRef) materialRef.current = lawn

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} material={lawn} receiveShadow>
      <planeGeometry args={[LW, LD]} />
    </mesh>
  )
}

/** Gravel band around the house. */
function Gravel() {
  const m = useMaterials()
  const band = SITE.gravelBand
  return <mesh geometry={boxM(x1 - x0 + band * 2, 0.04, z1 - z0 + band * 2)} material={m.gravel} position={[0, 0.05, 0]} receiveShadow />
}

/** Large concrete stepping stones from the front deck toward the street. */
function Path() {
  const m = useMaterials()
  const stones = []
  for (let i = 0; i < 9; i++) {
    const t = i / 8
    const x = 2.85 + t * t * 5.5
    const z = z1 + 2.35 + i * 0.95
    stones.push([x, z, -0.12 - t * 0.35])
  }
  return stones.map(([x, z, r]) => (
    <mesh key={`${x},${z}`} geometry={boxM(1.3, 0.06, 0.6)} material={m.paver} position={[x, 0.07, z]} rotation-y={r} receiveShadow castShadow />
  ))
}

/** Ground works laid after the modules are set: gravel, decks and steps, path. */
export function Hardscape() {
  return (
    <group>
      <Gravel />
      <Path />
      {SITE.decks.map((d) => (
        <Deck key={d.id} deck={d} />
      ))}
    </group>
  )
}

/** Entry canopies — fixed to the house, so they travel with their modules. */
export function Canopies() {
  return SITE.canopies.map((c) => <Canopy key={c.id} canopy={c} />)
}
