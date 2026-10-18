import Lenis from 'lenis'
// Lenis ships the html/body rules it needs to take over scrolling. Without
// this the page can end up with both native and smoothed scrolling fighting.
import 'lenis/dist/lenis.css'

/**
 * Smooth-scroll abstraction (Dependency Inversion).
 *
 * The tour depends on this small interface — `update`, `scrollTo`, `destroy` —
 * not on Lenis. Swapping in a different smoothing library, or dropping smooth
 * scrolling entirely for reduced-motion users, changes only this file.
 */

function createNativeDriver() {
  return {
    update() {},
    scrollTo(y, { immediate = false } = {}) {
      window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' })
    },
    destroy() {},
  }
}

function createLenisDriver() {
  const lenis = new Lenis({
    // Slightly heavier than default: the camera is following this, and a little
    // extra weight is what separates "premium" from "slippery".
    lerp: 0.085,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.6,
  })

  return {
    update(timeMs) {
      lenis.raf(timeMs)
    },
    scrollTo(y, { immediate = false } = {}) {
      lenis.scrollTo(y, { duration: immediate ? 0 : 1.6, immediate })
    },
    destroy() {
      lenis.destroy()
    },
  }
}

export function createScrollDriver({ smooth = true } = {}) {
  return smooth ? createLenisDriver() : createNativeDriver()
}
