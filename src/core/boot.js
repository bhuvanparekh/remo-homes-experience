import { createStore } from './store.js'

/**
 * Boot state shared by the stage and the splash: `ready` turns true once the
 * 3D world (or its no-WebGL fallback) can be shown, so the splash knows when
 * it may open.
 */
export const boot = createStore({ ready: false })
export const selectReady = (s) => s.ready
