import { useMaterials } from '../materials.js'
import { B, Bed, ClosetRail, Cyl, Nightstand, RB } from './parts.jsx'

/**
 * Bedrooms, baths, closets, laundry and hall — laid out exactly where ReMo's
 * furnished plan puts them.
 */

const NORTH = -3.845 // inner face of the north wall

function Bedrooms() {
  const m = useMaterials()
  return (
    <group>
      {/* Bedroom 2 — twin beds, heads on the west wall */}
      <Bed m={m} x={-6.62} z={1.62} rot={Math.PI} width={1.0} length={2.0} pillows={1} />
      <Bed m={m} x={-6.62} z={3.21} rot={Math.PI} width={1.0} length={2.0} pillows={1} />
      <Nightstand m={m} x={-7.38} z={2.42} />
      <B s={[1.6, 0.012, 2.4]} p={[-6.3, 0.006, 2.42]} m={m.rug} cast={false} />

      {/* Bedroom 3 — queen, head on the TV wall */}
      <Bed m={m} x={-1.7} z={2.34} width={1.6} pillows={2} throwMat={m.linenGrey} />
      <Nightstand m={m} x={-0.92} z={1.22} />
      <Nightstand m={m} x={-0.92} z={3.46} />
      <B s={[2.2, 0.012, 2.6]} p={[-1.9, 0.006, 2.34]} m={m.rug} cast={false} />

      {/* Primary suite — king, wardrobe wall, bench */}
      <Bed m={m} x={6.56} z={2.34} width={1.95} length={2.1} pillows={3} />
      <Nightstand m={m} x={7.4} z={1.06} />
      <Nightstand m={m} x={7.4} z={3.62} />
      <B s={[2.6, 0.012, 2.8]} p={[6.3, 0.006, 2.34]} m={m.rugDark} cast={false} />
      <RB s={[0.42, 0.42, 1.3]} p={[5.15, 0.21, 2.34]} m={m.linenSand} radius={0.05} />
      <group position={[4.47, 0, 2.62]}>
        <B s={[0.6, 2.45, 2.6]} p={[0, 1.225, 0]} m={m.taupe} />
        <B s={[0.02, 2.2, 0.9]} p={[0.31, 1.25, 0]} m={m.oak} cast={false} />
        {[-0.85, 0.85].map((z) => (
          <B key={z} s={[0.012, 2.3, 0.006]} p={[0.305, 1.2, z * 0.5]} m={m.taupeDark} cast={false} />
        ))}
      </group>
    </group>
  )
}

function Closets() {
  const m = useMaterials()
  return (
    <group>
      {/* Shared closets off the kids' vestibule */}
      <ClosetRail m={m} x={-4.42} z0={1.3} z1={3.95} depth={0.5} />
      <ClosetRail m={m} x={-3.83} z0={1.3} z1={3.95} depth={0.5} facing={-1} />
      {/* Primary walk-in: rails both sides, ottoman in the middle */}
      <ClosetRail m={m} x={4.46} z0={-1.6} z1={-0.1} />
      <ClosetRail m={m} x={7.5} z0={-1.6} z1={-0.1} facing={-1} />
      <RB s={[0.9, 0.42, 0.5]} p={[5.95, 0.21, -0.85]} m={m.linenSand} radius={0.08} />
    </group>
  )
}

/** Wall-hung toilet facing +z before rotation. */
function Toilet({ m, x, z, rot = 0 }) {
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      <RB s={[0.38, 0.38, 0.55]} p={[0, 0.33, 0.1]} m={m.porcelain} radius={0.12} />
      <B s={[0.5, 0.75, 0.12]} p={[0, 0.85, -0.18]} m={m.white} />
      <B s={[0.2, 0.12, 0.01]} p={[0, 1.0, -0.115]} m={m.blackSteel} cast={false} />
    </group>
  )
}

