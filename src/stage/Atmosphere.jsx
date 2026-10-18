import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color } from 'three'
import { journey } from '../scroll/journey.js'
import { QUALITY } from '../core/quality.js'
import { mixSky } from './skyPalettes.js'
import { SKY_COLORS, SUN_DIR } from './world/assets.js'

const SUN_DISTANCE = 80
const fogColor = new Color()

/**
 * Light and grade for the whole world, re-mixed every frame from the chapter's
 * time-of-day palette: the sun and sky light on the house, scene fog, and the
 * tints handed to the sky photo and the aerial ground. One owner, so the sky
 * and the light falling on the house can never disagree.
 *
 * The sun is placed along the sky photo's real sun direction, so shadows on
 * the house point the same way as the light in the photograph.
 */
export function Atmosphere({ skyTintRef, groundUniformsRef }) {
  const scene = useThree((s) => s.scene)
  const sun = useRef(null)
  const ambient = useRef(null)

  useFrame(() => {
    const { index, t } = journey.get()
    const grade = mixSky(index, t)

    if (skyTintRef) skyTintRef.current = grade.skyTint
    const ground = groundUniformsRef?.current
    if (ground) {
      ground.uTint.value.copy(grade.groundTint)
      ground.uHaze.value.copy(SKY_COLORS.horizon).multiply(grade.skyTint)
    }

    if (scene.fog) {
      scene.fog.color.copy(fogColor.copy(SKY_COLORS.horizon).multiply(grade.skyTint))
      scene.fog.near = grade.fogNear
      scene.fog.far = grade.fogFar
    }

    if (sun.current) {
      sun.current.color.copy(grade.sun)
      sun.current.intensity = grade.sunIntensity
    }
    if (ambient.current) {
      ambient.current.color.copy(grade.ambient)
      ambient.current.groundColor.copy(grade.ground)
      ambient.current.intensity = grade.ambientIntensity
    }
  })

  return (
    <>
      <fog attach="fog" args={['#ffffff', 900, 6000]} />

      <hemisphereLight ref={ambient} />

      <directionalLight
        ref={sun}
        position={SUN_DIR.clone().multiplyScalar(SUN_DISTANCE).toArray()}
        castShadow={QUALITY.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-bias={-0.0004}
      />
    </>
  )
}
