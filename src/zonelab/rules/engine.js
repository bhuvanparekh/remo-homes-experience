import { envelope, footprint } from './envelope.js'
import { cite } from './sources.js'
import {
  HILLSIDE_GUARANTEE,
  HILLSIDE_RFAR,
  MF_HEIGHT,
  PER_UNIT,
  SB9_ZONES,
  SF_FAR_HD,
  SF_HEIGHT,
  SF_RFA,
  SLOPE_BANDS,
  VARIATION_MASS,
  variationRfa,
} from './tables.js'

/**
 * "What you can build" for one lot: heights, setbacks, floor area, homes,
 * parking — from the zone, the height district and the lot's own measured
 * shape. Every number names its code section and links to the official text.
 *
 * Covered: RA, RE, RS, R1 (and R1 Variation Zones), R2, RD, R3, R4, in
 * Chapter 1 of the LAMC. Anything else — Chapter 1A, commercial zones, lots
 * with their own conditions — gets "confirm with LA City Planning", never a
 * guess. Where a lot sits in an overlay that can change the base rules, the
 * base numbers are shown but clearly marked as base-zone only.
 */

const FT = 0.3048
const polyArea = (pts) => {
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  return Math.abs(a) / 2
}
const fmt = (n) => Math.round(n).toLocaleString('en-US')
const ft = (n) => `${Math.round(n * 10) / 10} ft`
const sqft = (n) => `${fmt(n)} sq ft`
const red = (text) => ({ level: 'red', text })
const amber = (text, c) => ({ level: 'amber', text, cite: c })
const info = (text, c) => ({ level: 'info', text, cite: c })

/** One extra foot of side yard per 10 ft (or part) of height above 18 ft. */
const sideBump = (h) => (h > 18 ? Math.ceil((h - 18) / 10) : 0)

/* ---------- Which rule set ---------- */

function profileOf(z) {
  const b = z.zone?.base
  if (!b) return null
  if (b === 'R1' && z.variation) return { kind: 'variation', code: z.zone.code, fam: z.variation.code[0], n: Number(z.variation.code[1]) }
  if (b === 'R1' || b === 'RS' || b === 'RA') return { kind: 'single', code: b }
  if (b === 'RE' && ['9', '11', '15', '20', '40'].includes(z.zone.size)) return { kind: 'single', code: `RE${z.zone.size}` }
  if (b === 'R2') return { kind: 'multi', code: 'R2' }
  if (b === 'RD' && PER_UNIT[`RD${z.zone.size}`]) return { kind: 'multi', code: `RD${z.zone.size}`, group: 'RD' }
  if (b === 'R3' || b === 'R4') return { kind: 'multi', code: b }
  return null
}

/* ---------- Setbacks ---------- */

/**
 * Required yards for a zone on a lot `w` ft wide, `d` ft deep.
 * Returns { front, side, rear } as { ft, note } and how the side yard
 * grows with the building (sideAt).
 */
