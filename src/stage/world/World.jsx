import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CHAPTERS } from '../../config/chapters.config.js'
import { journey } from '../../scroll/journey.js'
import { Atmosphere } from '../Atmosphere.jsx'
import { House } from '../house/House.jsx'
import { EXPLORE } from '../CameraRig.jsx'
import { Clouds } from './Clouds.jsx'
import { SkyDome } from './SkyDome.jsx'
import { Terrain } from './Terrain.jsx'

// The cloud deck only matters until we're down on the lot; after that it is
// skipped entirely so the ray-marcher costs nothing during the house tour.
const LAST_CLOUD_CHAPTER = CHAPTERS.findIndex((c) => c.id === 'site')
// The lot is bare until construction begins (Phase 5 animates the build).
const BUILD_CHAPTER = CHAPTERS.findIndex((c) => c.id === 'construction')

/**
 * Everything that exists in the world. Suspends until the real-world assets
 * (sky photo, aerial layers, terrain, cloud noise) are loaded, then tells the
 * stage it can lift the loader.
 */
export function World({ onReady }) {
  const skyTint = useRef(null)
  const groundUniforms = useRef(null)
  const cloudsActive = useRef(true)
  const house = useRef(null)
  const gl = useThree((s) => s.gl)
  const shadowFrames = useRef(30)

  // Nothing in the world moves and the sun is fixed, so shadows are rendered
  // on demand rather than every frame: for the first frames after load (while
  // textures arrive) and whenever the house appears or disappears.
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
  }, [gl])

  useEffect(() => {
    onReady?.()
  }, [onReady])

  useFrame(() => {
    const { index } = journey.get()
    cloudsActive.current = index <= LAST_CLOUD_CHAPTER
    if (house.current) {
      const visible = EXPLORE || index >= BUILD_CHAPTER
      if (visible !== house.current.visible) shadowFrames.current = 3
      house.current.visible = visible
    }
    if (shadowFrames.current > 0) {
      shadowFrames.current -= 1
      gl.shadowMap.needsUpdate = true
    }
  })

  return (
    <>
      <Atmosphere skyTintRef={skyTint} groundUniformsRef={groundUniforms} />
      <SkyDome tintRef={skyTint} />
      <Terrain uniformsRef={groundUniforms} />
      <Clouds activeRef={cloudsActive} />
      <group ref={house}>
        <House />
      </group>
    </>
  )
}
