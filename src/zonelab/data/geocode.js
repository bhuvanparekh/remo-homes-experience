import { getJSON } from './arcgis.js'

/**
 * Address search through Esri's World Geocoding Service, used without a key
 * for interactive search (results aren't stored). The UI credits it as
 * "Search by Esri". Searches are kept to the Los Angeles area.
 */

const BASE = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer'

/** City of Los Angeles bounding box (lng/lat), with a small margin. */
export const LA_EXTENT = [-118.68, 33.69, -118.14, 34.35]
const EXTENT = LA_EXTENT.join(',')
const CENTER = '-118.35,34.05'

/** Autocomplete suggestions while typing. */
export async function suggest(text, { signal } = {}) {
  if (!text || text.trim().length < 3) return []
  const url = `${BASE}/suggest?text=${encodeURIComponent(text)}&location=${CENTER}&searchExtent=${EXTENT}&category=Address,Postal,Street%20Name&maxSuggestions=6&countryCode=USA&f=json`
  const data = await getJSON(url, { signal, timeout: 8000 })
  return (data.suggestions || []).filter((s) => !s.isCollection).map((s) => ({ text: s.text, magicKey: s.magicKey }))
}

/** Resolve a suggestion (or free text) to a point. */
export async function locate({ text, magicKey }, { signal } = {}) {
  const url = `${BASE}/findAddressCandidates?SingleLine=${encodeURIComponent(text)}${
    magicKey ? `&magicKey=${encodeURIComponent(magicKey)}` : ''
  }&searchExtent=${EXTENT}&location=${CENTER}&maxLocations=1&outFields=Addr_type,City&f=json`
  const data = await getJSON(url, { signal, timeout: 10000 })
  const c = data.candidates?.[0]
  if (!c) return null
  return { address: c.address, lng: c.location.x, lat: c.location.y, score: c.score, type: c.attributes?.Addr_type }
}

/** Street address nearest a point (for lots picked by tapping the map). */
export async function reverse(lng, lat, { signal } = {}) {
  const url = `${BASE}/reverseGeocode?location=${lng},${lat}&featureTypes=PointAddress,StreetAddress&f=json`
  try {
    const data = await getJSON(url, { signal, timeout: 8000 })
    return data.address?.Match_addr || data.address?.LongLabel || null
  } catch {
    return null
  }
}