function yards(code, w, d, { coastal }) {
  const pct = (p, min, max) => Math.min(max ?? Infinity, Math.max(min ?? 0, p))
  const narrow = (limit, std) => (w < limit ? { ft: pct(0.1 * w, 3), note: `10% of the lot width (lot under ${limit} ft wide), at least 3 ft` } : { ft: std, note: null })
  const heightNote = coastal
    ? '+1 ft for each storey above the 2nd (Coastal Zone)'
    : '+1 ft for each 10 ft of height (or part) above 18 ft'
  const sfSide = (base) => ({ ...base, grow: 'height', note: [base.note, heightNote].filter(Boolean).join(' · ') })

  switch (code) {
    case 'R1':
      return {
        front: { ft: pct(0.2 * d, 0, 20), note: '20% of lot depth, up to 20 ft' },
        side: sfSide(narrow(50, 5)),
        rear: { ft: 15, note: null },
        section: '§12.08 C',
      }
    case 'RS':
      return {
        front: { ft: pct(0.2 * d, 0, 25), note: '20% of lot depth, up to 25 ft' },
        side: sfSide(narrow(50, 5)),
        rear: { ft: 20, note: null },
        section: '§12.07.1 C',
      }
    case 'RE9':
    case 'RE11':
      return {
        front: { ft: pct(0.2 * d, 0, 25), note: '20% of lot depth, up to 25 ft' },
        side: sfSide(narrow(70, 7)),
        rear: { ft: pct(0.25 * d, 0, 25), note: '25% of lot depth, up to 25 ft' },
        section: '§12.07.01 C',
      }
    case 'RE15':
      return {
        front: { ft: pct(0.2 * d, 0, 25), note: '20% of lot depth, up to 25 ft' },
        side: sfSide({ ft: pct(0.1 * w, 5, 10), note: '10% of lot width, 5–10 ft' }),
        rear: { ft: pct(0.25 * d, 0, 25), note: '25% of lot depth, up to 25 ft' },
        section: '§12.07.01 C',
      }
    case 'RE20':
    case 'RE40':
      return {
        front: { ft: pct(0.2 * d, 0, 25), note: '20% of lot depth, up to 25 ft' },
        side: sfSide({ ft: 10, note: null }),
        rear: { ft: pct(0.25 * d, 0, 25), note: '25% of lot depth, up to 25 ft' },
        section: '§12.07.01 C',
      }
    case 'RA':
      return {
        front: { ft: pct(0.2 * d, 0, 25), note: '20% of lot depth, up to 25 ft' },
        side: sfSide({ ft: 10, note: w < 70 ? 'Lots recorded before 1 Jul 1966 and under 70 ft wide: 10% of width, at least 3 ft' : null }),
        rear: { ft: pct(0.25 * d, 0, 25), note: '25% of lot depth, up to 25 ft' },
        section: '§12.07 C',
      }
    case 'R2':
      return {
        front: { ft: pct(0.2 * d, 0, 20), note: '20% of lot depth, up to 20 ft' },
        side: sfSide(narrow(50, 5)),
        rear: { ft: 15, note: null },
        section: '§12.09',
      }
    case 'RD1.5':
    case 'RD2':
      return {
        front: { ft: 15, note: null },
        side: { ...narrow(50, 5), grow: 'storey2', note: [narrow(50, 5).note, '+1 ft for each storey above the 2nd, up to 16 ft'].filter(Boolean).join(' · ') },
        rear: { ft: 15, note: null },
        section: '§12.09.1',
      }
    case 'RD3':
    case 'RD4':
      return {
        front: { ft: 15, note: null },
        side: { ft: pct(0.1 * w, 5, 10), note: '10% of lot width, 5–10 ft' },
        rear: { ft: 15, note: null },
        section: '§12.09.1',
      }
    case 'RD5':
    case 'RD6':
      return { front: { ft: 20, note: null }, side: { ft: 10, note: null }, rear: { ft: 25, note: null }, section: '§12.09.1' }
    case 'R3':
      return {
        front: { ft: 15, note: '10 ft on a key lot' },
        side: { ...narrow(50, 5), grow: 'storey2', note: [narrow(50, 5).note, '+1 ft for each storey above the 2nd, up to 16 ft'].filter(Boolean).join(' · ') },
        rear: { ft: 15, note: null },
        section: '§12.10',
      }
    case 'R4':
      return {
        front: { ft: 15, note: '10 ft on a key lot' },
        side: { ...narrow(50, 5), grow: 'storey2', note: [narrow(50, 5).note, '+1 ft for each storey above the 2nd, up to 16 ft'].filter(Boolean).join(' · ') },
        rear: { ft: 15, grow: 'storey3', note: '+1 ft for each storey above the 3rd, up to 20 ft' },
        section: '§12.11',
      }
    default:
      return null
  }
}

/** Side and rear yards for a building of a given height / storeys. */
function grown(y, heightFt, storeys) {
  const side =
    y.side.grow === 'height'
      ? y.side.ft + sideBump(heightFt)
      : y.side.grow === 'storey2'
        ? Math.min(16, y.side.ft + Math.max(0, storeys - 2))
        : y.side.ft
  const rear = y.rear.grow === 'storey3' ? Math.min(20, y.rear.ft + Math.max(0, storeys - 3)) : y.rear.ft
  return { side, rear }
}

/* ---------- The answer ---------- */

