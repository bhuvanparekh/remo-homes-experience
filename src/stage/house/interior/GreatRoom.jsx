import { useMaterials } from '../materials.js'
import { B, Cyl, RB } from './parts.jsx'

/**
 * Kitchen, dining and living — the open core ReMo's renders lead with:
 * taupe flat-panel cabinetry to the ceiling, white marble, open oak shelves,
 * an all-electric induction kitchen, a wood-veneer TV wall with an LED reveal,
 * and a tan sectional.
 */

const BACK = -3.845 // inner face of the north wall
const COUNTER = 0.9

function Kitchen() {
  const m = useMaterials()
  const depth = 0.65
  const zc = BACK + depth / 2
  return (
    <group>
      {/* Back run: base cabinets + marble top */}
      <B s={[3.28, 0.82, depth]} p={[-1.24, 0.47, zc]} m={m.taupe} />
      <B s={[3.28, 0.06, depth - 0.04]} p={[-1.24, 0.03, zc + 0.02]} m={m.skirt} />
      <B s={[3.3, 0.04, depth + 0.02]} p={[-1.24, COUNTER - 0.02, zc + 0.01]} m={m.marble} />
      <B s={[3.28, 0.55, 0.02]} p={[-1.24, COUNTER + 0.275, BACK + 0.01]} m={m.marble} cast={false} />
      {/* Cabinet door seams */}
      {[-2.4, -1.85, -1.3, -0.5, 0.0].map((x) => (
        <B key={x} s={[0.006, 0.78, 0.01]} p={[x, 0.47, BACK + depth + 0.002]} m={m.taupeDark} cast={false} />
      ))}
      {/* Induction cooktop */}
      <B s={[0.75, 0.008, 0.5]} p={[-0.92, COUNTER + 0.004, zc + 0.03]} m={m.screen} cast={false} />

      {/* Fridge and tall pantry */}
      <B s={[0.66, 1.9, 0.7]} p={[0.75, 0.95, BACK + 0.35]} m={m.steel} />
      <B s={[0.012, 1.86, 0.01]} p={[0.75, 0.95, BACK + 0.705]} m={m.blackSteel} cast={false} />
      <B s={[0.66, 0.73, 0.62]} p={[0.75, 2.27, BACK + 0.31]} m={m.taupe} />
      <B s={[0.6, 2.62, 0.65]} p={[1.42, 1.31, BACK + 0.325]} m={m.taupe} />

      {/* Upper cabinets to the ceiling with the built-in microwave */}
      <B s={[2.0, 1.12, 0.36]} p={[-0.6, 2.13, BACK + 0.18]} m={m.taupe} />
      <B s={[0.62, 0.36, 0.02]} p={[-0.92, 1.76, BACK + 0.365]} m={m.steel} />
      <B s={[0.44, 0.24, 0.01]} p={[-0.98, 1.76, BACK + 0.376]} m={m.screen} cast={false} />
      {/* Open oak shelves with a few pieces on them */}
      {[1.5, 1.86, 2.22].map((y) => (
        <B key={y} s={[1.2, 0.035, 0.27]} p={[-2.27, y, BACK + 0.135]} m={m.oak} />
      ))}
      <Cyl r={0.08} h={0.14} p={[-2.6, 1.59, BACK + 0.13]} m={m.porcelain} />
      <Cyl r={0.06} h={0.2} p={[-2.0, 1.97, BACK + 0.13]} m={m.porcelain} />
      <Cyl r={0.1} h={0.03} p={[-2.35, 2.25, BACK + 0.13]} m={m.oakDark} />

      {/* Sink run along the laundry wall */}
      <B s={[0.72, 0.82, 2.15]} p={[-2.5, 0.47, -2.115]} m={m.taupe} />
      <B s={[0.75, 0.04, 2.17]} p={[-2.5, COUNTER - 0.02, -2.115]} m={m.marble} />
      <B s={[0.42, 0.012, 0.6]} p={[-2.48, COUNTER + 0.002, -1.8]} m={m.blackSteel} cast={false} />
      <Cyl r={0.015} h={0.32} p={[-2.78, COUNTER + 0.16, -1.8]} m={m.blackSteel} seg={10} />
      <B s={[0.22, 0.02, 0.02]} p={[-2.68, COUNTER + 0.31, -1.8]} m={m.blackSteel} />

      {/* Waterfall marble island with two oak stools */}
      <B s={[1.25, 0.84, 0.84]} p={[-0.31, 0.44, -1.51]} m={m.taupe} />
      <B s={[1.4, 0.05, 0.94]} p={[-0.31, 0.895, -1.51]} m={m.marble} />
      <B s={[0.05, 0.87, 0.94]} p={[-1.0, 0.435, -1.51]} m={m.marble} />
      <B s={[0.05, 0.87, 0.94]} p={[0.375, 0.435, -1.51]} m={m.marble} />
      <Cyl r={0.12} h={0.05} p={[-0.6, 0.945, -1.6]} m={m.oakDark} />
      {[-0.62, -0.02].map((x) => (
        <group key={x} position={[x, 0, -0.72]}>
          <RB s={[0.4, 0.06, 0.38]} p={[0, 0.66, 0]} m={m.linenSand} radius={0.02} />
          {[[-0.16, -0.15], [0.16, -0.15], [-0.16, 0.15], [0.16, 0.15]].map(([lx, lz]) => (
            <B key={`${lx}${lz}`} s={[0.03, 0.64, 0.03]} p={[lx, 0.32, lz]} m={m.oak} />
          ))}
          <B s={[0.4, 0.06, 0.03]} p={[0, 0.9, 0.17]} m={m.oak} />
        </group>
      ))}
    </group>
  )
}

