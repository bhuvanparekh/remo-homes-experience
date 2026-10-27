/**
 * The rule numbers, transcribed from official text. Each table names where it
 * comes from; rules.js turns them into answers for one lot.
 *
 *   [CP-7150]  City Planning, Generalized Summary of Zoning Regulations, Jan 2026
 *   [184,802]  Ordinance 184,802 (single-family zones), effective 17 Mar 2017 —
 *              the current text of LAMC §12.07–12.08 C.5 and §12.21 C.10
 *   [CP-4061]  City Planning, Hillside Area Development Standards checklist
 */

/* ---------- Height (LAMC §12.21.1; CP-7150 Table 2) ---------- */

/**
 * Single-family zones: [roof slope ≥ 25%, flatter roof] in feet, by height
 * district. RE9 / RS / R1 share one row; RA and RE11–RE40 the other.
 * 1SS is 22 ft (sloped roof) in a Hillside Area (Table 12.21 C.10-4).
 */
export const SF_HEIGHT = {
  low: { 1: [33, 28], '1L': [33, 28], '1VL': [33, 28], '1XL': [30, 28], '1SS': [18, 18], 2: [33, 28], 3: [33, 28], 4: [33, 28] },
  high: { 1: [36, 30], '1L': [36, 30], '1VL': [36, 30], '1XL': [30, 30], '1SS': [18, 18], 2: [36, 30], 3: [36, 30], 4: [36, 30] },
}

/**
 * Multi-family zones: height in feet (null = no limit in feet) and FAR, by
 * height district. Stories limits don't apply to all-residential buildings
 * (CP-7150 Table 2, note †).
 */
export const MF_HEIGHT = {
  R2: { 1: [33, 3], '1L': [33, 3], '1VL': [33, 3], '1XL': [30, 3], 2: [33, 6], 3: [33, 10], 4: [33, 13] },
  RD: { 1: [45, 3], '1L': [45, 3], '1VL': [45, 3], '1XL': [30, 3], 2: [75, 6], 3: [75, 10], 4: [75, 13] },
  R3: { 1: [45, 3], '1L': [45, 3], '1VL': [45, 3], '1XL': [30, 3], 2: [75, 6], 3: [75, 10], 4: [75, 13] },
  R4: { 1: [null, 3], '1L': [75, 3], '1VL': [45, 3], '1XL': [30, 3], 2: [null, 6], 3: [null, 10], 4: [null, 13] },
}

/** Single-family zones in Height Districts 2–4 use FAR, not RFA (CP-7150 Table 2). */
export const SF_FAR_HD = { 2: 6, 3: 10, 4: 13 }

/* ---------- Residential Floor Area, non-hillside [184,802] ---------- */

/**
 * Maximum RFA for a lot of `a` sq ft. `bonus` = RA/RE/RS may add 20% using
 * one of two design options (upper floors ≤ 75% of the base floor, or a
 * stepped-back front façade).
 */
export const SF_RFA = {
  RA: { section: '§12.07 C.5', bonus: true, calc: (a) => (a < 20000 ? [0.25 * a, '25% of the lot'] : [Math.max(0.2 * a, 5000), '20% of the lot, or 5,000 sq ft if more']) },
  RE9: { section: '§12.07.01 C.5', bonus: true, calc: (a) => (a < 15000 ? [0.4 * a, '40% of the lot'] : [Math.max(0.35 * a, 6000), '35% of the lot, or 6,000 sq ft if more']) },
  RE11: { section: '§12.07.01 C.5', bonus: true, calc: (a) => (a < 15000 ? [0.4 * a, '40% of the lot'] : [Math.max(0.35 * a, 6000), '35% of the lot, or 6,000 sq ft if more']) },
  RE15: { section: '§12.07.01 C.5', bonus: true, calc: (a) => [0.35 * a, '35% of the lot'] },
  RE20: { section: '§12.07.01 C.5', bonus: true, calc: (a) => [0.35 * a, '35% of the lot'] },
  RE40: { section: '§12.07.01 C.5', bonus: true, calc: (a) => [0.35 * a, '35% of the lot'] },
  RS: { section: '§12.07.1 C.5', bonus: true, calc: (a) => (a < 9000 ? [0.45 * a, '45% of the lot'] : [Math.max(0.4 * a, 4050), '40% of the lot, or 4,050 sq ft if more']) },
  R1: { section: '§12.08 C.5(a)', bonus: false, calc: (a) => [0.45 * a, '45% of the lot'] },
}