export function rulesFor(report, sides, { slope = null } = {}) {
  const out = { headline: null, basis: null, items: [], cautions: [], envelope: null, limits: null }
  const z = report.zoning?.parsed
  const p = report.parcel

  if (!z) return { ...out, cautions: [red('No zoning was found for this lot.')] }
  if (report.zoning.split) out.cautions.push(red(`The lot is split between zones (${report.zoning.all.join(' and ')}); each part has its own rules. Numbers below are for ${report.zoning.raw}.`))
  if (z.format === 'chapter1A')
    return {
      ...out,
      headline: 'This lot uses LA’s new zoning code',
      basis: 'Chapter 1A (Downtown and Boyle Heights so far) works differently — form, frontage, use and density districts.',
      cautions: [...out.cautions, red('Zone Lab doesn’t calculate Chapter 1A rules yet.')],
    }

  const prof = profileOf(z)
  if (!prof)
    return {
      ...out,
      headline: z.zone ? `${z.zone.code}: not covered yet` : 'Zone not recognised',
      basis: 'Zone Lab calculates house and apartment zones (RA, RE, RS, R1, R2, RD, R3, R4).',
      cautions: [...out.cautions, red(`The rules for ${z.zone?.code || report.zoning.raw} need checking with the City.`)],
    }

  const has = (id) => report.overlays.some((o) => o.id === id)
  const flag = (id) => report.overlays.find((o) => o.id === id)
  const hillside = has('hillside') || prof.fam === 'H'
  const coastal = has('coastal')
  const fire = report.hazards.find((h) => h.id === 'fire')
  const veryHighFire = fire && /very high/i.test(fire.value)
  const hd = z.height?.code || null

  const A = p.areaSqft
  const W = sides?.widthFt ?? p.widthFt
  const D = sides?.depthFt ?? p.depthFt

  /* --- Things that override the base zone --- */
  for (const pr of z.prefixes) out.cautions.push(red(`[${pr.code}] ${pr.name}: this lot’s own ordinance adds conditions (${pr.note.toLowerCase()}).`))
  for (const id of ['specificPlan', 'hpoz', 'cpio', 'ico', 'coastal']) {
    const o = flag(id)
    if (o) out.cautions.push(red(`${o.label}${o.value && o.value !== o.label ? ` (${o.value})` : ''}: ${o.note}`))
  }
  if (has('rfa')) out.cautions.push(red(`Residential Floor Area District (${flag('rfa').value}): its own house-size limit replaces the one shown.`))
  const supp = z.supplemental.map((s) => s.code)
  if (supp.includes('HS')) out.cautions.push(red('Hillside Standards Overlay: changes the hillside rules shown here.'))
  if (supp.includes('RG')) out.cautions.push(red('Rear Detached Garage District: garage placement rules differ.'))
  if (supp.some((c) => !['O', 'CDO', 'HCR', 'HPOZ', 'CPIO', 'RFA', 'HS', 'RG', 'POD', 'NSO', 'K', 'SN', 'FH', 'RIO', 'CUGU', 'MU', 'CA'].includes(c)))
    out.cautions.push(red(`Supplemental district ${supp.join('-')} isn’t in our tables.`))

  const tpa = has('tpa')
  if (prof.kind === 'multi') multiRules(out, { prof, hd, A, W, D, hillside, coastal, sides, tpa })
  else singleRules(out, { prof, z, hd, A, W, D, hillside, coastal, sides, slope, veryHighFire, tpa, report })

  /* --- General notes --- */
  const sb79 = flag('sb79')
  if (sb79)
    out.cautions.push(
      amber(`SB 79 station area (${sb79.value}): since 1 July 2026 state law can allow taller, denser housing (5+ homes) here than the numbers above. LA is phasing it in — ask City Planning.`, {
        text: 'City Planning SB 79 fact sheet',
        href: 'https://planning.lacity.gov/odocument/70d6b5d9-3b32-4f47-a6c3-7d119e643922/SB_79_Fact_Sheet.pdf',
      }),
    )
  if (has('hcr')) out.cautions.push(amber('Hillside Construction Regulation District: grading, hauling and construction-hour limits (LAMC §13.20).'))
  if (has('cdo')) out.cautions.push(amber('Community Design Overlay: new buildings need a design sign-off (LAMC §13.08).'))
  if (sides?.corner) out.cautions.push(amber('Corner lot: we took the shorter street edge as the front. The City decides which is the front — confirm before designing.'))
  if (sides?.through) out.cautions.push(amber('Through lot (streets on two sides): front yards may apply on both streets — confirm.'))
  if (sides && !sides.sure) out.cautions.push(amber('We couldn’t find which side faces the street, so the yards on the 3D model are approximate.'))
  if (sides && !sides.convex) out.cautions.push(info('Irregular lot shape: the 3D “largest building” isn’t drawn for it; the numbers still apply.'))
  if (!p.regular && !sides) out.cautions.push(info('Irregular lot: width and depth are approximate, so the yards are too.'))

  return out
}

/* ---------- Houses: RA, RE, RS, R1 and R1 variations ---------- */

