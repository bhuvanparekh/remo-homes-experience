import { use, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BackSide,
  BoxGeometry,
  Color,
  CustomBlending,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NormalBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import { QUALITY } from '../../core/quality.js'
import { noisePromise, SKY_COLORS, SUN_DIR, terrainPromise } from './assets.js'

/**
 * The cloud deck the descent falls through: 700–1150 m above the lot, the
 * height LA's morning marine layer sits at, so the San Gabriel peaks break
 * through it in the opening shot.
 */
const DECK = { bottom: 700, top: 1150, half: 12000 }

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

/*
 * Ray-marched volumetric clouds (after Schneider's Horizon Zero Dawn talk and
 * Hillaire's energy-conserving integration). Per pixel: find where the view
 * ray crosses the deck, step through it sampling a 3D Perlin-Worley density
 * field, and at each dense sample march a few steps toward the sun to learn
 * how much light reaches it. Forward scattering gives the bright silver rim
 * when you look toward the sun; the "powder" term darkens thin cloud edges
 * facing you, which is what makes them read as volume instead of fog.
 */
const FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  uniform sampler3D uNoise;
  uniform sampler2D uTerrain;
  uniform float uTerrainHalf;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxMax;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform float uCoverage;
  uniform float uDensity;
  uniform float uTime;
  uniform int uSteps;
  uniform int uLightSteps;
  uniform float uOpacity;
  varying vec3 vWorld;

  #define PI 3.141592653589793

  vec2 boxHit(vec3 ro, vec3 rd) {
    vec3 inv = 1.0 / rd;
    vec3 t0 = (uBoxMin - ro) * inv;
    vec3 t1 = (uBoxMax - ro) * inv;
    vec3 lo = min(t0, t1);
    vec3 hi = max(t0, t1);
    return vec2(max(max(lo.x, lo.y), lo.z), min(min(hi.x, hi.y), hi.z));
  }

  float remap(float v, float a, float b, float c, float d) {
    return c + (v - a) / (b - a) * (d - c);
  }

  float hg(float c, float g) {
    float g2 = g * g;
    return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); // × 4π: isotropic = 1
  }

  float terrainHeight(vec2 xz) {
    vec2 uv = (xz + uTerrainHalf) / (2.0 * uTerrainHalf);
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return -1000.0;
    return texture2D(uTerrain, uv).r;
  }

  float density(vec3 p, bool detailed) {
    float h = (p.y - uBoxMin.y) / (uBoxMax.y - uBoxMin.y);
    // Flat-ish bases, rounded cauliflower tops.
    float profile = smoothstep(0.0, 0.14, h) * smoothstep(1.0, 0.5, h);
    vec3 wind = vec3(uTime * 7.0, 0.0, uTime * 2.5);

    // Large-scale weather: where cloud is allowed at all.
    float weather = texture(uNoise, vec3((p.xz + wind.xz * 0.4) * 0.000075, 0.31).xzy).r;
    float coverage = clamp(remap(weather, 0.25, 0.75, 0.0, 1.0), 0.0, 1.0) * uCoverage;

    float base = texture(uNoise, (p + wind) * 0.00038).r * profile;
    float shape = clamp(remap(base, 1.0 - coverage, 1.0, 0.0, 1.0), 0.0, 1.0);

    // Thin out toward the deck's far edges so it never ends in a wall.
    float r = max(abs(p.x), abs(p.z));
    shape *= 1.0 - smoothstep(${(DECK.half * 0.6).toFixed(1)}, ${(DECK.half * 0.98).toFixed(1)}, r);

    // A break in the deck over the lot: the dive passes through bright thin
    // mist and the neighbourhood shows through, instead of a grey whiteout.
    float clearing = smoothstep(120.0, 650.0, length(p.xz - vec2(-40.0, 320.0)));
    shape *= mix(0.5, 1.0, clearing);

    if (shape <= 0.0 || !detailed) return shape * uDensity;

    vec4 d = texture(uNoise, (p + wind * 1.6) * 0.0024);
    float erosion = d.g * 0.625 + d.b * 0.25 + d.a * 0.125;
    // Erode more at the bottom (wispy bases), less on the tops (billows).
    shape = clamp(remap(shape, erosion * mix(0.55, 0.25, h), 1.0, 0.0, 1.0), 0.0, 1.0);
    return shape * uDensity;
  }

  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorld - ro);
    vec2 t = boxHit(ro, rd);
    t.x = max(t.x, 0.0);
    if (t.y <= t.x) discard;

    float span = min(t.y - t.x, 9000.0);
    float steps = float(uSteps);
    // Short spans (looking straight down through the deck) get fine steps;
    // long grazing spans get coarser ones — the cost stays flat.
    float dt = span / steps;
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);

    float cosSun = dot(rd, uSunDir);
    float phase = mix(hg(cosSun, 0.65), hg(cosSun, -0.2), 0.4);

    const float SIGMA = 0.045;     // extinction per metre at density 1
    const float LIGHT_STEP = 55.0;

    float T = 1.0;
    vec3 L = vec3(0.0);
    float firstHit = -1.0;

    for (int i = 0; i < 160; i++) {
      if (i >= uSteps) break;
      vec3 p = ro + rd * (t.x + (float(i) + jitter) * dt);
      if (p.y < terrainHeight(p.xz)) break;       // the ray hit a mountainside
      float d = density(p, true);
      if (d > 0.002) {
        if (firstHit < 0.0) firstHit = t.x + float(i) * dt;
        float od = 0.0;
        for (int j = 0; j < 8; j++) {
          if (j >= uLightSteps) break;
          od += density(p + uSunDir * LIGHT_STEP * (float(j) + 0.5), false);
        }
        float lightT = exp(-od * SIGMA * LIGHT_STEP * 0.8);
        float powder = 1.0 - exp(-d * SIGMA * LIGHT_STEP * 3.0);
        float h = clamp((p.y - uBoxMin.y) / (uBoxMax.y - uBoxMin.y), 0.0, 1.0);
        vec3 ambient = mix(uSkyHorizon * 0.75, uSkyTop * 1.25, h);
        vec3 S = uSunColor * lightT * phase * mix(0.6, 1.0, powder) + ambient;

        float stepT = exp(-d * SIGMA * dt);
        L += T * S * (1.0 - stepT);
        T *= stepT;
        if (T < 0.015) break;
      }
    }

    float alpha = 1.0 - T;
    if (alpha < 0.003) discard;

    // Distant cloud sinks into the same haze as the ground.
    float haze = 1.0 - exp(-max(firstHit, 0.0) * 0.00009);
    vec3 col = L / alpha;
    col = mix(col, uSkyHorizon * 1.1, haze);

    // Linear, premultiplied — tone mapping happens in the composite pass.
    gl_FragColor = vec4(col * alpha, alpha) * uOpacity;
  }
