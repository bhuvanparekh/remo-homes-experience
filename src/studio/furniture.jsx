import { B, Bed, ClosetRail, Cyl, Nightstand, RB } from '../stage/house/interior/parts.jsx'
import { DEPTH } from './generator.js'

/**
 * Furniture for any generated room, in the spirit of the SupReMo's interior
 * (stage/house/interior): taupe cabinetry, white marble, oak, linen.
 *
 * Every room is furnished in its own frame: u runs along an "anchor" wall,
 * v runs from that wall into the room (0 … Dp). The anchor is the wall the
 * room's main piece belongs on — the bed head, the TV, the kitchen run — and
 * the door is located in the same frame, so pieces stay out of its way.
 */

const INT = 0.06 // half an interior wall
const EXT = 0.2 // exterior wall
const COUNTER = 0.9

/** The room's clear floor, inside its walls. */
function inner(room, L) {
  const on = (a, b) => Math.abs(a - b) < 0.01
  return {
    x0: room.x0 + (on(room.x0, -L / 2) ? EXT : INT),
    x1: room.x1 - (on(room.x1, L / 2) ? EXT : INT),
    z0: room.z0 + (on(room.z0, -DEPTH / 2) ? EXT : INT),
    z1: room.z1 - (on(room.z1, DEPTH / 2) ? EXT : INT),
    front: on(room.z1, DEPTH / 2),
    back: on(room.z0, -DEPTH / 2),
    west: on(room.x0, -L / 2),
    east: on(room.x1, L / 2),
  }
}

/** Placement of the room's frame for a given anchor wall. */
function frame(r, anchor) {
  const cx = (r.x0 + r.x1) / 2
  const cz = (r.z0 + r.z1) / 2
  switch (anchor) {
    case 'front':
      return { pos: [cx, r.z1], rot: Math.PI, W: r.x1 - r.x0, Dp: r.z1 - r.z0, toLocal: (x, z) => [cx - x, r.z1 - z] }
    case 'west':
      return { pos: [r.x0, cz], rot: Math.PI / 2, W: r.z1 - r.z0, Dp: r.x1 - r.x0, toLocal: (x, z) => [cz - z, x - r.x0] }
    case 'east':
      return { pos: [r.x1, cz], rot: -Math.PI / 2, W: r.z1 - r.z0, Dp: r.x1 - r.x0, toLocal: (x, z) => [z - cz, r.x1 - x] }
    default:
      return { pos: [cx, r.z0], rot: 0, W: r.x1 - r.x0, Dp: r.z1 - r.z0, toLocal: (x, z) => [x - cx, z - r.z0] }
  }
}

/** The room's door in its frame: which wall it's on and where. */
function localDoor(door, f) {
  if (!door) return { side: 'none', u: 0, v: f.Dp, width: 0 }
  const [x, z] = door.edge.axis === 'x' ? [door.at, door.edge.at] : [door.edge.at, door.at]
  const [u, v] = f.toLocal(x, z)
  let side = u < 0 ? 'left' : 'right'
  if (v < 0.35) side = 'anchor'
  else if (v > f.Dp - 0.35) side = 'opposite'
  else if (Math.abs(Math.abs(u) - f.W / 2) > 0.35) side = 'opposite'
  return { side, u, v, width: door.width }
}

/** Which wall a room's furniture hangs off. */
function anchorFor(room, r, door) {
  switch (room.kind) {
    case 'living':
      return 'west'
    case 'kitchen':
    case 'dining':
    case 'laundry':
    case 'storage':
    case 'closet':
      return r.back ? 'back' : 'front'
    case 'office':
      return r.front ? 'front' : 'back'
    case 'bath':
    case 'ensuite':
      return r.back ? 'back' : r.front ? 'front' : r.west ? 'west' : 'east'
    case 'bedroom':
    case 'primary': {
      // Bed head on the side wall farthest from the door.
      if (!door) return 'west'
      const dx = door.edge.axis === 'x' ? door.at : door.edge.at
      return Math.abs(dx - r.x0) > Math.abs(dx - r.x1) ? 'west' : 'east'
    }
    default:
      return 'back'
  }
}