function singleRules(out, { prof, z, hd, A, W, D, hillside, coastal, sides, slope, veryHighFire, tpa, report }) {
  const isVar = prof.kind === 'variation'
  const code = isVar ? 'R1' : prof.code
  const zoneName = isVar ? `${prof.code} (${z.variation.name})` : prof.code
  const rowKey = ['RA', 'RE11', 'RE15', 'RE20', 'RE40'].includes(code) ? 'high' : 'low'

  out.basis = `${zoneName}${hd ? ` · Height District ${hd}` : ''}${hillside ? ' · Hillside Area' : ''}${coastal ? ' · Coastal Zone' : ''}`

  /* Height */
  let heightFt
  let flatFt
  let plane = null
  let heightItem
  if (isVar && prof.fam !== 'H') {
    const mass = VARIATION_MASS[prof.fam]
    if (mass.whole) {
      ;[heightFt, plane] = mass.whole[prof.n - 1]
      heightItem = {
        id: 'height',
        label: 'Height',
        value: ft(heightFt),
        note: `Above ${plane} ft the building must stay inside a 45° plane rising from the front and side yards.`,
        cite: cite('LAMC §12.08 C.5(b), Ord. 184,802', 'ord184802'),
      }
    } else {
      const [fH, fO] = mass.front[prof.n - 1]
      const [rH, rO] = mass.rear[prof.n - 1]
      heightFt = Math.max(fH, rH)
      heightItem = {
        id: 'height',
        label: 'Height — two parts',
        rows: [
          ['Front part', ft(fH), `45° plane from ${fO} ft`],
          ['Rear part', ft(rH), `45° plane from ${rO} ft`],
        ],
        note: mass.depth[0].toUpperCase() + mass.depth.slice(1) + '.',
        cite: cite(`LAMC §12.08 C.5(${prof.fam === 'F' ? 'c' : 'd'}), Ord. 184,802`, 'ord184802'),
      }
      plane = 'split'
    }
  } else if (coastal && !hillside) {
    heightFt = 45
    heightItem = {
      id: 'height',
      label: 'Height',
      value: '45 ft',
      note: 'Coastal Zone lots outside the Hillside Area keep the 45 ft limit.',
      cite: cite('LAMC §12.21.1 · CP-7150 Table 2 (§)'),
    }
  } else {
    const row = SF_HEIGHT[rowKey][hd || '1']
    if (!row) {
      out.cautions.push(red(`Height District ${hd} isn’t in our tables.`))
      return
    }
    ;[heightFt, flatFt] = row
    if (hd === '1SS' && hillside) heightFt = 22
    if (code === 'R1') plane = 20
    heightItem = {
      id: 'height',
      label: 'Height',
      value: heightFt === flatFt ? ft(heightFt) : `${ft(heightFt)} with a pitched roof`,
      note: [
        heightFt !== flatFt && `${ft(flatFt)} if the roof is flatter than 25% slope.`,
        hd === '1XL' && 'Two storeys at most.',
        hd === '1SS' && 'One storey only.',
        code === 'R1' && 'Above 20 ft the building must stay inside a 45° plane rising from the front and side yards.',
        hillside && 'Measured straight up from the ground at every point (envelope height).',
      ]
        .filter(Boolean)
        .join(' '),
      cite: hillside ? cite('LAMC §12.21 C.10(d), Table C.10-4', 'hillside') : cite(`LAMC §12.21.1${code === 'R1' ? ', §12.08 C.5(a)' : ''} · CP-7150 Table 2`),
    }
  }
  out.items.push(heightItem)

  /* Setbacks */
  const y = yards(code, W, D, { coastal: coastal && !hillside })
  const { side: sideFull } = grown(y, heightFt, 0)
  out.items.push({
    id: 'yards',
    label: 'Setbacks (yards)',
    rows: [
      ['Front', ft(y.front.ft), [y.front.note, 'or deeper where neighbours prevail'].filter(Boolean).join(' · ')],
      ['Sides', sideFull > y.side.ft ? `${ft(y.side.ft)} – ${ft(sideFull)}` : ft(y.side.ft), y.side.note],
      ['Rear', ft(y.rear.ft), y.rear.note],
    ],
    note: sideFull > y.side.ft ? `Sides are ${ft(y.side.ft)} for a building up to 18 ft tall, ${ft(sideFull)} at the full ${ft(heightFt)}.` : null,
    cite: hillside ? cite('LAMC §12.21 C.10(a), Table C.10-1', 'hillside') : cite(`LAMC ${y.section} · CP-7150 Table 1a`),
  })

  /* Floor area */
  let rfa = null
  if (coastal && !hillside) {
    out.items.push({
      id: 'floor',
      label: 'Floor area',
      value: 'Floor Area Ratio 3:1 (no house-size limit)',
      note: 'Coastal Zone lots outside the Hillside Area use the general floor-area limit instead of the single-family house-size rule.',
      cite: cite('LAMC §12.21.1 A · CP-7150 Table 2 (***)'),
    })
  } else if (SF_FAR_HD[hd]) {
    out.items.push({ id: 'floor', label: 'Floor area', value: `Floor Area Ratio ${SF_FAR_HD[hd]}:1`, cite: cite('LAMC §12.21.1 · CP-7150 Table 2') })
  } else if (hillside) {
    rfa = hillsideFloor(out, { prof, code, A, slope })
  } else if (isVar) {
    const { rfar, coverage } = variationRfa(prof.n, A)
    rfa = rfar * A
    out.items.push({
      id: 'floor',
      label: 'House size (Residential Floor Area)',
      value: sqft(rfa),
      note: `${rfar} × ${sqft(A)} lot. Buildings may cover up to ${Math.round(coverage * 100)}% of the lot.`,
      cite: cite(`LAMC §12.08 C.5(${{ V: 'b', F: 'c', R: 'd' }[prof.fam]}), Ord. 184,802`, 'ord184802'),
    })
  } else {
    const r = SF_RFA[code]
    const [max, how] = r.calc(A)
    rfa = max
    out.items.push({
      id: 'floor',
      label: 'House size (Residential Floor Area)',
      value: sqft(max),
      note: [
        `${how[0].toUpperCase() + how.slice(1)} (${sqft(A)}).`,
        r.bonus && `Up to ${sqft(max * 1.2)} (+20%) if upper floors are no more than 75% of the ground floor, or the front is stepped back.`,
        'Counts garages and accessory buildings; a required garage at the back of the lot is exempt up to 400 sq ft.',
      ]
        .filter(Boolean)
        .join(' '),
      cite: [cite(`LAMC ${r.section}, Ord. 184,802`, 'ord184802'), cite('What counts: LAMC §12.03 · ZI-2462', 'zi2462')],
    })
  }
  const existing = report.parcel.existing?.sqft
  if (rfa && existing) {
    const item = out.items.at(-1)
    item.note += ` Today’s buildings: ${sqft(existing)} (Assessor).`
  }

  /* Homes */
  const sb9 = SB9_ZONES.includes(z.zone.base)
  const canSplit = A >= 2400
  out.headline = 'One house, plus ADUs'
  out.items.push({
    id: 'homes',
    label: 'Homes',
    rows: [
      ['House', '1'],
      ['ADUs', '1 detached + 1 attached', 'State law: a detached ADU up to 800 sq ft, 16 ft tall, 4 ft from side and rear lines is allowed even beyond the house-size limit. LA’s own rules allow up to 1,200 sq ft.'],
      ['Junior ADU', '1', 'Up to 500 sq ft, inside the house.'],
      sb9 && [
        'SB 9',
        canSplit ? 'Up to 4 homes' : 'Up to 2 homes',
        canSplit
          ? 'Two homes on the lot, or split it into two lots (each at least 1,200 sq ft and 40% of the original) with up to two homes each. After a split the owner must live there 3 years; ADUs then count within the two.'
          : 'Two homes on the lot. Too small to split: each new lot must be at least 1,200 sq ft.',
      ],
    ].filter(Boolean),
    cite: [cite('ADUs: LAMC §12.22 A.33 · Gov. Code §66323 · ZA Memo 143', 'adu'), sb9 && cite('SB 9: Gov. Code §65852.21, §66411.7 · City SB 9 memo', 'sb9')].filter(Boolean),
  })
  if (sb9 && (report.overlays.some((o) => o.id === 'hpoz') || veryHighFire))
    out.cautions.push(
      amber(
        [
          report.overlays.some((o) => o.id === 'hpoz') && 'SB 9 in a historic district is allowed only for non-contributing buildings (AB 1061).',
          veryHighFire && 'SB 9 in a Very High Fire zone must meet the State’s site criteria, and the City isn’t accepting SB 9 in Very High Fire zones of the Palisades Fire area.',
        ]
          .filter(Boolean)
          .join(' '),
        cite('City SB 9 FAQ (Aug 2026)', 'sb9faq'),
      ),
    )
  if (veryHighFire && hillside)
    out.cautions.push(amber('Hillside + Very High Fire zone: LA’s own ADU rules don’t allow ADUs here; State-law ADUs are still allowed.', cite('ZA Memo 143, Q.42', 'adu')))

  /* Parking */
  if (tpa)
    out.items.push({
      id: 'parking',
      label: 'Parking',
      value: 'Likely none required',
      note: 'The lot is inside a Transit Priority Area (½ mile of a major transit stop), where AB 2097 bars minimum parking. Otherwise it’s 2 covered spaces. Confirm the “AB 2097” line on the ZIMAS parcel report.',
      cite: { text: 'Gov. Code §65863.2 · SCAG Transit Priority Areas (Jan 2026)', href: 'https://rdp.scag.ca.gov/hosting/rest/services/Hosted/TPA_DMB_Mar2026/FeatureServer/1' },
    })
  else out.items.push({
    id: 'parking',
    label: 'Parking',
    value: '2 covered spaces',
    note: hillside
      ? 'In a garage, not in the front yard. On a substandard hillside street, one more space per 1,000 sq ft above 2,400 sq ft (up to 5).'
      : 'Per house. State-law ADUs need none.',
    cite: hillside ? cite('LAMC §12.21 C.10(g)', 'hillside') : cite('LAMC §12.21 A.4 · CP-7150 Table 1a'),
  })

  /* Numbers for the design options (Phase 3) — the same rules as above. */
  const floorFar = coastal && !hillside ? 3 : SF_FAR_HD[hd] || null
  out.limits = {
    kind: 'single',
    zone: code,
    heightFt,
    flatRoofFt: flatFt ?? heightFt,
    planeFt: typeof plane === 'number' ? plane : null,
    splitHeight: plane === 'split',
    storeysMax: hd === '1SS' ? 1 : hd === '1XL' ? 2 : null,
    // House-size limit (counts attached garages); FAR-based where that applies instead.
    floorAreaSqft: rfa ?? null,
    floorFar,
    floorEstimate: hillside,
    yards: { front: y.front.ft, side: y.side.ft, rear: y.rear.ft },
    /** Side yard for a building of this height (grows above 18 ft). */
    sideFor: (h) => grown(y, h, 0).side,
    homes: { main: 1 },
    adu: {
      // State-law detached ADU: allowed beyond the house-size limit.
      detachedSqft: 800,
      laSqft: 1200,
      heightFt: 16,
      yardFt: 4,
      junior: 500,
      laAllowed: !(veryHighFire && hillside),
    },
    sb9: sb9 ? { homes: 2, yardFt: 4, splitHomes: canSplit ? 4 : 2 } : null,
    parking: { perHome: tpa ? 0 : 2, covered: true, exempt: tpa },
    lotSqft: A,
  }

  /* 3D envelope */
  if (sides && plane !== 'split') {
    const sbBy = { front: y.front.ft, rear: y.rear.ft, side: sideFull, streetSide: sideFull }
    const env = envelope(sides, {
      setbackFt: (e) => sbBy[e.kind] ?? sideFull,
      heightFt,
      plane: plane ? { originFt: plane, kinds: ['front', 'side', 'streetSide'] } : null,
    })
    if (env) out.envelope = { ...env, heightM: heightFt * FT, label: `Up to ${ft(heightFt)}`, sub: rfa ? `${sqft(rfa)} of floor area` : null }
  }
}