/* ---------- R1 Variation Zones, Tables 12.08 C.5(b)–(d) [184,802] ---------- */

/** RFAR by lot size (≤6,000 · ≤7,000 · ≤8,000 · ≤9,000 · ≤10,000 · more), for variation 1–4. */
const VAR_RFAR = [
  [0.65, 0.63, 0.61, 0.59, 0.57, 0.55],
  [0.55, 0.53, 0.51, 0.49, 0.47, 0.45],
  [0.45, 0.43, 0.41, 0.39, 0.37, 0.35],
  [0.4, 0.38, 0.36, 0.34, 0.32, 0.3],
]
const VAR_COVER = [0.5, 0.48, 0.46, 0.44, 0.42, 0.4]
const tier = (a) => (a <= 6000 ? 0 : a <= 7000 ? 1 : a <= 8000 ? 2 : a <= 9000 ? 3 : a <= 10000 ? 4 : 5)

export function variationRfa(n, a) {
  const t = tier(a)
  return { rfar: VAR_RFAR[n - 1][t], coverage: VAR_COVER[t] }
}

/** [max height, encroachment-plane origin] in feet; the plane is always 45°. */
export const VARIATION_MASS = {
  V: { whole: [[30, 22], [30, 22], [28, 20], [20, 14]] },
  F: { front: [[30, 22], [30, 22], [28, 20], [26, 18]], rear: [[24, 16], [24, 16], [20, 14], [18, 14]], depth: 'front part at least 25 ft deep, measured back from the rear yard' },
  R: { front: [[24, 16], [24, 16], [20, 12], [18, 12]], rear: [[30, 22], [30, 22], [28, 20], [26, 18]], depth: 'front part at least 30 ft deep from the front yard (lots 90 ft deep or less use the rear standards throughout)' },
}

/* ---------- Hillside Area, LAMC §12.21 C.10 [184,802 · CP-4061] ---------- */

/** Slope bands (%): 0–14.99, 15–29.99, 30–44.99, 45–59.99, 60–99.99, 100+. */
export const SLOPE_BANDS = [0, 15, 30, 45, 60, 100]

/** Table 12.21 C.10-2a (and -2b for R1H1–R1H4). */
export const HILLSIDE_RFAR = {
  R1: [0.45, 0.45, 0.4, 0.35, 0.3, 0],
  RS: [0.45, 0.4, 0.35, 0.3, 0.25, 0],
  RE9: [0.4, 0.35, 0.3, 0.25, 0.2, 0],
  RE11: [0.4, 0.35, 0.3, 0.25, 0.2, 0],
  RE15: [0.35, 0.3, 0.25, 0.2, 0.15, 0],
  RE20: [0.35, 0.3, 0.25, 0.2, 0.15, 0],
  RE40: [0.35, 0.3, 0.25, 0.2, 0.15, 0],
  RA: [0.25, 0.2, 0.15, 0.1, 0.05, 0],
  R1H1: [0.65, 0.6, 0.55, 0.5, 0.45, 0],
  R1H2: [0.55, 0.5, 0.45, 0.4, 0.35, 0],
  R1H3: [0.45, 0.45, 0.4, 0.35, 0.3, 0],
  R1H4: [0.4, 0.35, 0.3, 0.25, 0.2, 0],
}

/** Table 12.21 C.10-3: guaranteed minimum, % of lot size (or 800 sq ft if more). */
export const HILLSIDE_GUARANTEE = { R1: 0.25, RS: 0.23, RE9: 0.2, RE11: 0.2, RE15: 0.18, RE20: 0.18, RE40: 0.18, RA: 0.13 }

/* ---------- Density: lot area per home (CP-7150 Table 1b) ---------- */

export const PER_UNIT = { 'RD1.5': 1500, RD2: 2000, RD3: 3000, RD4: 4000, RD5: 5000, RD6: 6000, R3: 800, R4: 400 }

/** Zones where SB 9 applies in Chapter 1 (City Planning SB 9 memo §I). */
export const SB9_ZONES = ['A1', 'A2', 'RA', 'RE', 'RS', 'R1', 'RU', 'RZ', 'RW1']
