import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { QUALITY } from '../core/quality.js'
import { CameraRig } from './CameraRig.jsx'
import { TourTracker } from './TourTracker.jsx'
import { World } from './world/World.jsx'

/**
 * The WebGL world. Lazy-loaded by <Stage>, so three.js never blocks first paint.
 *
 * The far plane reaches the 15 km terrain edge; CameraRig moves the near
 * plane with altitude so depth precision stays tight inside the house.
 */
export default function JourneyCanvas({ onReady }) {
  return (
    <Canvas
      dpr={QUALITY.dpr}
      shadows={QUALITY.shadows ? 'percentage' : false}
      camera={{ fov: 42, near: 0.05, far: 40000, position: [-400, 1650, 2600] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        // ?debug exposes the renderer for draw-call checks from devtools.
        if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __gl: gl, __scene: scene })
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.0
        gl.outputColorSpace = SRGBColorSpace
      }}
    >
      <CameraRig />
      <TourTracker />
      <Suspense fallback={null}>
        <World onReady={onReady} />
      </Suspense>
    </Canvas>
  )
}
