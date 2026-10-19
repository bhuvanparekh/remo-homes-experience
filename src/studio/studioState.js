import { createStore } from '../core/store.js'
import { DEFAULT_SPEC, readDesignHash } from './spec.js'

/**
 * Whether the "Design yours" studio is open, plus the visitor's last answers
 * (kept here so closing and reopening the studio doesn't lose them).
 *
 * The main journey canvas watches `open` and stops rendering while the studio
 * is up, so the two 3D scenes never compete for the GPU.
 */
const hash = typeof location !== 'undefined' ? location.hash : ''
// A shared link (#design?w=…) opens the studio with that design filled in.
const shared = readDesignHash(hash)

export const studio = createStore({
  open: hash.startsWith('#design'),
  spec: shared ? shared.spec : { ...DEFAULT_SPEC },
  /** 'brief' | 'massing' | 'house' | 'interior' */
  stage: 'brief',
  /** Furthest step reached (index into the step pills). */
  reached: -1,
  // Checked against the real list when the studio loads (styles.js pulls in three.js).
  style: shared?.style || 'signature',
})

export const selectOpen = (s) => s.open

export function openStudio() {
  studio.set({ open: true })
  if (!location.hash.startsWith('#design')) history.replaceState(null, '', '#design')
}

export function closeStudio() {
  studio.set({ open: false })
  if (location.hash.startsWith('#design')) history.replaceState(null, '', location.pathname + location.search)
}
