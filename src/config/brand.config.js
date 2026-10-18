/**
 * ReMo's brand, as published on remo.homes (their CSS ships these exact
 * values as --hm-ink / --hm-cream / --hm-gold, set in Poppins + Manrope).
 *
 * The serif is ours: one italic accent word per headline, echoing their
 * "We are building the next generation of *dwelling*" treatment.
 *
 * `applyBrandToCss` mirrors the palette into CSS custom properties at boot, so
 * the stylesheet and the 3D scene can never disagree about a colour.
 */
export const BRAND = {
  name: 'ReMo Homes',
  tagline: 'From rockets to residences.',

  palette: {
    ink: '#28211e',
    inkSoft: '#514842',
    cream: '#f8f6f1',
    paper: '#efe9df',
    gold: '#c99b41',
    goldHover: '#ddb75f',
    oak: '#a57b52',
    steel: '#8c9399',
    white: '#ffffff',
  },

  fonts: {
    display: "'Poppins', 'Manrope', Arial, sans-serif",
    body: "'Manrope', Arial, sans-serif",
    accent: "'Instrument Serif', Georgia, serif",
  },
}

const toKebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

export function applyBrandToCss(root = document.documentElement) {
  for (const [key, value] of Object.entries(BRAND.palette)) {
    root.style.setProperty(`--c-${toKebab(key)}`, value)
  }
  for (const [key, value] of Object.entries(BRAND.fonts)) {
    root.style.setProperty(`--f-${key}`, value)
  }
}