/* ---------- small pieces ---------- */

/** Wall-hung toilet facing +v. */
function Toilet({ m, u, v, rot = 0 }) {
  return (
    <group position={[u, 0, v]} rotation-y={rot}>
      <RB s={[0.38, 0.38, 0.55]} p={[0, 0.33, 0.1]} m={m.porcelain} radius={0.12} />
      <B s={[0.5, 0.75, 0.12]} p={[0, 0.85, -0.18]} m={m.white} />
    </group>
  )
}

/** Floating vanity with basin(s) and mirror, against a side wall at u = side·W/2. */
function Vanity({ m, side, W, v, length = 0.75, basins = 1 }) {
  const u = side * (W / 2 - 0.25)
  return (
    <group>
      <B s={[0.5, 0.5, length]} p={[u, 0.6, v]} m={m.taupe} />
      <B s={[0.52, 0.04, length + 0.02]} p={[u, 0.87, v]} m={m.porcelain} />
      {Array.from({ length: basins }, (_, i) => {
        const bv = basins === 1 ? v : v + (i - 0.5) * (length / 2)
        return (
          <group key={i}>
            <B s={[0.3, 0.012, 0.36]} p={[u - side * 0.02, 0.895, bv]} m={m.white} cast={false} />
            <B s={[0.02, 0.8, 0.46]} p={[side * (W / 2 - 0.012), 1.62, bv]} m={m.mirror} cast={false} />
          </group>
        )
      })}
    </group>
  )
}

function Plant({ m, u, v, scale = 1 }) {
  return (
    <group position={[u, 0, v]} scale={scale}>
      <Cyl r={0.2} r2={0.17} h={0.42} p={[0, 0.21, 0]} m={m.porcelain} />
      {[0, 1, 2, 3, 4].map((i) => (
        <RB key={i} s={[0.28, 0.5, 0.06]} p={[Math.cos(i * 1.3) * 0.1, 0.75 + i * 0.07, Math.sin(i * 1.3) * 0.1]} m={m.plant} radius={0.025} r={i * 1.3} />
      ))}
    </group>
  )
}

/* ---------- rooms ---------- */

function Bedroom({ m, W, Dp, door, primary }) {
  const bedW = primary ? 1.95 : 1.55
  const bedL = primary ? 2.1 : 2.03
  const side = door.u >= 0 ? 1 : -1 // the side wall nearer the door
  const nsU = bedW / 2 + 0.3
  const fitsNight = W / 2 - nsU > 0.24
  // Wardrobe along the door-side wall, up to the door.
  const wardEnd = door.side === 'opposite' || door.side === 'none' ? Dp - 1.0 : door.v - door.width / 2 - 0.15
  const wardLen = Math.min(2.2, wardEnd - 0.1)
  const wardU = side * (W / 2 - 0.3)
  const hasWard = wardLen > 1.0 && W / 2 - 0.6 > (fitsNight ? nsU + 0.24 : bedW / 2 + 0.05)

  return (
    <group>
      <Bed m={m} x={0} z={bedL / 2 + 0.1} rot={Math.PI / 2} width={bedW} length={bedL} pillows={primary ? 3 : 2} throwMat={primary ? undefined : m.linenGrey} />
      {fitsNight && [-1, 1].map((s) => <Nightstand key={s} m={m} x={s * nsU} z={0.24} />)}
      <B s={[bedW + 1.0, 0.012, bedL + 0.7]} p={[0, 0.006, bedL / 2 + 0.45]} m={primary ? m.rugDark : m.rug} cast={false} />
      {hasWard && (
        <group>
          <B s={[0.6, 2.4, wardLen]} p={[wardU, 1.2, 0.1 + wardLen / 2]} m={m.taupe} />
          <B s={[0.01, 2.2, 0.006]} p={[wardU - side * 0.305, 1.2, 0.1 + wardLen / 2]} m={m.taupeDark} cast={false} />
        </group>
      )}
      {primary && Dp - (bedL + 0.1) > 1.0 && <RB s={[1.3, 0.42, 0.42]} p={[0, 0.21, bedL + 0.42]} m={m.linenSand} radius={0.05} />}
      {primary && Dp > 3.2 && (
        <group position={[-side * (W / 2 - 0.55), 0, Dp - 0.6]} rotation-y={Math.PI + side * 0.5}>
          <RB s={[0.78, 0.4, 0.72]} p={[0, 0.2, 0]} m={m.sofa} radius={0.12} />
          <RB s={[0.78, 0.32, 0.18]} p={[0, 0.55, -0.27]} m={m.sofa} radius={0.08} />
        </group>
      )}
    </group>
  )
}

