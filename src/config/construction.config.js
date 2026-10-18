import { BOUNDS, HOUSE } from './floorplan.js'

/**
 * The build script for chapter 03, in chapter-local time (0..1).
 *
 * Each window matches one of ReMo's four method steps (METHOD in
 * content.config.js), plus landscaping at the end:
 *   design      the shared digital model is laid out over the bare lot
 *   approve     the design is signed off and the foundation goes in
 *   manufacture the first module is framed in steel, then closed in
 *   deliver     a truck brings each module; a crane sets it in place
 *   landscape   decks, path, lawn and planting
 *
 * The module split (four equal slabs across the long side, each ≈ 3.9 m ×
 * 8.1 m) is indicative — ReMo doesn't publish its module breakdown.
 */
export const BUILD = {
  design: [0, 0.2],
  approve: [0.2, 0.36],
  manufacture: [0.36, 0.56],
  deliver: [0.56, 0.9],
  landscape: [0.88, 1],
}

export const MODULE_COUNT = 4

const span = (BOUNDS.x1 - BOUNDS.x0) / MODULE_COUNT

/**
 * Plan slabs, west to east. The outer edges are open-ended so roof
 * overhangs and trim at the gable ends stay with their module.
 */
export const MODULES = Array.from({ length: MODULE_COUNT }, (_, i) => ({
  index: i,
  x0: i === 0 ? -100 : BOUNDS.x0 + span * i,
  x1: i === MODULE_COUNT - 1 ? 100 : BOUNDS.x0 + span * (i + 1),
  cx: BOUNDS.x0 + span * (i + 0.5),
}))

/** Height of a finished module from grade to the top of the solar rails. */
export const MODULE_TOP = HOUSE.floorY + HOUSE.ceiling + HOUSE.roofThickness + 0.25

/** Flatbed: parks alongside the east wall, long axis north–south. */
export const TRUCK = { x: 11.2, z: 0.4, bed: 1.25, enterZ: 52 }

/** Mobile crane: south-east of the house, within reach of every slot and the truck. */
export const CRANE = { x: 13.5, z: 10.5, pivotY: 3.1, boom: 24 }