`

/*
 * Upsamples the low-resolution cloud buffer over the full-resolution frame.
 * A small tent filter hides the per-pixel ray jitter, then the colour is
 * tone mapped exactly like the rest of the scene.
 */
const COMPOSITE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const COMPOSITE_FRAGMENT = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uClouds, vUv) * 0.4;
    c += texture2D(uClouds, vUv + vec2( uTexel.x, 0.0)) * 0.15;
    c += texture2D(uClouds, vUv + vec2(-uTexel.x, 0.0)) * 0.15;
    c += texture2D(uClouds, vUv + vec2(0.0,  uTexel.y)) * 0.15;
    c += texture2D(uClouds, vUv + vec2(0.0, -uTexel.y)) * 0.15;
    if (c.a < 0.002) discard;
    gl_FragColor = vec4(c.rgb / c.a, c.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`

const STEPS = { high: [56, 5], medium: [44, 4], low: [32, 3] }
// Fraction of the drawing-buffer resolution the clouds are ray-marched at.
const RESOLUTION = { high: 0.42, medium: 0.34, low: 0.25 }

/**
 * Volumetric cloud deck, ray-marched into a reduced-resolution buffer and
 * composited over the frame. Clouds are soft, so a third of the pixels is
 * visually indistinguishable — and roughly ten times cheaper, which is the
 * difference between a slideshow and 60 fps on integrated graphics.
 *
 * Owns the render loop (useFrame priority 1) while mounted: cloud pass into
 * the buffer, then the normal scene, whose last object is the composite quad.
 * Rays stop at the terrain inside the shader, so no depth buffer is needed.
 */
