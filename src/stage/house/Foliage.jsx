import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  ShaderChunk,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { QUALITY } from '../../core/quality.js'
import { useMaterials } from './materials.js'

/**
 * Trees and shrubs from leaf-cluster cards — the technique games use for
 * foliage. Each card is a small quad with a cut-out bunch of leaves; a few
 * hundred per tree, scattered through a canopy volume, read as a soft, lit
 * crown instead of the faceted blobs of solid geometry.
 *
 * The trick that makes it look like a tree rather than confetti: every card's
 * normal points out from the centre of its crown, so light wraps the canopy
 * as one rounded mass. All foliage in the scene is one instanced draw call.
 */

function rng(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A bunch of leaves on transparent, drawn once. */
function leafTexture() {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const r = rng(9)
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * size * 0.4
    const x = size / 2 + Math.cos(a) * d
    const y = size / 2 + Math.sin(a) * d
    const g = 95 + r() * 70
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(r() * Math.PI * 2)
    ctx.fillStyle = `rgb(${g * 0.55 + r() * 20},${g},${g * 0.38})`
    ctx.beginPath()
    ctx.ellipse(0, 0, 9 + r() * 7, 4 + r() * 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

function foliageMaterial() {
  const mat = new MeshStandardMaterial({
    map: leafTexture(),
    alphaTest: 0.45,
    side: DoubleSide,
    roughness: 0.85,
    color: '#ffffff',
  })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute vec3 aCrownNormal;\n${shader.vertexShader}`.replace(
      '#include <beginnormal_vertex>',
      'vec3 objectNormal = aCrownNormal;\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif',
    )
    // Keep the crown normal on both faces instead of flipping it for backs.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''),
    )
  }
  return mat
}

/* ---------------- Planting plan ---------------- */

/**
 * The two young trees in front of the house in every ReMo elevation. Nothing
 * else stands inside the camera's orbit, so the house is never hidden.
 */
const FEATURE_TREES = [
  { x: -3.6, z: 7.2, h: 4.4, spread: 2.0 },
  { x: -0.4, z: 6.7, h: 3.8, spread: 1.7 },
]

/** A ring of mature trees around the property — the green backdrop in every ReMo render. */
function treeline(seed) {
  const r = rng(seed)
  const out = []
  const n = Math.round(70 * QUALITY.detail + 20)
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    const d = 46 + r() * 38
    out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, h: 9 + r() * 7, spread: 5 + r() * 3.5 })
  }
  return out
}

/** Low shrubs along the gravel beds. */
const SHRUBS = (() => {
  const r = rng(3)
  const out = []
  const edge = (xa, xb, z, n) => {
    for (let i = 0; i < n; i++) out.push({ x: xa + ((xb - xa) * (i + 0.2 + r() * 0.6)) / n, z: z + (r() - 0.5) * 0.25, s: 0.32 + r() * 0.2 })
  }
  edge(-7.4, 1.3, 4.6, 10)
  edge(4.4, 7.6, 4.6, 4)
  edge(-7.4, -4.1, -4.6, 4)
  edge(-2.4, 1.3, -4.6, 4)
  edge(4.3, 7.6, -4.6, 4)
  return out
})()

/* ---------------- Builder ---------------- */

function buildCards(trees, shrubs) {
  const r = rng(21)
  const cards = []
  const trunks = []
  const detail = QUALITY.detail

  for (const t of trees) {
    const crownY = t.h * 0.66
    const crown = new Vector3(t.x, crownY, t.z)
    const radius = t.spread
    const height = t.h * 0.42
    const n = Math.round((90 + radius * 26) * (0.5 + detail * 0.5))
    for (let i = 0; i < n; i++) {
      // Points biased toward the surface of an ellipsoid crown.
      const u = r() * 2 - 1
      const a = r() * Math.PI * 2
      const rr = Math.pow(r(), 0.35)
      const s = Math.sqrt(1 - u * u)
      const p = new Vector3(Math.cos(a) * s * radius * rr, u * height * rr, Math.sin(a) * s * radius * rr).add(crown)
      cards.push({ p, centre: crown, size: 0.9 + r() * 0.9 + radius * 0.06 })
    }
    trunks.push({ x: t.x, z: t.z, h: crownY, r: 0.05 + t.h * 0.012 })
  }

  for (const s of shrubs) {
    const centre = new Vector3(s.x, s.s * 0.8, s.z)
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2
      const u = r()
      const p = new Vector3(Math.cos(a) * s.s * 0.8 * (0.4 + u), s.s * (0.3 + r() * 0.9), Math.sin(a) * s.s * 0.8 * (0.4 + u)).add(new Vector3(s.x, 0, s.z))
      cards.push({ p, centre, size: 0.3 + r() * 0.2 })
    }
  }
  return { cards, trunks }
}

/** One instanced draw call of leaf cards (plus one for trunks). */
const NO_SHRUBS = []

/**
 * `fade` = [low, high] camera heights: fully visible below `low`, dissolved
 * away above `high` (dithered alpha, so no sorting and no pop).
 */
function CardCloud({ trees, shrubs = NO_SHRUBS, shadows, fade, handleRef }) {
  const m = useMaterials()
  const leaves = useRef(null)
  const trunkRef = useRef(null)

  const { cards, trunks, geometry, material, trunkGeometry } = useMemo(() => {
    const { cards, trunks } = buildCards(trees, shrubs)
    const geometry = new PlaneGeometry(1, 1)
    geometry.setAttribute('aCrownNormal', new InstancedBufferAttribute(new Float32Array(cards.length * 3), 3))
    const material = foliageMaterial()
    if (fade) Object.assign(material, { alphaTest: 0, alphaHash: true })
    return { cards, trunks, geometry, material, trunkGeometry: new CylinderGeometry(0.7, 1, 1, 7) }
  }, [trees, shrubs, fade])

  const group = useRef(null)

  // External fade (the construction chapter "grows" the planting in).
  // Dithered alpha while fading, crisp alpha-test once fully grown.
  useLayoutEffect(() => {
    if (!handleRef) return
    handleRef.current = {
      setOpacity(o) {
        const hashed = o < 0.999
        if (material.alphaHash !== hashed) {
          Object.assign(material, { alphaHash: hashed, alphaTest: hashed ? 0 : 0.45 })
          material.needsUpdate = true
        }
        material.opacity = o
        group.current.visible = o > 0.01
        trunkRef.current.visible = o > 0.4
      },
    }
  }, [handleRef, material])

  useFrame(({ camera }) => {
    if (!fade) return
    const k = Math.min(1, Math.max(0, (camera.position.y - fade[0]) / (fade[1] - fade[0])))
    const o = 1 - k * k * (3 - 2 * k)
    material.opacity = o
    group.current.visible = o > 0.01
    trunkRef.current.visible = o > 0.6
  })

  useLayoutEffect(() => {
    const d = new Object3D()
    const q = new Quaternion()
    const n = new Vector3()
    const up = new Vector3(0, 0.35, 0)
    const attr = geometry.getAttribute('aCrownNormal')
    const r = rng(77)
    cards.forEach((c, i) => {
      d.position.copy(c.p)
      d.rotation.set(r() * Math.PI, r() * Math.PI * 2, r() * Math.PI)
      d.scale.setScalar(c.size)
      d.updateMatrix()
      leaves.current.setMatrixAt(i, d.matrix)
      // Crown normal, expressed in the card's own (rotated) space.
      n.copy(c.p).sub(c.centre).add(up).normalize()
      q.copy(d.quaternion).invert()
      n.applyQuaternion(q)
      attr.setXYZ(i, n.x, n.y, n.z)
    })
    leaves.current.instanceMatrix.needsUpdate = true
    attr.needsUpdate = true

    trunks.forEach((t, i) => {
      d.position.set(t.x, t.h / 2, t.z)
      d.rotation.set(0, 0, 0)
      d.scale.set(t.r, t.h, t.r)
      d.updateMatrix()
      trunkRef.current.setMatrixAt(i, d.matrix)
    })
    trunkRef.current.instanceMatrix.needsUpdate = true
  }, [cards, trunks, geometry])

  return (
    <group ref={group}>
      <instancedMesh ref={leaves} args={[geometry, material, cards.length]} castShadow={shadows} receiveShadow={shadows} frustumCulled={false} />
      <instancedMesh ref={trunkRef} args={[trunkGeometry, m.bark, trunks.length]} castShadow={shadows} frustumCulled={false} />
    </group>
  )
}

const TREELINE = treeline(5)

/**
 * Planting near the house casts shadows; the distant treeline doesn't need
 * to — it is outside the shadow map anyway, and skipping it keeps thousands
 * of cards out of the shadow pass.
 *
 * The treeline is only for eye level, where the flat aerial photo would look
 * bare. From above, the photo's real trees and neighbours read correctly and
 * a ring of invented trees on their roofs would not — so it dissolves away
 * as the camera climbs.
 */
const TREELINE_FADE = [12, 26]
export function Foliage({ plantingRef }) {
  return (
    <group>
      <CardCloud trees={FEATURE_TREES} shrubs={SHRUBS} shadows handleRef={plantingRef} />
      <CardCloud trees={TREELINE} shadows={false} fade={TREELINE_FADE} />
    </group>
  )
}
