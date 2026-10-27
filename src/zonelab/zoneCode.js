/**
 * Decodes Los Angeles zone strings into plain English.
 *
 * Two formats are live in the City today:
 *
 *   Chapter 1 (most of the City)   [Q]R3-1VL-O-CDO
 *     [Q]/[T]/(T) prefixes  conditions written into the lot's own ordinance
 *     R3                    zone class (what may be built / used)
 *     1VL                   height district (how tall / how much floor area)
 *     O, CDO …              supplemental districts (extra rules on top)
 *
 *   Chapter 1A (Downtown, rolling out)   [DM4-CHC1-5][CX4-FA][CPIO-SN-CDO]
 *     bracket 1  Form – Frontage – Development Standards (the built form)
 *     bracket 2  Use – Density (the activity)
 *     bracket 3  supplemental districts / specific plans (optional)
 *
 * Names follow LAMC §12.03–12.04 and Chapter 1A Article 1 §1.3.1. Anything not
 * in these tables is reported as "see ZIMAS" rather than guessed.
 */

/** Chapter 1 zone classes (LAMC §12.04). */
const ZONE_CLASSES = {
  OS: 'Open Space',
  A1: 'Agricultural',
  A2: 'Agricultural',
  RA: 'Suburban',
  RE: 'Residential Estate',
  RS: 'Suburban',
  R1: 'One-Family',
  RU: 'Residential Urban',
  RZ: 'Residential Zero Side Yard',
  RW1: 'One-Family Residential Waterways',
  R2: 'Two-Family',
  RD: 'Restricted Density Multiple Dwelling',
  RMP: 'Mobile Home Park',
  RW2: 'Two-Family Residential Waterways',
  R3: 'Multiple Dwelling',
  RAS3: 'Residential / Accessory Services',
  R4: 'Multiple Dwelling',
  RAS4: 'Residential / Accessory Services',
  R5: 'Multiple Dwelling',
  CR: 'Limited Commercial',
  C1: 'Limited Commercial',
  'C1.5': 'Limited Commercial',
  C2: 'Commercial',
  C4: 'Commercial',
  C5: 'Commercial',
  CM: 'Commercial Manufacturing',
  MR1: 'Restricted Industrial',
  M1: 'Limited Industrial',
  MR2: 'Restricted Light Industrial',
  M2: 'Light Industrial',
  M3: 'Heavy Industrial',
  P: 'Automobile Parking – Surface and Underground',
  PB: 'Parking Building',
  PF: 'Public Facilities',
  SL: 'Ocean-Submerged Land',
  HJ: 'Hybrid Industrial',
}

/** What a zone class is broadly for — drives colours and later the rules. */
export function zoneFamily(cls) {
  if (!cls) return 'other'
  if (/^(RE|RS|R1|RU|RZ|RW1|RA)/.test(cls)) return 'single'
  if (/^(R2|RD|RMP|RW2|R3|RAS3|R4|RAS4|R5)/.test(cls)) return 'multi'
  if (/^(CR|C1|C1\.5|C2|C4|C5)$/.test(cls)) return 'commercial'
  if (/^(CM|MR1|M1|MR2|M2|M3|HJ)$/.test(cls)) return 'industrial'
  if (/^(OS|PF|SL)$/.test(cls)) return 'public'
  if (/^(A1|A2)$/.test(cls)) return 'agricultural'
  if (/^(P|PB)$/.test(cls)) return 'parking'
  return 'other'
}

/** Height districts (LAMC §12.21.1). Limits themselves are applied in the rules step. */
const HEIGHT_DISTRICTS = {
  1: 'Height District 1',
  '1L': 'Height District 1L (Limited)',
  '1VL': 'Height District 1VL (Very Limited)',
  '1XL': 'Height District 1XL (Extra Limited)',
  '1SS': 'Height District 1SS (Single Story)',
  2: 'Height District 2',
  3: 'Height District 3',
  4: 'Height District 4',
}

/** Supplemental use districts and overlays (LAMC Ch. 1 Art. 3 & 13). */
const SUPPLEMENTAL = {
  O: 'Oil Drilling District',
  S: 'Animal Slaughtering District',
  G: 'Surface Mining District',
  K: 'Equinekeeping District',
  CA: 'Commercial and Artcraft District',
  POD: 'Pedestrian Oriented District',
  CDO: 'Community Design Overlay',
  MU: 'Mixed Use District',
  FH: 'Fence Height District',
  SN: 'Sign District',
  RFA: 'Residential Floor Area District',
  NSO: 'Neighborhood Stabilization Overlay',
  CPIO: 'Community Plan Implementation Overlay',
  HCR: 'Hillside Construction Regulation District',
  RIO: 'River Improvement Overlay',
  CUGU: 'Clean Up Green Up District',
  HPOZ: 'Historic Preservation Overlay Zone',
  HS: 'Hillside Standards Overlay',
  SUD: 'Supplemental Use District',
  RG: 'Rear Detached Garage District',
}

/** R1 Variation Zones (LAMC §12.08.1): R1V2 = Variable-Height, set 2, etc. */
const R1_VARIATIONS = { V: 'Variable-Height', F: 'Front Garage', R: 'Rear Detached Garage', H: 'Hillside' }