function Dining() {
  const m = useMaterials()
  const cx = 2.46
  const cz = -1.21
  return (
    <group>
      <B s={[2.2, 0.012, 2.0]} p={[cx, 0.006, cz]} m={m.rugDark} cast={false} />
      <Cyl r={0.56} h={0.04} p={[cx, 0.75, cz]} m={m.oakDark} seg={40} />
      <Cyl r={0.08} r2={0.1} h={0.72} p={[cx, 0.37, cz]} m={m.oakDark} />
      <Cyl r={0.3} h={0.03} p={[cx, 0.015, cz]} m={m.oakDark} />
      {[45, 135, 225, 315].map((deg) => {
        const a = (deg * Math.PI) / 180
        const x = cx + Math.cos(a) * 0.68
        const z = cz + Math.sin(a) * 0.68
        return (
          <group key={deg} position={[x, 0, z]} rotation-y={-a + Math.PI / 2}>
            <RB s={[0.48, 0.09, 0.46]} p={[0, 0.47, 0]} m={m.linen} radius={0.04} />
            <RB s={[0.5, 0.36, 0.08]} p={[0, 0.7, 0.21]} m={m.linen} radius={0.04} />
            {[[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]].map(([lx, lz]) => (
              <B key={`${lx}${lz}`} s={[0.03, 0.43, 0.03]} p={[lx, 0.215, lz]} m={m.blackSteel} />
            ))}
          </group>
        )
      })}
      {/* Vase of dried stems */}
      <Cyl r={0.06} r2={0.04} h={0.22} p={[cx, 0.88, cz]} m={m.porcelain} />
    </group>
  )
}