function Office({ m, W, Dp, door }) {
  const side = door.u >= 0 ? -1 : 1 // shelves on the wall away from the door
  return (
    <group>
      {/* Desk under the window, chair, monitor */}
      <B s={[1.4, 0.04, 0.68]} p={[0, 0.74, 0.38]} m={m.oak} />
      {[-0.66, 0.66].map((u) => (
        <B key={u} s={[0.04, 0.72, 0.62]} p={[u, 0.36, 0.38]} m={m.blackSteel} />
      ))}
      <B s={[0.62, 0.36, 0.03]} p={[0, 1.06, 0.18]} m={m.screen} />
      <B s={[0.06, 0.18, 0.06]} p={[0, 0.85, 0.2]} m={m.blackSteel} />
      <group position={[0, 0, 1.05]}>
        <RB s={[0.5, 0.08, 0.48]} p={[0, 0.48, 0]} m={m.linenGrey} radius={0.04} />
        <RB s={[0.48, 0.5, 0.08]} p={[0, 0.8, 0.22]} m={m.linenGrey} radius={0.04} />
        <Cyl r={0.03} h={0.42} p={[0, 0.22, 0]} m={m.blackSteel} seg={8} />
      </group>
      {/* Bookshelf on a side wall */}
      {Dp > 2.4 && (
        <group position={[side * (W / 2 - 0.19), 0, Math.min(Dp - 0.75, 1.9)]}>
          <B s={[0.36, 2.1, 1.1]} p={[0, 1.05, 0]} m={m.taupe} />
          {[0.45, 0.85, 1.25, 1.65].map((y) => (
            <B key={y} s={[0.3, 0.03, 1.02]} p={[-side * 0.03, y, 0]} m={m.oak} />
          ))}
        </group>
      )}
      <B s={[1.6, 0.012, 1.4]} p={[0, 0.006, 1.0]} m={m.rug} cast={false} />
      {W > 2.4 && <Plant m={m} u={-side * (W / 2 - 0.3)} v={0.3} scale={0.85} />}
    </group>
  )
}

