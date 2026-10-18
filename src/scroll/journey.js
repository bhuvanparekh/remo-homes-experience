import { CHAPTERS } from '../config/chapters.config.js'
import { createStore } from '../core/store.js'
import { buildTimeline } from './timeline.js'
import { buildCameraPath } from './cameraPath.js'

/**
 * The single source of truth for "where are we in the journey".
 *
 * Written once per frame by JourneyProvider; read imperatively by anything
 * that animates (camera, captions, sky) and through `useStoreValue` by the
 * few things that only care when the chapter changes.
 */
export const timeline = buildTimeline(CHAPTERS)
export const cameraPath = buildCameraPath(CHAPTERS, timeline)

export const journey = createStore({
  progress: 0,
  index: 0,
  t: 0,
})

export const selectIndex = (s) => s.index
