import { createStore } from '../core/store.js'

/**
 * Whether Zone Lab is open, and which lot a shared link asked for.
 * Kept free of map/three imports: the header imports this file, so anything
 * here lands in the site's first download.
 *
 * Links: #zone opens the map; #zone?apn=5089020034 opens straight onto a lot.
 */
const hash = typeof location !== 'undefined' ? location.hash : ''
const apnFromHash = (h) => {
  const m = h.match(/^#zone\?(?:.*&)?apn=([\d-]{10,12})/)
  return m ? m[1].replace(/\D/g, '') : null
}

export const zoneLab = createStore({
  open: hash.startsWith('#zone'),
  /** APN to open on arrival (from a shared link). */
  apn: apnFromHash(hash),
})

export const selectZoneLabOpen = (s) => s.open

export function openZoneLab() {
  zoneLab.set({ open: true })
  if (!location.hash.startsWith('#zone')) history.replaceState(null, '', '#zone')
}

export function closeZoneLab() {
  zoneLab.set({ open: false })
  if (location.hash.startsWith('#zone')) history.replaceState(null, '', location.pathname + location.search)
}

/** Keep the address bar pointing at the lot on screen, so it can be shared. */
export function setZoneLabLot(apn) {
  const next = apn ? `#zone?apn=${apn}` : '#zone'
  if (location.hash !== next) history.replaceState(null, '', next)
}

/** Shareable link to a lot. */
export const lotLink = (apn) => `${location.origin}${location.pathname}${location.search}#zone?apn=${apn}`