function Living({ m, W, Dp }) {
  const narrow = Dp < 6
  const sofaLen = narrow ? 2.2 : 2.6
  const su = narrow ? 0.3 : 0
  const sv = Math.min(3.3, Dp - 1.4)
  const tvLen = Math.min(2.6, W - 0.7)
  return (
    <group>
      {/* TV wall: tall cabinets, oak panel, LED reveal, floating console */}
      <B s={[tvLen, 2.36, 0.04]} p={[0, 1.18, 0.02]} m={m.oak} />
      <B s={[tvLen, 0.36, 0.42]} p={[0, 0.4, 0.21]} m={m.taupe} />
      <B s={[1.6, 0.92, 0.05]} p={[0, 1.42, 0.07]} m={m.screen} />
      <B s={[tvLen - 0.06, 0.012, 0.02]} p={[0, 2.39, 0.05]} m={m.ledStrip} cast={false} />
      {W - tvLen > 1.1 &&
        [-1, 1].map((s) => <B key={s} s={[0.5, 2.7, 0.42]} p={[s * (tvLen / 2 + 0.25), 1.35, 0.21]} m={m.taupe} />)}

      {/* Rug, coffee table */}
      <B s={[3.0, 0.012, sv + 0.2]} p={[su, 0.006, (sv + 0.6) / 2 + 0.3]} m={m.rug} cast={false} />
      <mesh position={[su, 0.38, sv - 1.2]} scale={[1, 1, 0.65]} material={m.marble} castShadow receiveShadow>
        <cylinderGeometry args={[0.52, 0.52, 0.06, 40]} />
      </mesh>
      <Cyl r={0.2} r2={0.24} h={0.35} p={[su, 0.175, sv - 1.2]} m={m.marble} />

      {/* Sectional facing the TV, chaise toward the kitchen */}
      <group position={[su, 0, sv]}>
        <RB s={[sofaLen, 0.38, 0.9]} p={[0, 0.2, 0]} m={m.sofa} radius={0.05} />
        <RB s={[sofaLen, 0.48, 0.22]} p={[0, 0.6, 0.34]} m={m.sofa} radius={0.08} />
        {[-1, 1].map((s) => (
          <RB key={s} s={[0.2, 0.6, 0.9]} p={[s * (sofaLen / 2 - 0.1), 0.3, 0]} m={m.sofa} radius={0.07} />
        ))}
        {[-0.62, 0, 0.62].map((u) => (
          <RB key={u} s={[0.6 * (sofaLen / 2.6), 0.12, 0.62]} p={[u * (sofaLen / 2.6), 0.45, -0.06]} m={m.sofa} radius={0.05} />
        ))}
        <RB s={[0.84, 0.38, 0.95]} p={[sofaLen / 2 - 0.52, 0.2, -0.88]} m={m.sofa} radius={0.05} />
        <RB s={[0.42, 0.4, 0.14]} p={[-sofaLen / 2 + 0.45, 0.72, 0.2]} m={m.linen} radius={0.06} />
        <RB s={[0.42, 0.4, 0.14]} p={[sofaLen / 2 - 0.45, 0.72, 0.2]} m={m.linenSand} radius={0.06} />
      </group>

      {/* Accent chair on the street side, angled to the room */}
      <group position={[su - 1.55, 0, sv - 1.35]} rotation-y={-1.1}>
        <RB s={[0.78, 0.4, 0.72]} p={[0, 0.2, 0]} m={m.sofa} radius={0.12} />
        <RB s={[0.78, 0.32, 0.18]} p={[0, 0.55, -0.27]} m={m.sofa} radius={0.08} />
      </group>

      <Plant m={m} u={-W / 2 + 0.32} v={0.75} />
      {Dp - sv > 2.2 && (
        <group position={[W / 2 - 0.55, 0, Dp - 0.22]}>
          <B s={[0.8, 2.2, 0.4]} p={[0, 1.1, 0]} m={m.taupe} />
          {[0.55, 1.1, 1.65].map((y) => (
            <B key={y} s={[0.72, 0.03, 0.36]} p={[0, y, -0.03]} m={m.oak} />
          ))}
        </group>
      )}
    </group>
  )
}

