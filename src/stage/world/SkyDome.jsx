import { useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { BackSide, Color, LinearFilter, NoColorSpace, ShaderMaterial, TextureLoader } from 'three'
import { GEO, SKY_URL, SKY_YAW } from './assets.js'

const VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Equirectangular lookup of the real sky photo. Deliberately NOT tone mapped:
 * the photo is already a finished, display-referred image, and running it
 * through ACES a second time would flatten its colour.
 */
const FRAGMENT = /* glsl */ `
  uniform sampler2D uSky;
  uniform float uYaw;
  uniform float uVMax;
  uniform vec3 uHorizon;
  uniform vec3 uTint;
  varying vec3 vDir;
  #define PI 3.141592653589793
  void main() {
    vec3 d = normalize(vDir);
    float az = atan(d.x, -d.z) - uYaw;
    float u = fract(az / (2.0 * PI) + 0.5);
    float v = 0.5 - asin(clamp(d.y, -1.0, 1.0)) / PI;
    vec3 col = texture2D(uSky, vec2(u, 1.0 - min(v, uVMax - 0.002) / uVMax)).rgb;
    // Below the photo's cropped edge, settle into the horizon haze.
    col = mix(col, uHorizon, smoothstep(uVMax - 0.04, uVMax, v));
    gl_FragColor = vec4(col * uTint, 1.0);
  }
`

/**
 * The real sky (Poly Haven "Kloppenheim 06", CC0) on a dome that follows the
 * camera. `tint` lets later chapters warm it toward golden hour and dusk.
 */
export function SkyDome({ tintRef }) {
  const texture = useLoader(TextureLoader, SKY_URL)
  const mesh = useRef(null)

  const material = useMemo(() => {
    texture.colorSpace = NoColorSpace // sample raw sRGB bytes, output them as-is
    texture.generateMipmaps = false // the u-wrap seam would otherwise show a mip line
    texture.minFilter = LinearFilter
    texture.needsUpdate = true
    return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      uniforms: {
        uSky: { value: texture },
        uYaw: { value: SKY_YAW },
        uVMax: { value: GEO.sky.vMax },
        uHorizon: { value: new Color().fromArray(GEO.sky.horizon) },
        uTint: { value: new Color(1, 1, 1) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })
  }, [texture])

  useFrame(({ camera }) => {
    mesh.current.position.copy(camera.position)
    if (tintRef?.current) material.uniforms.uTint.value.copy(tintRef.current)
  })

  return (
    <mesh ref={mesh} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1000, 64, 32]} />
    </mesh>
  )
}
