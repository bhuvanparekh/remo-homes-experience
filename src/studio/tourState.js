import { createStore } from '../core/store.js'

/**
 * Playhead of the walkthrough. The camera advances `t` every frame; the HUD
 * reads only the coarse values (stop, playing, ended, fade) through React,
 * and the per-frame ones (progress bar, map marker) through `tourRefs`.
 */
export const tourState = createStore({ t: 0, playing: true, stop: 0, ended: false, fade: false, snap: false })

/** DOM nodes the camera writes to directly each frame. */
export const tourRefs = { marker: null, progress: null }

export const selectStop = (s) => s.stop
export const selectPlaying = (s) => s.playing
export const selectEnded = (s) => s.ended
export const selectFade = (s) => s.fade

/** Jump to a stop behind a quick fade, so the camera never sweeps through walls. */
export function jumpToStop(tour, index) {
  const i = Math.max(0, Math.min(tour.stops.length - 1, index))
  tourState.set({ fade: true })
  setTimeout(() => {
    tourState.set({ t: tour.stops[i].at, stop: i, playing: true, ended: false, snap: true })
    setTimeout(() => tourState.set({ fade: false }), 80)
  }, 260)
}

export function restartTour() {
  tourState.set({ t: 0, stop: 0, playing: true, ended: false, fade: false, snap: true })
}