function Living() {
  const m = useMaterials()
  const wallX = -0.52 // face of the TV wall
  return (
    <group>
      {/* TV wall: tall taupe cabinets, oak veneer panel, LED reveal, floating console */}
      <B s={[0.42, 2.7, 0.55]} p={[wallX + 0.21, 1.35, 0.62]} m={m.taupe} />
      <B s={[0.42, 2.7, 0.55]} p={[wallX + 0.21, 1.35, 3.48]} m={m.taupe} />
      <B s={[0.04, 2.38, 2.31]} p={[wallX + 0.02, 1.19, 2.05]} m={m.oak} />
      <B s={[0.42, 0.3, 2.31]} p={[wallX + 0.21, 2.55, 2.05]} m={m.taupe} />
      <B s={[0.02, 0.012, 2.25]} p={[wallX + 0.05, 2.39, 2.05]} m={m.ledStrip} cast={false} />
      <B s={[0.42, 0.36, 2.31]} p={[wallX + 0.21, 0.4, 2.05]} m={m.taupe} />
      <B s={[0.05, 0.92, 1.62]} p={[wallX + 0.07, 1.42, 2.05]} m={m.screen} />

      {/* Rug, coffee table, sectional, accent chair */}
      <B s={[2.7, 0.012, 3.5]} p={[1.6, 0.006, 1.9]} m={m.rug} cast={false} />
      <mesh position={[1.42, 0.38, 1.95]} scale={[1, 1, 0.65]} material={m.marble} castShadow receiveShadow>
        <cylinderGeometry args={[0.52, 0.52, 0.06, 40]} />
      </mesh>
      <Cyl r={0.2} r2={0.24} h={0.35} p={[1.42, 0.175, 1.95]} m={m.marble} />

      {/* Sectional: long run facing the TV, return along the south */}
      <RB s={[0.86, 0.38, 3.34]} p={[2.42, 0.2, 2.12]} m={m.sofa} radius={0.05} />
      <RB s={[0.22, 0.48, 3.34]} p={[2.74, 0.6, 2.12]} m={m.sofa} radius={0.08} />
      <RB s={[0.86, 0.6, 0.2]} p={[2.42, 0.3, 0.45]} m={m.sofa} radius={0.07} />
      <RB s={[1.3, 0.38, 0.84]} p={[1.37, 0.2, 3.37]} m={m.sofa} radius={0.05} />
      <RB s={[1.3, 0.48, 0.22]} p={[1.37, 0.6, 3.68]} m={m.sofa} radius={0.08} />
      <RB s={[0.2, 0.6, 0.84]} p={[0.72, 0.3, 3.37]} m={m.sofa} radius={0.07} />
      {[0.95, 1.85, 2.75].map((z) => (
        <RB key={z} s={[0.62, 0.12, 0.86]} p={[2.36, 0.45, z]} m={m.sofa} radius={0.05} />
      ))}
      <RB s={[1.1, 0.12, 0.62]} p={[1.37, 0.45, 3.33]} m={m.sofa} radius={0.05} />
      <RB s={[0.14, 0.4, 0.42]} p={[2.6, 0.7, 0.85]} m={m.linen} radius={0.06} />
      <RB s={[0.42, 0.4, 0.14]} p={[1.0, 0.7, 3.55]} m={m.linenSand} radius={0.06} />

      <group position={[1.42, 0, 0.42]}>
        <RB s={[0.78, 0.4, 0.72]} p={[0, 0.2, 0]} m={m.sofa} radius={0.12} />
        <RB s={[0.78, 0.32, 0.18]} p={[0, 0.55, -0.27]} m={m.sofa} radius={0.08} />
      </group>

      {/* Plant in the corner by the front door */}
      <Cyl r={0.2} r2={0.17} h={0.42} p={[3.75, 0.21, 3.6]} m={m.porcelain} />
      {[0, 1, 2, 3, 4].map((i) => (
        <RB key={i} s={[0.28, 0.5, 0.06]} p={[3.75 + Math.cos(i * 1.3) * 0.1, 0.75 + i * 0.07, 3.6 + Math.sin(i * 1.3) * 0.1]} m={m.plant} radius={0.025} r={i * 1.3} />
      ))}

      {/* Built-in open shelving on the primary-suite wall */}
      {[-3.0, 2.3].map((z) => (
        <group key={z} position={[3.88, 0, z]}>
          <B s={[0.4, 2.2, 0.8]} p={[0, 1.1, 0]} m={m.taupe} />
          {[0.55, 1.1, 1.65].map((y) => (
            <B key={y} s={[0.36, 0.03, 0.72]} p={[-0.03, y, 0]} m={m.oak} />
          ))}
        </group>
      ))}
    </group>
  )
}

export function GreatRoom() {
  return (
    <group>
      <Kitchen />
      <Dining />
      <Living />
    </group>
  )
}
