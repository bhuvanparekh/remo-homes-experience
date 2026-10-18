import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { CHAPTERS } from '../../config/chapters.config.js'
import { range, smoothstep } from '../../core/math.js'
import { journey } from '../../scroll/journey.js'
import { EquirectangularReflectionMapping } from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { HOUSE } from '../../config/floorplan.js'
import { envUrl, SKY_YAW } from '../world/assets.js'
import { MaterialsProvider, useBuildMaterials } from './materials.js'
import { Shell } from './Shell.jsx'
import { Roof } from './Roof.jsx'
import { Canopies, Hardscape, Lawn } from './Site.jsx'
import { Foliage } from './Foliage.jsx'
import { ModularBatch, CLIPPED } from './ModularBatch.jsx'
import { MODULES } from '../../config/construction.config.js'
import { Construction } from '../construction/Construction.jsx'
import { RoomPicker } from './RoomPicker.jsx'
import { GreatRoom } from './interior/GreatRoom.jsx'
import { Private } from './interior/Private.jsx'
import { StaticBatch } from './StaticBatch.jsx'
import { SteelFrame } from './SteelFrame.jsx'
import { useStoreValue } from '../../core/store.js'
import { modes, selectXray } from '../../scroll/tourState.js'

/**
 * Image-based light from the same Poly Haven sky the descent flies through,
 * so reflections in the glass, steel and marble show the real sky. Rotated
 * to match the sky dome (see SkyDome: our azimuth is measured from north).
 */
function SkyLight() {
  const scene = useThree((s) => s.scene)
  const hdr = useLoader(HDRLoader, envUrl('sky_1k.hdr'))
  useEffect(() => {
    hdr.mapping = EquirectangularReflectionMapping
    scene.environment = hdr
    scene.environmentIntensity = 0.55
    scene.environmentRotation.set(0, Math.PI / 2 - SKY_YAW, 0)
    return () => {
      scene.environment = null
    }
  }, [hdr, scene])
  return null
}

/**
 * Warm interior fill. Daylight through the windows does the real work; these
 * stand in for the bounce light a path tracer would compute, so rooms read
 * like ReMo's renders instead of dark boxes. No shadows — they're cheap.
 */
const LAMPS = [
  // [x, z, intensity] — one per zone; every extra light costs every pixel.
  [0.6, -1.8, 3.0],
  [1.9, 1.9, 3.0],
  [-4.0, 1.8, 2.4],
  [6.0, 0.4, 2.8],
]

const VISIT = CHAPTERS.findIndex((c) => c.id === 'visit')

/**
 * At dusk (chapter 06) the house lights up like ReMo's twilight render: the
 * interior lamps come up and the glass picks up a warm glow from inside.
 */
function InteriorLights({ materials }) {
  const lamps = useRef([])
  const y = HOUSE.floorY + HOUSE.ceiling - 0.35
  const glass = useMemo(() => [materials.glass, ...(CLIPPED.get(materials.glass) ?? [])], [materials])
  const last = useRef(-1)
  const scene = useThree((st) => st.scene)

  useFrame(() => {
    const { index, t } = journey.get()
    const k = index === VISIT ? smoothstep(range(t, 0.15, 0.6)) : index > VISIT ? 1 : 0
    if (k === last.current) return
    last.current = k
    lamps.current.forEach((l, i) => l && (l.intensity = LAMPS[i][2] * (1 + 2.2 * k)))
    // The reflected sky is a daytime photo; dim it so the evening reads.
    scene.environmentIntensity = 0.55 * (1 - 0.6 * k)
    for (const g of glass) {
      g.emissive.set('#ffbf7a')
      g.emissiveIntensity = 2.4 * k
      g.opacity = 0.18 + 0.5 * k
    }
  })

  return LAMPS.map(([x, z, intensity], i) => (
    <pointLight key={`${x},${z}`} ref={(l) => (lamps.current[i] = l)} position={[x, y, z]} color="#ffe4c4" intensity={intensity} distance={8} decay={1.5} />
  ))
}

/** The finishes X-ray mode turns to glass so the steel frame shows through. */
const GHOSTED = ['panel', 'plaster', 'ceiling', 'roof', 'skirt', 'solar', 'solarFrame', 'downlight']

function useXray(materials, on) {
  useEffect(() => {
    if (!on) return
    // The house renders clipped per-module clones of these, so ghost those too.
    const targets = GHOSTED.flatMap((name) => [materials[name], ...(CLIPPED.get(materials[name]) ?? [])])
    const saved = targets.map((mat) => {
      const prev = { transparent: mat.transparent, opacity: mat.opacity, depthWrite: mat.depthWrite }
      Object.assign(mat, { transparent: true, opacity: 0.12, depthWrite: false })
      mat.needsUpdate = true
      return [mat, prev]
    })
    return () => {
      for (const [mat, prev] of saved) {
        Object.assign(mat, prev)
        mat.needsUpdate = true
      }
    }
  }, [materials, on])
}

/** The SupReMo™, its lot, and everything inside it. */
export function House() {
  const materials = useBuildMaterials()
  const xray = useStoreValue(modes, selectXray)
  useXray(materials, xray)

  const modules = useRef(null)
  const hardscape = useRef(null)
  const lawn = useRef(null)
  const planting = useRef(null)
  const onModules = useCallback((api) => (modules.current = api), [])

  return (
    <MaterialsProvider value={materials}>
      <SkyLight />
      {/* The house proper, cut into the factory modules the crane sets. */}
      <ModularBatch modules={MODULES} onReady={onModules}>
        <Shell />
        <Roof />
        <Canopies />
        <group position-y={HOUSE.floorY}>
          <GreatRoom />
          <Private />
        </group>
      </ModularBatch>
      {/* Site works, laid once the modules are in. */}
      <group ref={hardscape}>
        <StaticBatch>
          <Hardscape />
        </StaticBatch>
      </group>
      <Lawn materialRef={lawn} />
      <Foliage plantingRef={planting} />
      <SteelFrame visible={xray} />
      <InteriorLights materials={materials} />
      <RoomPicker materials={materials} modulesRef={modules} />
      <Construction modulesRef={modules} hardscapeRef={hardscape} lawnRef={lawn} plantingRef={planting} />
    </MaterialsProvider>
  )
}