function Baths() {
  const m = useMaterials()
  return (
    <group>
      {/* Primary bath, west to east: glass shower, open shelf tower,
          double floating vanity, toilet — as in ReMo's bath render. */}
      <B s={[1.0, 0.6, 0.55]} p={[6.6, 0.55, NORTH + 0.275]} m={m.taupe} />
      <B s={[1.02, 0.05, 0.57]} p={[6.6, 0.875, NORTH + 0.285]} m={m.porcelain} />
      {[6.36, 6.84].map((x) => (
        <group key={x}>
          <B s={[0.36, 0.01, 0.3]} p={[x, 0.9, NORTH + 0.3]} m={m.white} cast={false} />
          <Cyl r={0.012} h={0.26} p={[x, 1.03, NORTH + 0.07]} m={m.blackSteel} seg={8} />
          <B s={[0.012, 0.012, 0.16]} p={[x, 1.15, NORTH + 0.14]} m={m.blackSteel} />
          <B s={[0.42, 0.8, 0.02]} p={[x, 1.62, NORTH + 0.012]} m={m.mirror} cast={false} />
        </group>
      ))}
      <group position={[5.82, 0, NORTH + 0.2]}>
        <B s={[0.5, 2.3, 0.36]} p={[0, 1.15, 0]} m={m.taupe} />
        {[0.7, 1.15, 1.6].map((y) => (
          <B key={y} s={[0.46, 0.025, 0.32]} p={[0, y, 0.03]} m={m.oak} />
        ))}
      </group>
      {/* Shower: tiled walls on the two solid sides, glass on the open ones */}
      <B s={[0.02, 2.4, 1.48]} p={[4.16, 1.2, -2.55]} m={m.tile} cast={false} />
      <B s={[1.35, 2.4, 0.02]} p={[4.88, 1.2, -1.78]} m={m.tile} cast={false} />
      <B s={[1.36, 0.015, 1.48]} p={[4.88, 0.012, -2.55]} m={m.taupeDark} cast={false} />
      <mesh position={[5.55, 1.05, -2.55]} material={m.glass} renderOrder={2}>
        <boxGeometry args={[0.012, 2.0, 1.46]} />
      </mesh>
      <B s={[0.02, 2.0, 0.02]} p={[5.55, 1.05, -3.28]} m={m.blackSteel} />
      <Cyl r={0.11} h={0.012} p={[4.75, 2.15, -2.55]} m={m.blackSteel} />
      <Toilet m={m} x={7.46} z={NORTH + 0.3} />

      {/* Bath 2 — tub along the west wall, toilet, compact vanity */}
      <B s={[1.05, 0.58, 1.85]} p={[-7.12, 0.29, -2.9]} m={m.porcelain} />
      <B s={[0.85, 0.02, 1.62]} p={[-7.12, 0.585, -2.9]} m={m.white} cast={false} />
      <B s={[0.02, 2.2, 1.85]} p={[-7.63, 1.4, -2.9]} m={m.tile} cast={false} />
      <mesh position={[-6.6, 1.35, -2.4]} material={m.glass} renderOrder={2}>
        <boxGeometry args={[0.012, 1.5, 0.85]} />
      </mesh>
      <Toilet m={m} x={-6.2} z={NORTH + 0.3} />
      <B s={[0.62, 0.55, 0.48]} p={[-5.55, 0.55, NORTH + 0.24]} m={m.taupe} />
      <B s={[0.64, 0.04, 0.5]} p={[-5.55, 0.845, NORTH + 0.25]} m={m.porcelain} />
      <B s={[0.5, 0.75, 0.02]} p={[-5.55, 1.55, NORTH + 0.012]} m={m.mirror} cast={false} />
    </group>
  )
}

function Utility() {
  const m = useMaterials()
  return (
    <group>
      {/* Laundry: front-loaders under an oak counter, water heater */}
      {[-4.78, -4.14].map((x) => (
        <group key={x} position={[x, 0, NORTH + 0.32]}>
          <B s={[0.6, 0.85, 0.6]} p={[0, 0.425, 0]} m={m.white} />
          <Cyl r={0.19} h={0.02} p={[0, 0.45, 0.3]} m={m.screen} />
        </group>
      ))}
      <B s={[1.4, 0.04, 0.64]} p={[-4.46, 0.9, NORTH + 0.32]} m={m.oak} />
      <B s={[1.4, 0.7, 0.35]} p={[-4.46, 1.95, NORTH + 0.175]} m={m.taupe} />
      <Cyl r={0.28} h={1.5} p={[-3.62, 0.75, -2.45]} m={m.white} />

      {/* Hall: linen cabinet, storage wall, reading nook by the west window */}
      <B s={[1.42, 2.2, 0.38]} p={[-7.05, 1.1, -1.63]} m={m.taupe} />
      <B s={[2.12, 2.3, 0.6]} p={[-4.0, 1.15, -1.52]} m={m.taupe} />
      {[-4.7, -4.0, -3.3].map((x) => (
        <B key={x} s={[0.006, 2.2, 0.01]} p={[x + 0.35, 1.15, -1.215]} m={m.taupeDark} cast={false} />
      ))}
      <group position={[-7.2, 0, -0.85]} rotation-y={Math.PI / 2.4}>
        <RB s={[0.78, 0.42, 0.8]} p={[0, 0.21, 0]} m={m.linen} radius={0.14} />
        <RB s={[0.78, 0.45, 0.2]} p={[0, 0.6, -0.3]} m={m.linen} radius={0.1} />
      </group>
      <Cyl r={0.22} h={0.02} p={[-6.55, 0.5, -0.45]} m={m.oak} />
      <Cyl r={0.02} h={0.5} p={[-6.55, 0.25, -0.45]} m={m.blackSteel} seg={8} />
      <Cyl r={0.015} h={1.55} p={[-7.55, 0.78, -0.2]} m={m.blackSteel} seg={8} />
      <Cyl r={0.18} r2={0.12} h={0.25} p={[-7.55, 1.6, -0.2]} m={m.linen} />
    </group>
  )
}

export function Private() {
  return (
    <group>
      <Bedrooms />
      <Closets />
      <Baths />
      <Utility />
    </group>
  )
}
