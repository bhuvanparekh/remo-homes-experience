/**
 * The SupReMo™ floor plan — the single source of truth for the 3D house and
 * the 2D mini-plan.
 *
 * Measured from ReMo's own furnished floor plan (remo.homes/our-homes), scaled
 * so the footprint is 1,365 sq ft: 15.68 × 8.09 m. Window and door positions
 * follow ReMo's elevation renders and Instagram posts.
 *
 * Coordinates are metres in plan: x = east (+) / west (−), z = south (+) /
 * north (−). The house is centred on the origin; the front door faces south,
 * toward the street. Heights are metres above the finished floor unless a
 * name says otherwise.
 */

export const HOUSE = {
  width: 15.68,
  depth: 8.09,
  /** Finished floor above grade — three steps up from the deck. */
  floorY: 0.55,
  ceiling: 2.7,
  extWall: 0.2,
  intWall: 0.12,
  /** Roof slab + parapet above the ceiling line. */
  roofThickness: 0.32,
}

const X0 = -HOUSE.width / 2
const X1 = HOUSE.width / 2
const Z0 = -HOUSE.depth / 2 // north / back
const Z1 = HOUSE.depth / 2 // south / front

export const BOUNDS = { x0: X0, x1: X1, z0: Z0, z1: Z1 }

/* ------------------------------------------------------------------ */
/* Openings                                                            */
/* ------------------------------------------------------------------ */

// Tall picture windows with wide black surrounds, as in every elevation render.
const TALL = { sill: 0.35, head: 2.35 }
const HIGH = { sill: 1.6, head: 2.2 } // bathroom / laundry clerestories
const DOOR = { sill: 0, head: 2.35 }

/**
 * Walls are segments from `a` to `b`. Each opening sits at `at` metres along
 * the segment from `a` (centre of the opening), `width` wide.
 * kind: 'window' | 'glassDoor' | 'door' (solid exterior) | 'interior' (doorway
 * with a leaf) | 'open' (plain opening, no leaf).
 */
export const EXTERIOR_WALLS = [
  {
    id: 'south',
    a: [X0, Z1],
    b: [X1, Z1],
    openings: [
      { id: 'w-bed2', kind: 'window', at: -6.04 - X0, width: 0.85, ...TALL },
      { id: 'w-bed3', kind: 'window', at: -2.54 - X0, width: 0.85, ...TALL },
      { id: 'front-door', kind: 'glassDoor', at: 2.84 - X0, width: 1.8, ...DOOR, open: true },
      { id: 'w-primary', kind: 'window', at: 5.9 - X0, width: 0.85, ...TALL },
    ],
  },
  {
    id: 'north',
    a: [X0, Z0],
    b: [X1, Z0],
    openings: [
      { id: 'w-bath2', kind: 'window', at: -6.45 - X0, width: 0.9, ...HIGH },
      { id: 'w-laundry', kind: 'window', at: -4.55 - X0, width: 0.8, ...HIGH },
      { id: 'laundry-door', kind: 'door', at: -3.3 - X0, width: 0.9, sill: 0, head: 2.1 },
      { id: 'w-kitchen', kind: 'window', at: -2.45 - X0, width: 0.55, sill: 1.05, head: 2.35 },
      { id: 'dining-door', kind: 'glassDoor', at: 2.75 - X0, width: 1.8, ...DOOR },
      { id: 'w-bath1', kind: 'window', at: 6.6 - X0, width: 0.9, ...HIGH },
    ],
  },
  {
    id: 'west',
    a: [X0, Z0],
    b: [X0, Z1],
    openings: [
      { id: 'w-nook', kind: 'window', at: -0.9 - Z0, width: 0.85, ...TALL },
      { id: 'w-bed2-side', kind: 'window', at: 2.42 - Z0, width: 0.7, sill: 0.6, head: 2.35 },
    ],
  },
  {
    id: 'east',
    a: [X1, Z0],
    b: [X1, Z1],
    openings: [{ id: 'w-primary-side', kind: 'window', at: 0.62 - Z0, width: 0.7, sill: 0.6, head: 2.35 }],
  },
]

