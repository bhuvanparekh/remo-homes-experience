import { useLayoutEffect, useRef } from 'react'
import { Box3, BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, Plane, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Every clipped clone made from a shared material, so X-ray can ghost them too. */
export const CLIPPED = new Map()

const EPS = 1e-3
const KEEP = ['position', 'normal', 'uv']

/** Non-indexed copy keeping only the attributes every part shares. */
function flat(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name)
  return g
}

/**
 * Splits a multi-material geometry (a wall: panel outside, plaster inside)
 * into one plain geometry per material, so walls merge like everything else
 * instead of costing a draw call per face.
 */
function splitByGroup(geometry, materials) {
  const g = flat(geometry)
  const out = []
  for (const group of g.groups) {
    const part = new BufferGeometry()
    for (const name of KEEP) {
      const attr = g.attributes[name]
      if (!attr) continue
      const n = attr.itemSize
      part.setAttribute(name, new BufferAttribute(attr.array.slice(group.start * n, (group.start + group.count) * n), n))
    }
    out.push([part, materials[group.materialIndex]])
  }
  g.dispose()
  return out
}

/**
 * Cuts the house into factory modules the construction chapter can move.
 *
 * The house is authored whole (walls run the full length), so instead of
 * re-modelling it per module, every mesh is assigned to each module slab it
 * overlaps and rendered there with clipping planes at the slab's edges. A
 * wall crossing a seam appears in both modules, each copy cut exactly at the
 * seam; once every module is home the pieces meet and the house is whole.
 *
 * It also does StaticBatch's job, and more: static meshes — including
 * multi-material walls, split by face — are merged per (module, material),
 * so the finished house costs a few dozen draw calls.
 *
 * Each module also has a "top" plane — the reveal height — used to show a
 * module being closed in from the floor up while it's manufactured.
 *
 * `onReady(api)` hands the construction animator: setOffset(i, x, y, z),
 * setReveal(i, height) and units (with each module's group and planes).
 */
