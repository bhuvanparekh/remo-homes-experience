import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { CRANE, MODULE_TOP, TRUCK } from '../../config/construction.config.js'

/**
 * The delivery truck and the mobile crane, built from simple solids. They're
 * on screen for a few seconds at a distance, so the silhouette and colour do
 * the work — like the white transport rig in ReMo's Instagram posts.
 */

const mat = {
  white: new MeshStandardMaterial({ color: '#f1f0ec', roughness: 0.5 }),
  dark: new MeshStandardMaterial({ color: '#2a2b2d', roughness: 0.6, metalness: 0.3 }),
  tyre: new MeshStandardMaterial({ color: '#18181a', roughness: 0.9 }),
  glass: new MeshStandardMaterial({ color: '#1d2a33', roughness: 0.15, metalness: 0.4 }),
  yellow: new MeshStandardMaterial({ color: '#e2ad1c', roughness: 0.45, metalness: 0.2 }),
  steel: new MeshStandardMaterial({ color: '#8d9296', roughness: 0.4, metalness: 0.8 }),
  cable: new MeshStandardMaterial({ color: '#1f1f20', roughness: 0.6 }),
}

const TURRET_X = 1.2
const box = new BoxGeometry(1, 1, 1)
const wheel = new CylinderGeometry(0.5, 0.5, 0.42, 18).rotateZ(Math.PI / 2)
const rod = new CylinderGeometry(1, 1, 1, 6)

function Part({ s, p, m, r }) {
  return <mesh geometry={box} material={m} scale={s} position={p} rotation={r} castShadow receiveShadow />
}

function Wheels({ zs, half, y = 0.5, scale = 1 }) {
  return zs.flatMap((z) =>
    [-half, half].map((x) => <mesh key={`${x},${z}`} geometry={wheel} material={mat.tyre} position={[x, y * scale, z]} scale={scale} castShadow />),
  )
}

/**
 * Flatbed rig. Origin = centre of the load on the bed; it drives along −z.
 * The module itself is not part of the truck — it rides on top.
 */
export function Truck({ groupRef }) {
  const bed = TRUCK.bed
  return (
    <group ref={groupRef}>
      {/* Trailer */}
      <Part s={[2.6, 0.22, 13]} p={[0, bed - 0.11, 1.2]} m={mat.dark} />
      <Part s={[0.25, 0.45, 12.4]} p={[-0.8, bed - 0.45, 1.2]} m={mat.dark} />
      <Part s={[0.25, 0.45, 12.4]} p={[0.8, bed - 0.45, 1.2]} m={mat.dark} />
      <Wheels zs={[5.6, 6.6, 7.6]} half={1.05} />
      {/* Tractor */}
      <Part s={[2.4, 0.55, 6.2]} p={[0, 0.95, -7.6]} m={mat.dark} />
      <Part s={[2.5, 2.5, 2.3]} p={[0, 2.25, -9.6]} m={mat.white} />
      <Part s={[2.52, 0.8, 0.05]} p={[0, 2.85, -10.76]} m={mat.glass} />
      <Part s={[2.5, 1.1, 1.4]} p={[0, 3.1, -7.8]} m={mat.white} />
      <Part s={[2.3, 0.3, 0.2]} p={[0, 0.75, -10.8]} m={mat.dark} />
      <Wheels zs={[-9.7, -6.4, -5.3]} half={1.05} />
    </group>
  )
}

/**
 * Mobile crane. `apiRef.current.pose(x, z, hookY, attached)` swings the
 * turret toward (x, z), luffs the boom so its tip sits right above it, drops
 * the hook to hookY and shows the four slings when a module is hanging.
 */
