import { useEffect, useRef, useState } from 'react'

/**
 * A ~40 line observable store.
 *
 * Why not Zustand/Redux: the tour writes state 60 times a second. The rule that
 * keeps this app fast is "React never re-renders on a frame tick". So the hot
 * consumers (camera rig, label projector) read `store.get()` imperatively inside
 * their own animation frame, and only the *coarse* consumers (which zone are we
 * in?) subscribe through React. A dependency would not have made that clearer.
 */
export function createStore(initialState) {
  let state = initialState
  const listeners = new Set()

  return {
    get: () => state,

    /** Mutates in place — no allocation per frame. Listeners always fire. */
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch
      Object.assign(state, next)
      for (const listener of listeners) listener(state)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * Subscribe to a *slice* of a store and re-render only when that slice changes.
 *
 * `selector` must be stable across renders (define it at module scope). Because
 * the store mutates in place, the selector has to return a primitive or a value
 * compared by `isEqual` — never a fresh object with default equality.
 */
export function useStoreValue(store, selector, isEqual = Object.is) {
  const [value, setValue] = useState(() => selector(store.get()))
  const latest = useRef(value)

  useEffect(() => {
    const check = (state) => {
      const next = selector(state)
      if (!isEqual(latest.current, next)) {
        latest.current = next
        setValue(next)
      }
    }
    check(store.get())
    return store.subscribe(check)
  }, [store, selector, isEqual])

  return value
}

/** Shallow array equality, for selectors that return lists of ids. */
export const arrayEquals = (a, b) =>
  a === b || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]))
