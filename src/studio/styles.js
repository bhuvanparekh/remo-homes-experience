import { Color } from 'three'

/**
 * Interior looks for the studio. "Signature" is the material set matched to
 * ReMo's own renders (stage/house/materials.js); the other two re-tint the
 * same textures, so floors keep their real wood grain in every look.
 */
export const STYLES = [
  { id: 'signature', name: 'Signature', note: 'Oak & taupe, as in ReMo’s renders', swatch: ['#c49d74', '#b39d8e', '#f2f0ec'] },
  { id: 'walnut', name: 'Walnut', note: 'Dark wood, charcoal, cognac', swatch: ['#7a5236', '#4f4843', '#8a5a3a'] },
  { id: 'coastal', name: 'Coastal', note: 'Pale wood, white, soft blue', swatch: ['#d8c8b2', '#efedea', '#9fb3bd'] },
]

// Colours multiply the base textures, so a tint can only darken the grain.
// [colour, glow] pairs add a little emissive to lift pale woods above it.
const TINTS = {
  walnut: {
    floor: '#86705f',
    oak: '#7a5236',
    oakDark: '#4e3424',
    taupe: '#4f4843',
    taupeDark: '#3b3531',
    sofa: '#a0623a',
    rug: '#d3c9b9',
    rugDark: '#6b625a',
    linenSand: '#b08d6a',
    deck: '#8a6a52',
  },
  coastal: {
    floor: ['#f2eee8', '#3b3631'],
    oak: ['#f0e6d8', '#2a2621'],
    oakDark: '#b9a58c',
    taupe: '#efedea',
    taupeDark: '#d6d2cc',
    sofa: '#d8d4cc',
    rug: '#f1eee8',
    rugDark: '#9fb3bd',
    linenSand: '#a9bcc4',
    linenGrey: '#c7ccce',
  },
}

/** The base material set with this look's tints applied (base is untouched). */
export function styledMaterials(base, id) {
  const tint = TINTS[id]
  if (!tint) return base
  const m = { ...base }
  for (const [key, value] of Object.entries(tint)) {
    const [color, glow] = Array.isArray(value) ? value : [value]
    m[key] = base[key].clone()
    m[key].color = new Color(color)
    if (glow) {
      m[key].emissive = new Color(glow)
      m[key].emissiveMap = m[key].map
    }
  }
  return m
}
