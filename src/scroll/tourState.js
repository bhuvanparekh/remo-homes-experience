import { createStore } from '../core/store.js'

/**
 * State the walkthrough overlay and the 3D scene share.
 *
 * `modes` is visitor-controlled (the X-ray and render toggles) and changes
 * rarely, so it is a normal store. `liveCamera` and `labelEls` are per-frame
 * plumbing between the canvas and the DOM: the in-canvas TourTracker writes
 * the real (damped) camera into `liveCamera` and positions the label elements
 * the overlay registered in `labelEls`. No React render on a frame tick.
 */
// ?xray opens with the frame showing (for review and screenshots).
const startXray = typeof location !== 'undefined' && new URLSearchParams(location.search).has('xray')

export const modes = createStore({ xray: startXray, renders: true })

export const selectXray = (s) => s.xray
export const selectRenders = (s) => s.renders

/** Camera position (world metres) and plan heading (radians, atan2(z, x)). */
export const liveCamera = { x: 0, y: 0, z: 0, heading: 0 }

/** label key → { root, path, head, anchor: [x,y,z], dx, dy, stop } */
export const labelEls = new Map()

/**
 * The roof-off room picker (chapter 04): which plan room is hovered, from
 * either the 3D model or the list card, so both light up together.
 */
export const picker = createStore({ hover: null })
export const selectHover = (s) => s.hover