export function Clouds({ activeRef }) {
  const noise = use(noisePromise)
  const terrain = use(terrainPromise)
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const clock = useRef(0)
  const composite = useRef(null)

  const { cloudScene, material, target, compositeMaterial } = useMemo(() => {
    const [steps, lightSteps] = STEPS[QUALITY.id]
    const material = new ShaderMaterial({
      side: BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: NormalBlending,
      premultipliedAlpha: true,
      uniforms: {
        uNoise: { value: noise },
        uTerrain: { value: terrain.texture },
        uTerrainHalf: { value: terrain.half },
        uBoxMin: { value: new Vector3(-DECK.half, DECK.bottom, -DECK.half) },
        uBoxMax: { value: new Vector3(DECK.half, DECK.top, DECK.half) },
        uSunDir: { value: SUN_DIR.clone() },
        uSunColor: { value: new Color(1.0, 0.86, 0.7).multiplyScalar(3.4) },
        uSkyTop: { value: SKY_COLORS.upper.clone() },
        uSkyHorizon: { value: SKY_COLORS.horizon.clone() },
        uCoverage: { value: 0.62 },
        uDensity: { value: 1.0 },
        uTime: { value: 0 },
        uSteps: { value: steps },
        uLightSteps: { value: lightSteps },
        uOpacity: { value: 1 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })

    const box = new Mesh(new BoxGeometry(DECK.half * 2, DECK.top - DECK.bottom, DECK.half * 2), material)
    box.position.y = (DECK.top + DECK.bottom) / 2
    box.frustumCulled = false
    const cloudScene = new Scene()
    cloudScene.add(box)

    const target = new WebGLRenderTarget(4, 4, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
    })

    const compositeMaterial = new ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      uniforms: { uClouds: { value: target.texture }, uTexel: { value: new Vector2() } },
      vertexShader: COMPOSITE_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
    })

    return { cloudScene, material, target, compositeMaterial }
  }, [noise, terrain])

  useEffect(() => {
    const scale = RESOLUTION[QUALITY.id]
    const w = Math.max(1, Math.round(size.width * dpr * scale))
    const h = Math.max(1, Math.round(size.height * dpr * scale))
    target.setSize(w, h)
    compositeMaterial.uniforms.uTexel.value.set(1 / w, 1 / h)
  }, [size, dpr, target, compositeMaterial])

  useEffect(() => () => target.dispose(), [target])

  useFrame((state, delta) => {
    const active = activeRef?.current ?? true
    if (composite.current) composite.current.visible = active

    if (active) {
      clock.current += Math.min(delta, 0.1)
      material.uniforms.uTime.value = clock.current
      // The cloud scene has no shadow casters; don't let it consume a pending
      // on-demand shadow update meant for the main scene.
      const shadowPending = gl.shadowMap.needsUpdate
      gl.shadowMap.needsUpdate = false
      gl.setRenderTarget(target)
      gl.setClearColor(0x000000, 0)
      gl.clear(true, false, false)
      gl.render(cloudScene, state.camera)
      gl.setRenderTarget(null)
      gl.shadowMap.needsUpdate = shadowPending
    }
    gl.render(state.scene, state.camera)
  }, 1)

  return (
    <mesh ref={composite} material={compositeMaterial} renderOrder={1000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