/** Hillside floor area: depends on a surveyed slope map, so give the range and an estimate. */
function hillsideFloor(out, { prof, code, A, slope }) {
  const key = prof.kind === 'variation' ? `R1H${prof.n}` : code
  const rfar = HILLSIDE_RFAR[key]
  const g = HILLSIDE_GUARANTEE[key]
  const guaranteed = g ? Math.max(g * A, 800) : null
  const flatMax = rfar[0] * A
  let est = null
  if (slope?.bands) est = slope.bands.reduce((s, share, i) => s + share * A * rfar[i], 0)
  // With a slope estimate: one figure, marked "estimate". Without: the honest range.
  const best = est != null ? Math.max(est, guaranteed ?? 0) : null
  const low = guaranteed ?? 0
  out.items.push({
    id: 'floor',
    label: 'House size (Residential Floor Area)',
    value: best != null ? `About ${sqft(best)}` : low ? `${sqft(low)} – ${sqft(flatMax)}` : `Up to ${sqft(flatMax)}`,
    estimate: best != null,
    note: [
      `Set by the lot’s slope: ${rfar[0]} of the flat part (under 15%), falling to ${rfar[4]} on 60–100% slopes and nothing over 100%.`,
      est != null && `Our estimate uses public terrain data (average slope ${Math.round(slope.mean)}%); the real number needs a slope map stamped by a surveyor or civil engineer.`,
      guaranteed && `Guaranteed at least ${sqft(guaranteed)} whatever the slope.`,
      ['RA', 'RE9', 'RE11', 'RE15', 'RE20', 'RE40', 'RS'].includes(code) && '+20% bonus possible with one of six design options (30% on lots using the guaranteed minimum).',
    ]
      .filter(Boolean)
      .join(' '),
    cite: cite('LAMC §12.21 C.10(b), Tables C.10-2 and C.10-3', 'hillside'),
  })
  return best
}

