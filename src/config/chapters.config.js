import { HERO, STATS, SITE, METHOD, HOME, PICKER_COPY, VISIT } from './content.config.js'
import { PICKER, tourBeats, tourCameraKeys } from './tour.config.js'
import { BUILD } from './construction.config.js'

/**
 * The journey script: six chapters, one continuous camera move.
 *
 * `screens` is how many viewport-heights of scrolling a chapter gets — it sets
 * pacing, not order. `camera` keyframes use chapter-local time (0..1) and are
 * joined across chapters into one spline, so a chapter's first key should sit
 * where the previous chapter's last one left off. `sky` names a palette in
 * stage/skyPalettes.js. `beats` are the overlay captions, timed in local t.
 *
 * World units are metres. The SupReMo sits at the origin, long side on X,
 * front door facing +Z (footprint ≈ 15.4 × 8.2 m from ReMo's floor plan).
 *
 * North is -Z: the opening looks north over the cloud deck at the San Gabriel
 * Mountains (real 3DEP terrain), then dives onto the cleared Altadena lot.
 */
export const CHAPTERS = [
  {
    id: 'descent',
    n: '01',
    label: 'Descent',
    screens: 3,
    sky: 'dawn',
    camera: [
      { at: 0, pos: [-400, 1650, 2600], look: [200, 1150, -6000] },
      { at: 0.3, pos: [-260, 1500, 1500], look: [0, 700, -2600] },
      { at: 0.55, pos: [-120, 1180, 650], look: [0, 0, -300] },
      { at: 0.75, pos: [-40, 820, 260], look: [0, 0, -40] },
      { at: 1, pos: [-10, 480, 110], look: [0, 0, 0] },
    ],
    beats: [
      { from: 0, to: 0.62, kind: 'hero', data: HERO, align: 'center', sticky: 'start' },
      { from: 0.8, to: 1.02, kind: 'line', data: { text: 'Through the clouds, down to one California lot.' }, align: 'center' },
    ],
  },
  {
    id: 'site',
    n: '02',
    label: 'The site',
    screens: 2.5,
    sky: 'morning',
    camera: [
      { at: 0.4, pos: [0, 260, 40], look: [0, 0, 0] },
      { at: 1, pos: [0, 150, 0.5], look: [0, 0, 0] },
    ],
    beats: [
      { from: 0, to: 0.46, kind: 'text', data: SITE, align: 'left' },
      { from: 0.5, to: 1, kind: 'stats', data: STATS, align: 'bottom' },
    ],
  },
  {
    id: 'construction',
    n: '03',
    label: 'Construction',
    screens: 6,
    sky: 'day',
    // The build itself is scripted in construction.config.js; these keys
    // follow it: overhead for the design, down to the truck for manufacture,
    // wide for the crane, low for the finished landscape.
    camera: [
      { at: 0.1, pos: [6, 46, 34], look: [0, 0, 0] },
      { at: 0.2, pos: [14, 28, 30], look: [0, 1, 0] },
      { at: 0.3, pos: [22, 16, 22], look: [0, 0.5, 0] },
      { at: 0.44, pos: [3.5, 4.5, 13], look: [11.2, 2.8, 0.4] },
      { at: 0.54, pos: [24, 9, 20], look: [9, 3, 0] },
      { at: 0.64, pos: [28, 17, 28], look: [2, 3, 0] },
      { at: 0.78, pos: [6, 24, 36], look: [0, 3, 0] },
      { at: 0.9, pos: [-16, 15, 30], look: [0, 2, 0] },
      { at: 1, pos: [-22, 8, 24], look: [0, 1.5, 0] },
    ],
    beats: [
      ...METHOD.map((step, i) => {
        const window = [BUILD.design, BUILD.approve, BUILD.manufacture, [BUILD.deliver[0], BUILD.landscape[0]]][i]
        return { from: window[0], to: window[1] + 0.01, kind: 'step', data: step, align: 'left' }
      }),
      // ReMo's own Instagram line for the finished house.
      { from: BUILD.landscape[0] + 0.01, to: 1.02, kind: 'line', data: { text: 'Installed in as little as 3 days.' }, align: 'bottom' },
    ],
  },
  {
    id: 'home',
    n: '04',
    label: 'The SupReMo',
    screens: 4,
    sky: 'golden',
    // A full orbit — west, back, east, front — then up overhead while the
    // roof is cut away for the room picker (PICKER in tour.config.js), and
    // down to the front door.
    camera: [
      { at: 0.08, pos: [-26, 6.5, -4], look: [0, 1.8, 0] },
      { at: 0.2, pos: [-6, 6.5, -26], look: [0, 1.8, 0] },
      { at: 0.32, pos: [22, 6, -16], look: [0, 1.8, 0] },
      { at: 0.44, pos: [26, 5.5, 12], look: [0, 1.8, 0] },
      { at: 0.54, pos: [14, 16, 17], look: [5, 0.5, 0.3] },
      { at: PICKER.hold[0], pos: [5.5, 26.5, 6.6], look: [5.5, 0, 0.3], hold: 'picker' },
      { at: PICKER.hold[1], pos: [5.5, 26.5, 6.6], look: [5.5, 0, 0.3], hold: 'picker' },
      { at: 1, pos: [2.84, 2.3, 14], look: [2.84, 1.9, 0] },
    ],
    beats: [
      { from: 0, to: 0.42, kind: 'specs', data: HOME, align: 'left' },
      { from: PICKER.hold[0] - 0.04, to: PICKER.hold[1] + 0.02, kind: 'picker', data: PICKER_COPY, align: 'right' },
      { from: 0.88, to: 1, kind: 'line', data: { text: HOME.quiet.join(' ') }, align: 'center' },
    ],
  },
  {
    id: 'tour',
    n: '05',
    label: 'Walkthrough',
    screens: 8,
    sky: 'interior',
    // Stops, doorways, captions and labels live in tour.config.js.
    camera: tourCameraKeys(),
    beats: tourBeats(),
  },
  {
    id: 'visit',
    n: '06',
    label: 'Visit',
    screens: 1.6,
    sky: 'dusk',
    camera: [
      { at: 0.06, pos: [5.92, 2.15, -0.4], look: [5.0, 1.8, 1.0] },
      { at: 0.16, pos: [5.0, 2.15, 0.7], look: [2.0, 1.8, 0.66] },
      { at: 0.26, pos: [3.4, 2.15, 0.8], look: [2.8, 1.8, 4.0] },
      { at: 0.38, pos: [2.84, 2.15, 3.0], look: [2.84, 1.9, 8.0] },
      { at: 0.5, pos: [2.84, 2.4, 9.5], look: [2.84, 1.9, 0] },
      { at: 0.75, pos: [-12, 4, 20], look: [-2, 2.2, 1] },
      // Final frame: the lit house on the right, the visit card on the left.
      { at: 1, pos: [-17, 4.2, 22], look: [-7.5, 2.6, 3] },
    ],
    beats: [
      // ReMo's own Instagram line, as we step back out into the evening.
      { from: 0.08, to: 0.34, kind: 'line', data: { text: 'We’re proud to build for California communities.' }, align: 'center' },
      { from: 0.36, to: 1.01, kind: 'visit', data: VISIT, align: 'left', sticky: 'end' },
    ],
  },
]

export const TOTAL_SCREENS = CHAPTERS.reduce((sum, c) => sum + c.screens, 0)
