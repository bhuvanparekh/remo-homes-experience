import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { boxM } from '../geometry.js'

/**
 * Tiny building blocks for furniture. Positions are [x, y, z] with y measured
 * from the finished floor (the Interior group sits at floor height).
 */

export function B({ s, p, m, r = 0, cast = true }) {
  return <mesh geometry={boxM(s[0], s[1], s[2])} material={m} position={p} rotation-y={r} castShadow={cast} receiveShadow />
}

const rounded = new Map()
function roundedBox(w, h, d, radius) {
  const key = `${w}|${h}|${d}|${radius}`
  if (!rounded.has(key)) rounded.set(key, new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2) * 0.999))
  return rounded.get(key)
}

/** Rounded box — cushions, mattresses, upholstered pieces. */
export function RB({ s, p, m, radius = 0.05, r = 0, rx = 0 }) {
  return <mesh geometry={roundedBox(s[0], s[1], s[2], radius)} material={m} position={p} rotation={[rx, r, 0]} castShadow receiveShadow />
}

export function Cyl({ r, h, p, m, seg = 24, r2 }) {
  return (
    <mesh position={p} material={m} castShadow receiveShadow>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
    </mesh>
  )
}

/** A bed with upholstered headboard, mattress, duvet, throw and pillows. Head faces +x before `rot`. */
export function Bed({ m, x, z, rot = 0, width, length = 2.05, pillows = 2, throwMat }) {
  const L = length
  const W = width
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      {/* Base and headboard */}
      <RB s={[L, 0.28, W + 0.06]} p={[0, 0.17, 0]} m={m.linenGrey} radius={0.03} />
      <RB s={[0.1, 1.05, W + 0.16]} p={[L / 2 + 0.03, 0.52, 0]} m={m.linenSand} radius={0.04} />
      {/* Mattress, duvet, throw */}
      <RB s={[L - 0.06, 0.22, W - 0.04]} p={[0, 0.42, 0]} m={m.linen} radius={0.06} />
      <RB s={[L * 0.72, 0.06, W + 0.02]} p={[-L * 0.13, 0.53, 0]} m={m.linen} radius={0.03} />
      <RB s={[L * 0.3, 0.05, W + 0.06]} p={[-L * 0.3, 0.57, 0]} m={throwMat ?? m.linenSand} radius={0.025} />
      {/* Pillows along the headboard */}
      {Array.from({ length: pillows }, (_, i) => {
        const span = W - 0.25
        const pz = pillows === 1 ? 0 : -span / 2 + (span * i) / (pillows - 1)
        return <RB key={i} s={[0.32, 0.14, Math.min(0.62, W / pillows - 0.04)]} p={[L / 2 - 0.25, 0.62, pz]} m={m.linen} radius={0.06} rx={0} r={0} />
      })}
    </group>
  )
}

/** Nightstand with a small lamp. */
export function Nightstand({ m, x, z }) {
  return (
    <group position={[x, 0, z]}>
      <B s={[0.45, 0.5, 0.42]} p={[0, 0.25, 0]} m={m.oak} />
      <Cyl r={0.07} h={0.3} p={[0, 0.65, 0]} m={m.porcelain} />
      <Cyl r={0.15} r2={0.11} h={0.18} p={[0, 0.85, 0]} m={m.linen} />
    </group>
  )
}

/** Open hanging rail with clothes, shelf above. `along` = length on z. */
export function ClosetRail({ m, x, z0, z1, depth = 0.55, facing = 1 }) {
  const len = z1 - z0
  const n = Math.floor(len / 0.07)
  return (
    <group position={[x, 0, (z0 + z1) / 2]}>
      <B s={[depth, 0.03, len]} p={[0, 1.95, 0]} m={m.oak} />
      <B s={[depth, 0.03, len]} p={[0, 2.3, 0]} m={m.oak} />
      <Cyl r={0.012} h={len} p={[0, 1.88, 0]} m={m.blackSteel} seg={8} />
      {Array.from({ length: n }, (_, i) => (
        <B
          key={i}
          s={[depth * 0.85, 0.85 + ((i * 37) % 5) * 0.06, 0.035]}
          p={[facing * 0.02, 1.42 - ((i * 37) % 5) * 0.03, -len / 2 + 0.05 + i * 0.07]}
          m={m.clothes[(i * 7) % m.clothes.length]}
          cast={false}
        />
      ))}
    </group>
  )
}
