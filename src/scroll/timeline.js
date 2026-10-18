import { clamp } from '../core/math.js'

/**
 * Pure: chapter list → the slice of global scroll progress each one owns.
 *
 * Global progress is 0 at the top of the journey section and 1 when its last
 * screen has scrolled past. A chapter with twice the `screens` gets twice the
 * slice, so pacing is edited in one number per chapter.
 */
export function buildTimeline(chapters) {
  const total = chapters.reduce((sum, c) => sum + c.screens, 0)
  let cursor = 0

  const windows = chapters.map((chapter, index) => {
    const start = cursor / total
    cursor += chapter.screens
    return { id: chapter.id, index, start, end: cursor / total }
  })

  return {
    windows,

    /** Which chapter owns `progress`, and how far through it we are (0..1). */
    resolve(progress) {
      const p = clamp(progress)
      let index = windows.length - 1
      for (let i = 0; i < windows.length; i++) {
        if (p < windows[i].end) {
          index = i
          break
        }
      }
      const w = windows[index]
      return { index, t: clamp((p - w.start) / (w.end - w.start)) }
    },

    /** Global progress for a chapter-local time — used by camera keys and the rail. */
    toGlobal(index, t = 0) {
      const w = windows[index]
      return w.start + (w.end - w.start) * t
    },
  }
}