export function Crane({ groupRef, apiRef }) {
  const turret = useRef(null)
  const boom = useRef(null)
  const cable = useRef(null)
  const hook = useRef(null)
  const slings = useRef(null)

  const slingParts = useMemo(() => {
    // Hook to the four lifting points on the module roof, 2.2 m below.
    const drop = 2.2
    return [
      [-1.6, -3.6],
      [1.6, -3.6],
      [-1.6, 3.6],
      [1.6, 3.6],
    ].map(([x, z]) => {
      const dir = new Vector3(x, -drop, z)
      const len = dir.length()
      const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize())
      return { pos: [x / 2, -drop / 2, z / 2], len, quat }
    })
  }, [])

  useLayoutEffect(() => {
    const L = CRANE.boom
    apiRef.current = {
      /** Cable and hook live outside the carrier group, so hide all three together. */
      setVisible(v) {
        groupRef.current.visible = v
        cable.current.visible = v
        hook.current.visible = v
      },
      pose(x, z, hookY, attached) {
        const g = groupRef.current
        const dx = x - (g.position.x + TURRET_X)
        const dz = z - g.position.z
        const r = Math.max(4, Math.hypot(dx, dz))
        turret.current.rotation.y = Math.atan2(-dz, dx)
        const angle = Math.acos(Math.min(0.98, r / L))
        boom.current.rotation.z = angle
        const tipY = CRANE.pivotY + L * Math.sin(angle)
        const len = Math.max(0.3, tipY - hookY)
        cable.current.position.set(x, tipY - len / 2, z)
        cable.current.scale.set(0.035, len, 0.035)
        hook.current.position.set(x, hookY, z)
        slings.current.visible = attached
      },
    }
  }, [apiRef, groupRef])

  const L = CRANE.boom
  return (
    <group>
      <group ref={groupRef}>
        {/* Carrier, long axis along x, with outriggers down */}
        <Part s={[11, 1.3, 2.7]} p={[0, 1.35, 0]} m={mat.yellow} />
        <Part s={[2.0, 1.6, 2.5]} p={[-5.0, 2.6, 0]} m={mat.yellow} />
        <Part s={[1.4, 0.9, 2.52]} p={[-5.3, 2.85, 0]} m={mat.glass} />
        <Wheels zs={[-4.2, -2.6, 1.6, 3.2, 4.6]} half={1.25} />
        {[-3.6, 3.6].map((x) =>
          [-1, 1].map((side) => (
            <group key={`${x}${side}`}>
              <Part s={[0.35, 0.3, 2.6]} p={[x, 1.0, side * 2.6]} m={mat.yellow} />
              <Part s={[0.25, 1.0, 0.25]} p={[x, 0.5, side * 3.8]} m={mat.steel} />
              <Part s={[0.7, 0.08, 0.7]} p={[x, 0.04, side * 3.8]} m={mat.dark} />
            </group>
          )),
        )}
        {/* Turret, counterweight and boom */}
        <group ref={turret} position={[TURRET_X, 2.1, 0]}>
          <Part s={[3.4, 1.2, 2.5]} p={[-0.6, 0.6, 0]} m={mat.yellow} />
          <Part s={[1.2, 1.4, 2.6]} p={[-2.6, 0.9, 0]} m={mat.dark} />
          <Part s={[1.1, 1.3, 0.9]} p={[0.4, 1.5, 1.0]} m={mat.yellow} />
          <group ref={boom} position={[0, CRANE.pivotY - 2.1, 0]}>
            <Part s={[L * 0.6, 0.85, 0.85]} p={[L * 0.3, 0, 0]} m={mat.yellow} />
            <Part s={[L * 0.45, 0.6, 0.6]} p={[L * 0.775, 0, 0]} m={mat.yellow} />
            <Part s={[0.6, 0.7, 0.5]} p={[L, 0, 0]} m={mat.yellow} />
          </group>
        </group>
      </group>
      {/* Cable and hook live in world space; pose() places them. */}
      <mesh ref={cable} geometry={rod} material={mat.cable} />
      <group ref={hook}>
        <Part s={[0.45, 0.6, 0.35]} p={[0, 0.3, 0]} m={mat.yellow} />
        <group ref={slings}>
          {slingParts.map((s, i) => (
            <mesh key={i} geometry={rod} material={mat.cable} position={s.pos} quaternion={s.quat} scale={[0.02, s.len, 0.02]} />
          ))}
        </group>
      </group>
    </group>
  )
}

export const HOOK_DROP = 2.2
export { MODULE_TOP }