export function ModularBatch({ modules, onReady, children }) {
  const root = useRef(null)

  useLayoutEffect(() => {
    const group = root.current
    group.updateWorldMatrix(true, true)
    const toLocal = new Matrix4().copy(group.matrixWorld).invert()

    const units = modules.map((m) => {
      const unit = {
        ...m,
        group: new Group(),
        offset: new Vector3(),
        reveal: 1000,
        left: new Plane(new Vector3(1, 0, 0), -m.x0),
        right: new Plane(new Vector3(-1, 0, 0), m.x1),
        top: new Plane(new Vector3(0, -1, 0), 1000),
        materials: new Map(),
      }
      unit.planes = [unit.left, unit.right, unit.top]
      unit.group.name = `module-${m.index}`
      group.add(unit.group)
      return unit
    })

    const clip = (unit, mat) => {
      let c = unit.materials.get(mat)
      if (!c) {
        c = mat.clone()
        c.clippingPlanes = unit.planes
        c.clipShadows = true
        unit.materials.set(mat, c)
        if (!CLIPPED.has(mat)) CLIPPED.set(mat, [])
        CLIPPED.get(mat).push(c)
      }
      return c
    }

    const meshes = []
    group.traverse((o) => {
      if (o.isMesh && !units.some((u) => u.group === o.parent)) meshes.push(o)
    })

    const box = new Box3()
    const buckets = new Map()
    // The assembled house: the same pieces merged per original material with
    // no clipping, shown once every module is home (the cheapest form).
    const whole = new Group()
    whole.name = 'assembled'
    group.add(whole)
    const wholeBuckets = new Map()
    const loose = []
    const looseOriginals = []
    const absorbed = []

    for (const obj of meshes) {
      box.setFromObject(obj)
      const hits = units.filter((u) => box.max.x > u.x0 + EPS && box.min.x < u.x1 - EPS)
      if (!hits.length) continue
      const local = new Matrix4().multiplyMatrices(toLocal, obj.matrixWorld)
      const multi = Array.isArray(obj.material)
      const opaque = multi ? obj.material.every((m) => !m.transparent) : !obj.material.transparent
      const mergeable = !obj.isInstancedMesh && opaque && obj.renderOrder === 0
      const pieces = mergeable ? (multi ? splitByGroup(obj.geometry, obj.material) : [[flat(obj.geometry), obj.material]]) : null

      if (mergeable) {
        for (const [geometry, material] of pieces) {
          const key = `${material.uuid}|${obj.castShadow}|${obj.receiveShadow}`
          if (!wholeBuckets.has(key)) wholeBuckets.set(key, { unit: null, material, cast: obj.castShadow, receive: obj.receiveShadow, parts: [] })
          wholeBuckets.get(key).parts.push(geometry.clone().applyMatrix4(local))
        }
      } else {
        looseOriginals.push(obj)
      }

      for (const u of hits) {
        if (mergeable) {
          for (const [geometry, material] of pieces) {
            const mat = clip(u, material)
            const key = `${u.index}|${mat.uuid}|${obj.castShadow}|${obj.receiveShadow}`
            if (!buckets.has(key)) buckets.set(key, { unit: u, material: mat, cast: obj.castShadow, receive: obj.receiveShadow, parts: [] })
            const g = geometry.clone()
            g.applyMatrix4(local)
            buckets.get(key).parts.push(g)
          }
        } else {
          // Glass and other see-through pieces: one clipped copy per module.
          const c = obj.clone(false)
          c.material = Array.isArray(obj.material) ? obj.material.map((m) => clip(u, m)) : clip(u, obj.material)
          c.matrixAutoUpdate = false
          c.matrix.copy(local)
          u.group.add(c)
          loose.push(c)
        }
      }
      if (pieces) for (const [g] of pieces) g.dispose()
      absorbed.push(obj)
    }
    for (const obj of absorbed) obj.visible = false

    const merged = []
    for (const { unit, material, cast, receive, parts } of [...buckets.values(), ...wholeBuckets.values()]) {
      const geometry = mergeGeometries(parts, false)
      for (const p of parts) p.dispose()
      if (!geometry) continue
      geometry.computeBoundingSphere()
      const mesh = new Mesh(geometry, material)
      mesh.castShadow = cast
      mesh.receiveShadow = receive
      mesh.matrixAutoUpdate = false
      ;(unit ? unit.group : whole).add(mesh)
      merged.push(mesh)
    }

    let assembled = null
    const setAssembled = (on) => {
      if (on === assembled) return
      assembled = on
      whole.visible = on
      for (const u of units) u.group.visible = !on
      for (const o of looseOriginals) o.visible = on
    }

    const sync = (u) => {
      u.left.constant = -(u.x0 + u.offset.x)
      u.right.constant = u.x1 + u.offset.x
      u.top.constant = u.offset.y + u.reveal
    }

    setAssembled(true)
    onReady?.({
      units,
      /** true: the single merged house; false: separate, movable modules. */
      setAssembled,
      /** Merged meshes of the assembled house drawn with any of `materials`. */
      wholeMeshes: (materials) => whole.children.filter((m) => materials.includes(m.material)),
      setOffset(i, x, y, z) {
        const u = units[i]
        u.offset.set(x, y, z)
        u.group.position.copy(u.offset)
        sync(u)
      },
      setReveal(i, height) {
        units[i].reveal = height
        sync(units[i])
      },
    })

    return () => {
      for (const u of units) {
        group.remove(u.group)
        for (const c of u.materials.values()) c.dispose()
        for (const [orig, clones] of CLIPPED) {
          const kept = clones.filter((c) => !u.materials.has(orig) || u.materials.get(orig) !== c)
          if (kept.length) CLIPPED.set(orig, kept)
          else CLIPPED.delete(orig)
        }
      }
      group.remove(whole)
      for (const m of merged) m.geometry.dispose()
      for (const obj of absorbed) obj.visible = true
    }
  }, [modules, onReady])

  return <group ref={root}>{children}</group>
}