/* ---------- Apartments: R2, RD, R3, R4 ---------- */

function multiRules(out, { prof, hd, A, W, D, hillside, coastal, sides, tpa }) {
  const table = MF_HEIGHT[prof.group || prof.code]
  const row = table[hd || '1']
  out.basis = `${prof.code}${hd ? ` · Height District ${hd}` : ''}${hillside ? ' · Hillside Area' : ''}${coastal ? ' · Coastal Zone' : ''}`
  if (!row) {
    out.cautions.push(red(`Height District ${hd} isn’t in our tables.`))
    return
  }
  const [heightFt, far] = row
  const hillHeight = hillside && prof.group === 'RD'

  /* Height */
  out.items.push({
    id: 'height',
    label: 'Height',
    value: hillHeight ? '36 or 45 ft (hillside rules)' : heightFt ? ft(heightFt) : 'No limit in feet',
    note: [
      hillHeight && 'In a Hillside Area the RD limit is 36 ft or 45 ft depending on the lot — confirm with City Planning (§12.21 A.17).',
      !heightFt && 'The floor-area limit caps the size instead.',
      hd === '1XL' && 'Two storeys for mixed-use buildings; all-residential buildings are limited in feet only.',
    ]
      .filter(Boolean)
      .join(' ') || null,
    cite: cite('LAMC §12.21.1 · CP-7150 Table 2'),
  })

  /* Setbacks — drawn for the tallest building the height allows. */
  const y = yards(prof.code, W, D, {})
  const storeys = heightFt ? Math.max(1, Math.floor(heightFt / 10)) : null
  const g = grown(y, heightFt ?? 0, storeys ?? 0)
  out.items.push({
    id: 'yards',
    label: 'Setbacks (yards)',
    rows: [
      ['Front', ft(y.front.ft), y.front.note],
      ['Sides', g.side > y.side.ft ? `${ft(y.side.ft)} – ${ft(g.side)}` : ft(y.side.ft), y.side.note],
      ['Rear', g.rear > y.rear.ft ? `${ft(y.rear.ft)} – ${ft(g.rear)}` : ft(y.rear.ft), y.rear.note],
    ],
    note: storeys && (g.side > y.side.ft || g.rear > y.rear.ft) ? `The larger figures are for a ${storeys}-storey building.` : null,
    cite: cite(`LAMC ${y.section} · CP-7150 Table 1${prof.code === 'R2' ? 'a' : 'b'}`),
  })

  /* Floor area: FAR × Buildable Area — the lot minus the yards a one-storey building needs. */
  const fp = sides?.convex ? footprint(sides, (e) => ({ front: y.front.ft, rear: y.rear.ft }[e.kind] ?? y.side.ft) * FT) : null
  const buildable = fp ? polyArea(fp) / (FT * FT) : Math.max(0, (W - 2 * y.side.ft) * (D - y.front.ft - y.rear.ft))
  out.items.push({
    id: 'floor',
    label: 'Floor area',
    value: sqft(far * buildable),
    note: `${far} × the buildable area (${sqft(buildable)}: the lot minus its required yards).${fp ? '' : ' Approximate — the lot isn’t a simple shape.'}`,
    cite: cite('LAMC §12.21.1 A.1, “Buildable Area” §12.03 · CP-7150 Table 2'),
  })

  /* 3D: prism to the height limit (no height limit → not drawn). */
  if (sides && heightFt && !hillHeight) {
    const sbBy = { front: y.front.ft, rear: g.rear, side: g.side, streetSide: g.side }
    const env = envelope(sides, { setbackFt: (e) => sbBy[e.kind] ?? g.side, heightFt })
    if (env) out.envelope = { ...env, heightM: heightFt * FT, label: `Up to ${ft(heightFt)}`, sub: storeys ? `drawn as ${storeys} storeys` : null }
  }
  if (sides && !heightFt) out.cautions.push(info('No height limit in feet here, so the 3D “largest building” isn’t drawn — floor area caps the size.'))

  /* Homes */
  let n
  if (prof.code === 'R2') {
    n = 2
    out.headline = 'Up to 2 homes (a duplex or two houses), plus ADUs'
    out.items.push({
      id: 'homes',
      label: 'Homes',
      value: '2 homes',
      note:
        A < 5000
          ? `Lot-area rules apply to two homes on lots under 5,000 sq ft (this one is ${sqft(A)}) — confirm with City Planning.`
          : 'A two-family dwelling or two single-family dwellings.',
      cite: cite('LAMC §12.09 · CP-7150 Table 1a, note 15'),
    })
  } else {
    const per = PER_UNIT[prof.code]
    n = Math.floor(A / per)
    let alleyNote = null
    const alleyEdge = sides?.alley && sides.edges.find((e) => e.kind === 'rear' && e.beyond === 'alley')
    if (alleyEdge && Number.isFinite(alleyEdge.gap)) {
      const extra = (alleyEdge.gap / FT / 2) * (alleyEdge.len / FT)
      const n2 = Math.floor((A + extra) / per)
      if (n2 > n) alleyNote = `Counting half the alley behind the lot (allowed for density) could make it ${n2} — confirm the alley width.`
    }
    out.headline = `${n} home${n === 1 ? '' : 's'}, plus ADUs`
    out.items.push({
      id: 'homes',
      label: 'Homes',
      value: `${n} home${n === 1 ? '' : 's'}`,
      note: [`One per ${fmt(per)} sq ft of lot (${sqft(A)}), rounded down.`, alleyNote].filter(Boolean).join(' '),
      cite: cite(`LAMC ${y.section} · CP-7150 Table 1b`),
    })
  }
  out.items.push({
    id: 'adu',
    label: 'ADUs on an apartment lot',
    value: 'Up to 2 detached',
    note: 'With a new building: up to 2 detached ADUs. With existing apartments: up to 8 detached (no more than the number of homes), plus ADUs converted from non-living space — up to 25% of the homes.',
    cite: cite('Gov. Code §66323(a)(3)–(4) · ZA Memo 143', 'adu'),
  })
  out.cautions.push(info('The State Density Bonus and LA’s housing incentive programs can allow more homes in exchange for affordable units.'))

  /* Parking */
  out.items.push(
    tpa
      ? {
          id: 'parking',
          label: 'Parking',
          value: 'Likely none required',
          note: 'The lot is inside a Transit Priority Area (½ mile of a major transit stop), where AB 2097 bars minimum parking. Confirm the “AB 2097” line on the ZIMAS parcel report.',
          cite: { text: 'Gov. Code §65863.2 · SCAG Transit Priority Areas (Jan 2026)', href: 'https://rdp.scag.ca.gov/hosting/rest/services/Hosted/TPA_DMB_Mar2026/FeatureServer/1' },
        }
      : {
          id: 'parking',
          label: 'Parking',
          value: '1–2 spaces per home',
          note: `1 space for a home with fewer than 3 habitable rooms, 1½ for 3, 2 for more than 3.${prof.code === 'R2' ? ' At least one per home in a garage.' : ''}`,
          cite: cite('LAMC §12.21 A.4 · CP-7150 Table 1b'),
        },
  )

  /* Open space: 6 or more homes. */
  if (n >= 6)
    out.items.push({
      id: 'open',
      label: 'Open space',
      value: `${sqft(n * 100)} – ${sqft(n * 175)}`,
      note: 'Per home: 100 sq ft (fewer than 3 habitable rooms), 125 sq ft (3), 175 sq ft (more than 3). Front and side yards and parking don’t count; part must be shared and planted.',
      cite: cite('LAMC §12.21 G · CP-7150'),
    })

  /* Numbers for the design options (Phase 3) — the same rules as above. */
  out.limits = {
    kind: 'multi',
    zone: prof.code,
    heightFt: hillHeight ? 36 : heightFt || null,
    heightUnsure: hillHeight,
    storeysMax: null,
    floorAreaSqft: far * buildable,
    floorFar: far,
    floorEstimate: !fp,
    yards: { front: y.front.ft, side: y.side.ft, rear: y.rear.ft },
    /** Side and rear yards for a building of this many storeys. */
    yardsFor: (storeysN) => grown(y, (storeysN || 1) * 10, storeysN || 1),
    homes: { max: n },
    adu: { detachedMax: 2, detachedSqft: 800, heightFt: 16, yardFt: 4 },
    // Spaces per home by habitable rooms: <3 → 1, 3 → 1.5, >3 → 2.
    parking: { byRooms: [1, 1.5, 2], exempt: tpa, garagePerHome: prof.code === 'R2' },
    openSpace: n >= 6 ? { perHome: [100, 125, 175] } : null,
    lotSqft: A,
  }
}
