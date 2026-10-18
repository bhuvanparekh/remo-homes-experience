import { HOUSE } from './floorplan.js'
import { ROOMS } from './content.config.js'

/**
 * The walkthrough script (chapter 05): where the camera stops, what each stop
 * is called on the mini-plan, and which features get an arrow label.
 *
 * Times are chapter-local (0..1). At each stop the camera *holds* for `hold`
 * so the visitor can look; the caption, labels and ReMo's own render all hang
 * off that hold, which is what keeps text and camera in step. Moves between
 * stops pass through `via` keys (doorways), so the camera never cuts a wall.
 *
 * Positions are world metres (floor is at HOUSE.floorY). Each stop is posed
 * to roughly match the viewpoint of ReMo's render of that room, so the
 * cross-fade into the render reads as "this is the real thing".
 */

const EYE = HOUSE.floorY + 1.55
const F = HOUSE.floorY
/** Anchor on a piece of the house: plan x, height above the floor, plan z. */
const at = (x, h, z) => [x, F + h, z]

export const TOUR_HOLD = 0.08

export const TOUR_STOPS = [
  {
    room: 'entry',
    plan: null,
    at: 0.06,
    // Three-quarter view from the front path, like ReMo's entry render.
    pos: [6.2, EYE - 0.2, 11.2],
    look: [1.4, F + 1.1, 3.2],
    labels: [
      // ReMo's own Instagram callouts for the front elevation.
      { text: 'Installed in as little as 3 days', anchor: at(-1.5, 2.5, 4.05), dx: -150, dy: -110 },
      { text: 'Designed for wildfire resilience', anchor: at(7.84, 1.4, 2.0), dx: 110, dy: -120 },
    ],
  },
  { via: true, at: 0.12, pos: [3.3, EYE, 6.9], look: [2.84, F + 1.3, 2.0] },
  { via: true, at: 0.16, pos: [2.84, EYE, 4.7], look: [2.4, F + 1.2, 0] },
  {
    room: 'living',
    plan: 'living',
    at: 0.24,
    pos: [3.05, EYE, 2.75],
    look: [-0.5, F + 0.9, 1.4],
    labels: [
      { text: 'Built-in media wall', anchor: at(-0.45, 2.39, 1.4), dx: 60, dy: -90 },
      { text: 'Open kitchen + living area', anchor: at(-0.3, 1.0, -1.5), dx: 90, dy: -120 },
    ],
  },
  {
    room: 'kitchen',
    plan: 'kitchen',
    at: 0.4,
    pos: [1.75, EYE, -0.1],
    look: [-1.3, F + 0.95, -2.7],
    labels: [
      { text: 'Waterfall marble island', anchor: at(0.3, 0.7, -1.06), dx: 130, dy: 70 },
      { text: 'All-electric induction kitchen', anchor: at(-0.92, 0.92, -3.45), dx: -170, dy: -150 },
      { text: 'Open oak shelving', anchor: at(-2.0, 1.86, -3.72), dx: -120, dy: 120 },
    ],
  },
  {
    room: 'dining',
    plan: 'dining',
    at: 0.55,
    pos: [0.85, EYE, 0.25],
    look: [3.1, F + 0.9, -2.7],
    labels: [
      { text: 'Glass doors to the back deck', anchor: at(2.75, 1.7, -4.0), dx: 110, dy: -110 },
      { text: 'Floor-to-ceiling storage', anchor: at(1.42, 1.2, -3.5), dx: -150, dy: 110 },
    ],
  },
  { via: true, at: 0.64, pos: [3.35, EYE, 0.7], look: [6.6, F + 1.1, 1.3] },
  { via: true, at: 0.69, pos: [4.55, EYE, 0.95], look: [6.5, F + 1.0, 2.4] },
  {
    room: 'primarySuite',
    plan: 'primary',
    at: 0.77,
    pos: [4.95, EYE, 3.72],
    look: [6.3, F + 0.85, -0.6],
    labels: [
      // ReMo's own Instagram callout for the suite.
      { text: 'Walk-in closet + en suite bathroom', anchor: at(5.92, 1.5, 0.03), dx: -60, dy: -140 },
      { text: 'Built-in wardrobe wall', anchor: at(4.77, 1.6, 2.2), dx: -140, dy: 60 },
    ],
  },
  { via: true, at: 0.85, pos: [5.92, EYE, 0.45], look: [5.92, F + 1.2, -3.0] },
  { via: true, at: 0.89, pos: [5.95, EYE, -1.75], look: [5.3, F + 1.1, -3.6] },
  {
    room: 'bath',
    plan: 'bath1',
    at: 0.94,
    pos: [6.1, EYE, -1.85],
    look: [5.1, F + 1.3, -3.85],
    labels: [
      { text: 'Double vanity', anchor: at(6.75, 0.75, -3.55), dx: 90, dy: 80 },
      { text: 'Walk-in glass shower', anchor: at(4.9, 1.5, -2.7), dx: -150, dy: -90 },
    ],
  },
]

const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r]))
export const STOPS = TOUR_STOPS.filter((s) => !s.via).map((s, i, all) => ({
  ...s,
  index: i,
  total: all.length,
  content: ROOM_BY_ID[s.room],
  /** The window the camera stands still in. */
  from: s.at - TOUR_HOLD / 2,
  to: s.at + TOUR_HOLD / 2,
}))

/**
 * Camera keys for the chapter: two identical keys per stop (the hold — see
 * cameraPath's `hold` handling) and one per doorway.
 */
export function tourCameraKeys() {
  return TOUR_STOPS.flatMap((s) =>
    s.via
      ? [{ at: s.at, pos: s.pos, look: s.look }]
      : [
          { at: s.at - TOUR_HOLD / 2, pos: s.pos, look: s.look, hold: s.room },
          { at: s.at + TOUR_HOLD / 2, pos: s.pos, look: s.look, hold: s.room },
        ],
  )
}

/** Room captions, from shortly before the camera arrives to shortly after it leaves. */
export function tourBeats() {
  return STOPS.map((s) => ({
    from: s.from - 0.035,
    to: s.to + 0.03,
    fade: 0.025,
    kind: 'room',
    data: { ...s.content, index: s.index, total: s.total },
    align: 'left',
  }))
}

/**
 * Within a stop's hold: the arrow labels show first, then ReMo's render of the
 * room fades in over the 3D view for the second half of the hold.
 */
export const labelWindow = (s) => [s.from - 0.015, s.at + TOUR_HOLD * 0.12]
export const renderWindow = (s) => [s.at + TOUR_HOLD * 0.05, s.to + 0.025]

/**
 * The roof-off room picker at the end of the orbit (chapter 04, local time):
 * the roof lifts off while the camera rises overhead, rooms are pickable
 * during the hold, and the roof returns before the walk to the front door.
 */
export const PICKER = { cut: [0.5, 0.6], hold: [0.62, 0.84], restore: [0.86, 0.94] }