/** Prefix conditions — each one means the lot has its own written ordinance. */
const PREFIXES = {
  Q: { name: 'Qualified condition', note: 'Extra conditions in this lot’s zoning ordinance' },
  T: { name: 'Tentative classification', note: 'Zone change not yet final' },
  D: { name: 'Development limitation', note: 'Height or floor area capped by ordinance' },
}

/**
 * Parse one Chapter 1 zone string, e.g. "[Q]R3-1VL-O-CDO", "R1-1-O-HPOZ",
 * "RD1.5-1XL", "(T)(Q)C2-1D-CPIO", "RE11-1-H".
 */
export function parseChapter1(raw) {
  const s = String(raw || '').trim()
  const prefixes = []
  let rest = s
  // Leading [Q], (T), [T][Q] … in any combination.
  for (;;) {
    const m = rest.match(/^[[(]([A-Z]+)[\])]/)
    if (!m) break
    for (const ch of m[1]) if (PREFIXES[ch]) prefixes.push(ch)
    rest = rest.slice(m[0].length)
  }

  const parts = rest.split('-').filter(Boolean)
  const head = parts.shift() || ''

  // Zone class, with its number where the class carries one (RE11, RD1.5, RS…).
  let cls = null
  let size = null
  const known = Object.keys(ZONE_CLASSES).sort((a, b) => b.length - a.length)
  for (const k of known) {
    if (head.startsWith(k)) {
      cls = k
      size = head.slice(k.length) || null
      break
    }
  }

  // Height district: the first part that looks like 1, 1L, 1VL, 2, 3D, 1XL …
  let height = null
  let heightD = false
  const supplemental = []
  for (const p of parts) {
    const hm = !height && p.match(/^([1-4])(L|VL|XL|SS)?(D)?$/)
    if (hm) {
      height = hm[1] + (hm[2] || '')
      heightD = Boolean(hm[3])
    } else {
      supplemental.push(p)
    }
  }
  if (heightD) prefixes.push('D')

  // R1 variation zones carry their variation in place of a size.
  const variation = cls === 'R1' && size?.match(/^([VFRH])(\d)$/)
  return {
    format: 'chapter1',
    raw: s,
    variation: variation ? { code: size, name: `${R1_VARIATIONS[variation[1]]} variation ${variation[2]}` } : null,
    prefixes: [...new Set(prefixes)].map((p) => ({ code: p, ...PREFIXES[p] })),
    zone: cls ? { code: cls + (size ?? ''), base: cls, size, name: ZONE_CLASSES[cls], family: zoneFamily(cls) } : null,
    height: height ? { code: height, name: HEIGHT_DISTRICTS[height] || `Height District ${height}` } : null,
    supplemental: supplemental.map((code) => ({ code, name: SUPPLEMENTAL[code] || null })),
  }
}

/** Use-district families of Chapter 1A, by their letters (Article 5). */
const USE_1A = {
  OS: 'Open Space',
  A: 'Agricultural',
  RG: 'Residential General',
  RX: 'Residential Mixed',
  CX: 'Commercial Mixed',
  CC: 'Community Center',
  RC: 'Regional Center',
  IX: 'Industrial Mixed',
  IL: 'Light Industrial',
  IH: 'Heavy Industrial',
  PF: 'Public Facilities',
}

/** Parse a Chapter 1A zone string, e.g. "[DM4-CHC1-5][CX4-FA][CPIO-SN-CDO]". */
export function parseChapter1A(raw) {
  const s = String(raw || '').trim()
  const brackets = [...s.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].split('-'))
  const [form = [], activity = [], extra = []] = brackets
  const useCode = activity[0] || null
  const useFamily = useCode && Object.keys(USE_1A).find((k) => useCode.startsWith(k))
  return {
    format: 'chapter1A',
    raw: s,
    form: form[0] || null,
    frontage: form[1] || null,
    standards: form[2] || null,
    use: useCode ? { code: useCode, name: useFamily ? USE_1A[useFamily] : null } : null,
    density: activity[1] || null,
    supplemental: extra.map((code) => ({ code, name: SUPPLEMENTAL[code] || null })),
  }
}

/** Either format → parsed result. */
export function parseZone(raw) {
  return /^\s*\[[A-Z]{1,3}\d/.test(String(raw)) && String(raw).includes('][') ? parseChapter1A(raw) : parseChapter1(raw)
}

/** Short plain-English summary line for a parsed zone. */
export function describeZone(z) {
  if (!z) return 'Zoning not found'
  if (z.format === 'chapter1A') {
    return z.use?.name ? `${z.use.name} (new zoning code)` : 'New zoning code (Chapter 1A)'
  }
  if (!z.zone) return 'Zone not recognised — see ZIMAS'
  if (z.variation) return `${z.zone.name} · ${z.variation.name}`
  const size = z.zone.size && /^\d/.test(z.zone.size) ? sizeText(z.zone) : null
  return size ? `${z.zone.name} · ${size}` : z.zone.name
}

function sizeText(zone) {
  // RE11 = 11,000 sq ft minimum lots; RD1.5 = 1,500 sq ft of lot per home.
  const n = Number(zone.size)
  if (!Number.isFinite(n)) return null
  if (zone.base === 'RD') return `1 home per ${(n * 1000).toLocaleString('en-US')} sq ft of lot`
  if (zone.base === 'RE') return `min. lot ${(n * 1000).toLocaleString('en-US')} sq ft`
  return null
}
