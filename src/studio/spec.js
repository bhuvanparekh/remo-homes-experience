/**
 * What the visitor can ask for in the "Design yours" studio, and the limits.
 *
 * The form works in feet (ReMo builds in California); everything in 3D is
 * metres. Setbacks are typical Los Angeles single-family values and are shown
 * to the visitor as an assumption, never as a rule for their lot.
 */

export const FT = 0.3048
export const toFt = (m) => m / FT
export const sqft = (m2) => m2 / (FT * FT)

export const DEFAULT_SPEC = {
  lotW: 50,
  lotD: 120,
  /** Which side of the lot the street runs along. */
  street: 'south',
  bedrooms: 3,
  baths: 2,
  office: false,
  laundry: true,
  frontDeck: true,
  backDeck: true,
}

export const LIMITS = {
  lotW: { min: 30, max: 120, step: 5 },
  lotD: { min: 60, max: 200, step: 5 },
  bedrooms: { min: 1, max: 4 },
  baths: { min: 1, max: 3 },
}

/** Typical LA R1 setbacks, in feet. */
export const SETBACKS_FT = { front: 20, side: 5, rear: 15 }

export const STREET_SIDES = [
  { id: 'north', label: 'N' },
  { id: 'east', label: 'E' },
  { id: 'south', label: 'S' },
  { id: 'west', label: 'W' },
]

export const EXTRAS = [
  { id: 'office', label: 'Home office' },
  { id: 'laundry', label: 'Laundry room' },
  { id: 'frontDeck', label: 'Front porch' },
  { id: 'backDeck', label: 'Back deck' },
]

/** Keeps a spec inside the limits (baths never outnumber bedrooms + 1). */
export function clampSpec(spec) {
  const c = (v, { min, max }) => Math.min(max, Math.max(min, v))
  const bedrooms = c(spec.bedrooms, LIMITS.bedrooms)
  return {
    ...spec,
    lotW: c(spec.lotW, LIMITS.lotW),
    lotD: c(spec.lotD, LIMITS.lotD),
    bedrooms,
    baths: Math.min(c(spec.baths, LIMITS.baths), bedrooms + 1),
  }
}

/* ---------- Shareable links ---------- */

const FLAGS = ['office', 'laundry', 'frontDeck', 'backDeck']

/**
 * A design as a URL hash, e.g.
 * #design?w=50&d=120&street=south&bed=3&bath=2&x=0111&style=signature
 */
export function designHash(spec, style) {
  const q = new URLSearchParams({
    w: spec.lotW,
    d: spec.lotD,
    street: spec.street,
    bed: spec.bedrooms,
    bath: spec.baths,
    x: FLAGS.map((f) => (spec[f] ? 1 : 0)).join(''),
    style,
  })
  return `#design?${q}`
}

/** The design in a hash like the one above, or null if there isn't one. */
export function readDesignHash(hash) {
  if (!hash?.startsWith('#design?')) return null
  const q = new URLSearchParams(hash.slice('#design?'.length))
  const num = (k, fallback) => (Number.isFinite(Number(q.get(k))) && q.get(k) !== null ? Number(q.get(k)) : fallback)
  const x = q.get('x') ?? ''
  const spec = clampSpec({
    ...DEFAULT_SPEC,
    lotW: num('w', DEFAULT_SPEC.lotW),
    lotD: num('d', DEFAULT_SPEC.lotD),
    street: STREET_SIDES.some((s) => s.id === q.get('street')) ? q.get('street') : DEFAULT_SPEC.street,
    bedrooms: num('bed', DEFAULT_SPEC.bedrooms),
    baths: num('bath', DEFAULT_SPEC.baths),
    ...Object.fromEntries(FLAGS.map((f, i) => [f, x[i] === undefined ? DEFAULT_SPEC[f] : x[i] === '1'])),
  })
  return { spec, style: q.get('style') }
}