export const INTERIOR_WALLS = [
  // Hallway north side: bath 2 and laundry behind it.
  { id: 'hall-n', a: [X0, -1.88], b: [-2.92, -1.88], openings: [{ id: 'd-bath2', kind: 'interior', at: -5.75 - X0, width: 0.8 }] },
  { id: 'bath2-laundry', a: [-5.13, Z0], b: [-5.13, -1.88], openings: [] },
  { id: 'laundry-e', a: [-2.92, Z0], b: [-2.92, -1.88], openings: [] },
  // Hallway south side, with the vestibule that serves both kids' rooms.
  { id: 'hall-s', a: [X0, 0.04], b: [-0.58, 0.04], openings: [{ id: 'vestibule', kind: 'open', at: -4.12 - X0, width: 1.1 }] },
  { id: 'bed2-e', a: [-4.75, 0.04], b: [-4.75, Z1], openings: [{ id: 'd-bed2', kind: 'interior', at: 0.56, width: 0.8 }] },
  { id: 'bed3-w', a: [-3.5, 0.04], b: [-3.5, Z1], openings: [{ id: 'd-bed3', kind: 'interior', at: 0.56, width: 0.8 }] },
  // Bedroom 3 east wall; the living room's TV wall is built onto its far face.
  { id: 'tv-wall', a: [-0.58, 0.04], b: [-0.58, Z1], openings: [] },
  // Great room / primary suite.
  { id: 'primary-w', a: [4.09, Z0], b: [4.09, Z1], openings: [{ id: 'd-primary', kind: 'interior', at: 0.66 - Z0, width: 0.85 }] },
  { id: 'bath1-s', a: [4.09, -1.71], b: [X1, -1.71], openings: [{ id: 'd-bath1', kind: 'interior', at: 5.92 - 4.09, width: 0.8 }] },
  { id: 'closet-s', a: [4.09, 0.03], b: [X1, 0.03], openings: [{ id: 'closet-way', kind: 'open', at: 5.92 - 4.09, width: 1.1 }] },
]

/* ------------------------------------------------------------------ */
/* Rooms (floors, 2D plan, labels)                                     */
/* ------------------------------------------------------------------ */

const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]

export const ROOMS_PLAN = [
  { id: 'bath2', name: 'Bath 2', floor: 'tile', poly: rect(X0, Z0, -5.13, -1.88) },
  { id: 'laundry', name: 'Laundry', floor: 'tile', poly: rect(-5.13, Z0, -2.92, -1.88) },
  { id: 'hall', name: 'Hall', floor: 'oak', poly: rect(X0, -1.88, -2.92, 0.04) },
  { id: 'bed2', name: 'Bedroom 2', floor: 'oak', poly: rect(X0, 0.04, -4.75, Z1) },
  { id: 'closets', name: 'Closets', floor: 'oak', poly: rect(-4.75, 0.04, -3.5, Z1) },
  { id: 'bed3', name: 'Bedroom 3', floor: 'oak', poly: rect(-3.5, 0.04, -0.58, Z1) },
  { id: 'kitchen', name: 'Kitchen', floor: 'oak', poly: rect(-2.92, Z0, 0.9, 0.04), label: [-1.0, -2.4] },
  { id: 'dining', name: 'Dining', floor: 'oak', poly: rect(0.9, Z0, 4.09, 0.04), label: [2.5, -1.6] },
  { id: 'living', name: 'Living', floor: 'oak', poly: rect(-0.58, 0.04, 4.09, Z1), label: [1.8, 2.0] },
  { id: 'bath1', name: 'Primary bath', floor: 'tile', poly: rect(4.09, Z0, X1, -1.71) },
  { id: 'walkin', name: 'Walk-in closet', floor: 'oak', poly: rect(4.09, -1.71, X1, 0.03) },
  { id: 'primary', name: 'Primary suite', floor: 'oak', poly: rect(4.09, 0.03, X1, Z1) },
]

/* ------------------------------------------------------------------ */
/* Outside                                                             */
/* ------------------------------------------------------------------ */

export const SITE = {
  /** Cleared lot from the aerial photo (scripts/build_assets.py). */
  lot: { w: 30, d: 24 },
  gravelBand: 0.9,
  decks: [
    // [x0, x1, depth outward, wall, steps]
    { id: 'front', x0: 1.55, x1: 4.15, depth: 1.25, side: 'south', steps: 3 },
    { id: 'dining', x0: 1.6, x1: 3.95, depth: 1.1, side: 'north', steps: 3 },
    { id: 'laundry', x0: -3.85, x1: -2.75, depth: 0.75, side: 'north', steps: 3 },
  ],
  canopies: [
    { id: 'front', x0: 1.35, x1: 4.35, depth: 1.05, side: 'south' },
    { id: 'dining', x0: 1.4, x1: 4.15, depth: 0.9, side: 'north' },
  ],
  solar: { rows: 3, cols: 11, x1: 7.35, z0: 0.35, panel: [1.0, 1.0], gap: 0.06 },
}