function Kitchen({ m, W, Dp }) {
  const left = -W / 2 + 0.02
  const runStart = left + 1.3 // after fridge + pantry
  const runEnd = W / 2 - 0.02
  const runLen = runEnd - runStart
  const runC = (runStart + runEnd) / 2
  const islandLen = Math.min(2.1, W - 1.4)
  const upperStart = 0.6
  return (
    <group>
      {/* Fridge and tall pantry at the end */}
      <B s={[0.68, 1.9, 0.7]} p={[left + 0.35, 0.95, 0.35]} m={m.steel} />
      <B s={[0.68, 0.72, 0.62]} p={[left + 0.35, 2.28, 0.31]} m={m.taupe} />
      <B s={[0.6, 2.64, 0.65]} p={[left + 0.99, 1.32, 0.325]} m={m.taupe} />

      {/* Base run, marble top and splash, sink under the window, induction hob */}
      <B s={[runLen, 0.82, 0.65]} p={[runC, 0.47, 0.325]} m={m.taupe} />
      <B s={[runLen, 0.06, 0.6]} p={[runC, 0.03, 0.34]} m={m.skirt} />
      <B s={[runLen + 0.02, 0.04, 0.67]} p={[runC, COUNTER - 0.02, 0.335]} m={m.marble} />
      <B s={[runLen, 0.12, 0.02]} p={[runC, COUNTER + 0.06, 0.01]} m={m.marble} cast={false} />
      <B s={[0.5, 0.012, 0.4]} p={[0, COUNTER + 0.002, 0.33]} m={m.blackSteel} cast={false} />
      <Cyl r={0.015} h={0.32} p={[0, COUNTER + 0.16, 0.08]} m={m.blackSteel} seg={10} />
      <B s={[0.7, 0.008, 0.5]} p={[Math.min(1.05, runEnd - 0.45), COUNTER + 0.004, 0.34]} m={m.screen} cast={false} />
      {/* Uppers to the ceiling, right of the window */}
      {runEnd - upperStart > 0.6 && (
        <B s={[runEnd - upperStart, 1.1, 0.36]} p={[(upperStart + runEnd) / 2, 2.14, 0.18]} m={m.taupe} />
      )}
      {/* Open oak shelves left of the window */}
      {-0.6 - runStart > 0.5 &&
        [1.55, 1.92].map((y) => <B key={y} s={[-0.6 - runStart, 0.035, 0.27]} p={[(runStart - 0.6) / 2, y, 0.135]} m={m.oak} />)}

      {/* Waterfall island with stools */}
      {islandLen >= 1.2 && Dp > 3.4 && (
        <group position={[0.1, 0, 1.95]}>
          <B s={[islandLen - 0.1, 0.84, 0.84]} p={[0, 0.44, 0]} m={m.taupe} />
          <B s={[islandLen, 0.05, 0.94]} p={[0, 0.895, 0]} m={m.marble} />
          {[-1, 1].map((s) => (
            <B key={s} s={[0.05, 0.87, 0.94]} p={[s * (islandLen / 2 - 0.025), 0.435, 0]} m={m.marble} />
          ))}
          {[-0.35, 0.35].map((u) => (
            <group key={u} position={[u * (islandLen / 1.6), 0, 0.72]}>
              <RB s={[0.4, 0.06, 0.38]} p={[0, 0.66, 0]} m={m.linenSand} radius={0.02} />
              {[[-0.16, -0.15], [0.16, -0.15], [-0.16, 0.15], [0.16, 0.15]].map(([a, b]) => (
                <B key={`${a}${b}`} s={[0.03, 0.64, 0.03]} p={[a, 0.32, b]} m={m.oak} />
              ))}
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

function Dining({ m, W, Dp }) {
  const v = Math.max(1.6, Dp * 0.55)
  const long = W >= 3.0
  const tw = long ? 1.7 : 1.1
  const chairs = long
    ? [-0.55, 0, 0.55].flatMap((u) => [
        [u, -0.62, 0],
        [u, 0.62, Math.PI],
      ])
    : [0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4
        return [Math.cos(a) * 0.68, Math.sin(a) * 0.68, -a - Math.PI / 2]
      })
  return (
    <group position={[0, 0, v]}>
      <B s={[tw + 1.2, 0.012, 2.1]} p={[0, 0.006, 0]} m={m.rugDark} cast={false} />
      {long ? (
        <group>
          <B s={[tw, 0.05, 0.95]} p={[0, 0.75, 0]} m={m.oakDark} />
          {[-1, 1].map((s) => (
            <B key={s} s={[0.06, 0.72, 0.8]} p={[s * (tw / 2 - 0.2), 0.36, 0]} m={m.oakDark} />
          ))}
        </group>
      ) : (
        <group>
          <Cyl r={0.56} h={0.04} p={[0, 0.75, 0]} m={m.oakDark} seg={40} />
          <Cyl r={0.08} r2={0.1} h={0.72} p={[0, 0.37, 0]} m={m.oakDark} />
        </group>
      )}
      {chairs.map(([u, w, r], i) => (
        <group key={i} position={[u, 0, w]} rotation-y={r}>
          <RB s={[0.46, 0.09, 0.44]} p={[0, 0.47, 0]} m={m.linen} radius={0.04} />
          <RB s={[0.48, 0.36, 0.08]} p={[0, 0.7, -0.2]} m={m.linen} radius={0.04} />
          {[[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.17], [0.19, 0.17]].map(([a, b]) => (
            <B key={`${a}${b}`} s={[0.03, 0.43, 0.03]} p={[a, 0.215, b]} m={m.blackSteel} />
          ))}
        </group>
      ))}
      <Cyl r={0.06} r2={0.04} h={0.22} p={[0, 0.88, 0]} m={m.porcelain} />
    </group>
  )
}

function Bath({ m, W, Dp, door, ensuite }) {
  const side = door.u >= 0 ? -1 : 1 // fixtures on the wall away from the door
  const rot = side < 0 ? Math.PI / 2 : -Math.PI / 2
  if (ensuite) {
    const showerD = Math.min(1.15, Dp * 0.3)
    return (
      <group>
        {/* Walk-in shower across the window wall, glass screen, rain head */}
        <B s={[W, 0.015, showerD]} p={[0, 0.01, showerD / 2]} m={m.taupeDark} cast={false} />
        <B s={[W, 2.4, 0.02]} p={[0, 1.2, 0.01]} m={m.tile} cast={false} />
        <mesh position={[-side * 0.3, 1.05, showerD]} material={m.glass} renderOrder={2}>
          <boxGeometry args={[W - 0.65, 2.0, 0.012]} />
        </mesh>
        <Cyl r={0.11} h={0.012} p={[0, 2.15, showerD / 2]} m={m.blackSteel} />
        <Toilet m={m} u={side * (W / 2 - 0.3)} v={showerD + 0.5} rot={rot} />
        {Dp > 3.2 && <Vanity m={m} side={side} W={W} v={Math.min(Dp - 0.85, showerD + 1.65)} length={Dp > 3.7 ? 1.3 : 0.8} basins={Dp > 3.7 ? 2 : 1} />}
        <B s={[0.9, 0.012, 0.6]} p={[0, 0.006, Dp - 1.0]} m={m.rug} cast={false} />
      </group>
    )
  }
  const tubL = Math.min(1.7, W - 0.1)
  return (
    <group>
      {/* Tub along the window wall, tiled surround */}
      <B s={[tubL, 0.58, 0.8]} p={[-side * (W / 2 - tubL / 2 - 0.02), 0.29, 0.42]} m={m.porcelain} />
      <B s={[tubL - 0.2, 0.02, 0.6]} p={[-side * (W / 2 - tubL / 2 - 0.02), 0.585, 0.42]} m={m.white} cast={false} />
      <B s={[W, 2.2, 0.02]} p={[0, 1.4, 0.01]} m={m.tile} cast={false} />
      <Toilet m={m} u={side * (W / 2 - 0.3)} v={1.2} rot={rot} />
      {Dp > 2.4 && <Vanity m={m} side={side} W={W} v={Math.min(Dp - 0.5, 2.05)} />}
    </group>
  )
}

function Laundry({ m, W }) {
  const u0 = -W / 2 + 0.34
  return (
    <group>
      {[0, 1].map((i) => (
        <group key={i} position={[u0 + i * 0.64, 0, 0.32]}>
          <B s={[0.6, 0.85, 0.6]} p={[0, 0.425, 0]} m={m.white} />
          <Cyl r={0.19} h={0.02} p={[0, 0.45, 0.3]} m={m.screen} />
        </group>
      ))}
      <B s={[Math.min(W - 0.05, 1.5), 0.04, 0.64]} p={[-W / 2 + Math.min(W - 0.05, 1.5) / 2 + 0.02, 0.9, 0.32]} m={m.oak} />
      <B s={[Math.min(W - 0.05, 1.5), 0.7, 0.35]} p={[-W / 2 + Math.min(W - 0.05, 1.5) / 2 + 0.02, 1.95, 0.175]} m={m.taupe} />
      {W > 1.95 && <Cyl r={0.26} h={1.5} p={[W / 2 - 0.3, 0.75, 0.32]} m={m.white} />}
    </group>
  )
}

function Closet({ m, W, Dp }) {
  const z1 = Dp - 0.45
  return (
    <group>
      <ClosetRail m={m} x={-W / 2 + 0.3} z0={0.12} z1={z1} depth={0.55} />
      {W > 1.5 && <ClosetRail m={m} x={W / 2 - 0.3} z0={0.12} z1={z1} depth={0.55} facing={-1} />}
      {W > 1.75 && <RB s={[0.5, 0.42, 0.9]} p={[0, 0.21, Dp / 2]} m={m.linenSand} radius={0.08} />}
    </group>
  )
}

function Storage({ m, W, Dp }) {
  const seams = Math.max(1, Math.floor((W - 0.1) / 0.6))
  return (
    <group>
      <B s={[W - 0.1, 2.3, 0.45]} p={[0, 1.15, 0.23]} m={m.taupe} />
      {Array.from({ length: seams }, (_, i) => (
        <B key={i} s={[0.006, 2.2, 0.01]} p={[-(W - 0.1) / 2 + ((i + 1) * (W - 0.1)) / (seams + 1), 1.15, 0.456]} m={m.taupeDark} cast={false} />
      ))}
      {Dp > 2.2 && W > 1.2 && <B s={[0.45, 2.3, Math.min(1.6, Dp - 1.4)]} p={[-W / 2 + 0.23, 1.15, 0.45 + Math.min(1.6, Dp - 1.4) / 2]} m={m.taupe} />}
    </group>
  )
}

function Hall({ m, W, Dp }) {
  return <B s={[Math.max(0.6, W - 1.0), 0.012, Math.min(0.75, Dp - 0.25)]} p={[0, 0.006, Dp / 2]} m={m.rugDark} cast={false} />
}

/* ---------- one room ---------- */

/** Frame and furniture for one room; returns null for kinds with none. */
export function roomFurniture(room, doors, L) {
  const r = inner(room, L)
  const door = doors[room.id]
  const anchor = anchorFor(room, r, door)
  const f = frame(r, anchor)
  const d = localDoor(door, f)
  const props = { W: f.W, Dp: f.Dp, door: d }
  let Comp = null
  let extra = {}
  switch (room.kind) {
    case 'bedroom':
      Comp = Bedroom
      break
    case 'primary':
      Comp = Bedroom
      extra = { primary: true }
      break
    case 'office':
      Comp = Office
      break
    case 'living':
      Comp = Living
      break
    case 'kitchen':
      Comp = Kitchen
      break
    case 'dining':
      Comp = Dining
      break
    case 'bath':
      Comp = Bath
      break
    case 'ensuite':
      Comp = Bath
      extra = { ensuite: true }
      break
    case 'laundry':
      Comp = Laundry
      break
    case 'closet':
      Comp = Closet
      break
    case 'storage':
      Comp = Storage
      break
    case 'hall':
      Comp = Hall
      break
    default:
      return null
  }
  return { pos: f.pos, rot: f.rot, Comp, props: { ...props, ...extra } }
}
