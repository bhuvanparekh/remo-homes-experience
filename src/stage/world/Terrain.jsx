import { use, useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { Color, PlaneGeometry, ShaderMaterial, SRGBColorSpace, TextureLoader } from 'three'
import { GEO, LAYER_URLS, SKY_COLORS, terrainPromise } from './assets.js'

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

/**
 * Three nested aerial photos (0.5 m, 2.4 m and 15 m per pixel) draped over
 * real elevation. Each pixel uses the sharpest photo that covers it, feathered
 * at the seams, then fades into atmospheric haze with distance — the same
 * blue-grey veil you see from a plane window.
 */
const FRAGMENT = /* glsl */ `
  uniform sampler2D uNear;
  uniform sampler2D uMid;
  uniform sampler2D uFar;
  uniform vec3 uHalf;      // half-size of near / mid / far, metres
  uniform vec3 uHaze;
  uniform vec3 uTint;
  uniform float uHazeDensity;
  varying vec3 vWorld;

  vec2 layerUv(vec2 xz, float hs) {
    vec2 uv = (xz + hs) / (2.0 * hs);
    return vec2(uv.x, 1.0 - uv.y);
  }

  // 1 well inside a layer, 0 at its edge — so seams never show.
  float inside(vec2 xz, float hs, float feather) {
    vec2 d = hs - abs(xz);
    return clamp(min(d.x, d.y) / feather, 0.0, 1.0);
  }

  void main() {
    vec2 xz = vWorld.xz;
    vec3 col = texture2D(uFar, layerUv(xz, uHalf.z)).rgb;
    col = mix(col, texture2D(uMid, layerUv(xz, uHalf.y)).rgb, inside(xz, uHalf.y, 400.0));
    col = mix(col, texture2D(uNear, layerUv(xz, uHalf.x)).rgb, inside(xz, uHalf.x, 60.0));
    col *= uTint;

    float dist = length(vWorld - cameraPosition);
    // Denser haze low down, thinner up the mountains.
    float heightFalloff = exp(-max(vWorld.y, 0.0) / 1400.0);
    float haze = 1.0 - exp(-dist * uHazeDensity * (0.55 + 0.45 * heightFalloff));
    col = mix(col, uHaze, haze);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/**
 * The real Altadena ground and the San Gabriel Mountains behind it.
 * Heights come from USGS 3DEP via scripts/build_assets.py.
 */
export function Terrain({ uniformsRef }) {
  const terrain = use(terrainPromise)
  const textures = useLoader(TextureLoader, LAYER_URLS)
  const gl = useThree((s) => s.gl)

  const geometry = useMemo(() => {
    const { grid, half, heights } = terrain
    const g = new PlaneGeometry(half * 2, half * 2, grid - 1, grid - 1)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setY(i, heights[i])
    pos.needsUpdate = true
    g.computeBoundingSphere()
    return g
  }, [terrain])

  const material = useMemo(() => {
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy())
    for (const t of textures) {
      t.colorSpace = SRGBColorSpace
      t.anisotropy = aniso
      t.needsUpdate = true
    }
    const m = new ShaderMaterial({
      uniforms: {
        uNear: { value: textures[0] },
        uMid: { value: textures[1] },
        uFar: { value: textures[2] },
        uHalf: { value: [GEO.layers.near.half, GEO.layers.mid.half, GEO.layers.far.half] },
        uHaze: { value: SKY_COLORS.horizon.clone() },
        uTint: { value: new Color(1, 1, 1) },
        uHazeDensity: { value: 0.00011 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })
    if (uniformsRef) uniformsRef.current = m.uniforms
    return m
  }, [textures, gl, uniformsRef])

  return <mesh geometry={geometry} material={material} receiveShadow renderOrder={-5} />
}
