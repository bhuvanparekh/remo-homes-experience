/**
 * "Before you build": the permits, studies, building-code rules and fees that
 * apply to one lot and the design option chosen for it.
 *
 * Every item says why it applies (the lot data or design choice that triggers
 * it), who handles it, and links to an official source. Each was checked
 * against current official material when written (27 Oct 2026); where an
 * exemption or threshold couldn't be confirmed, the item says "check" rather
 * than claiming it applies or not. Fees are named, never priced.
 *
 * level: 'required' — applies to this project
 *        'likely'   — applies in most projects like this one
 *        'check'    — may apply; depends on details we can't see
 *        'info'     — good to know (including rules that no longer apply)
 */

const L = {
  ladbs: { text: 'LA Department of Building and Safety', href: 'https://dbs.lacity.gov/' },
  planning: { text: 'LA City Planning', href: 'https://planning.lacity.gov/' },
  zimas: (href) => ({ text: 'This lot on ZIMAS', href }),
  coastal: { text: 'California Coastal Commission', href: 'https://www.coastal.ca.gov/' },
  energy: { text: '2025 California Energy Code fact sheet (CEC)', href: 'https://www.energy.ca.gov/sites/default/files/2024-09/2025_California_Energy_Code_Fact_Sheet_ada.pdf' },
  allElectricRepeal: { text: 'Repeal ordinance 188,716 (City Clerk)', href: 'https://cityclerk.lacity.org/onlinedocs/2022/22-0151_Ord_188716_dated_9-3-25.pdf' },
  brush: { text: 'LAFD brush clearance requirements', href: 'https://www.lafd.org/fire-prevention/brush/brush-clearance-requirements' },
  trees: { text: 'Protected Tree and Shrub Ordinance (StreetsLA)', href: 'https://streetsla.lacity.org/sites/default/files/protected_tree_ordinance.pdf' },
  haul: { text: 'LADBS haul route procedure', href: 'https://dbs.lacity.gov/sites/default/files/efs/forms_and_publications/forms/other/haul-route/LADBS_haul-route-clearance-procedure.pdf' },
  faultIB: { text: 'LADBS bulletin on fault zones', href: 'https://dbs.lacity.gov/sites/default/files/efs/forms/pc17/ib-p-bc-2023-044-(draft-1-20-23).pdf' },
  ap: { text: 'Alquist-Priolo Act (CA Dept. of Conservation)', href: 'https://www.conservation.ca.gov:443/smgb/Documents/Misc/Regulations%20and%20Statutes/AP%20statutes.pdf' },
  lid: { text: 'LA Sanitation — Low Impact Development', href: 'https://sanitation.lacity.gov/services/lid-certificate-occupancy' },
  sanitation: { text: 'LA Sanitation', href: 'https://sanitation.lacity.gov/' },
  ladwp: { text: 'LADWP', href: 'https://www.ladwp.com/' },
  boe: { text: 'LA Bureau of Engineering', href: 'https://engineering.lacity.gov/' },
  aqmd: { text: 'SCAQMD Rule 1403 instructions', href: 'https://aqmd.gov/docs/default-source/aqmd-forms/Asbestos/r1403-instructions.pdf?sfvrsn=56' },
  replacement: { text: 'City Planning: replacement & occupant protections', href: 'https://planning.lacity.gov/odocument/90056ebd-3861-48fc-b647-86c44466af04/Fact_Sheet_Replacement_Requirements_and_Occupant_Protections.pdf' },
  ahlf: { text: 'Linkage Fee implementation memo (Apr 2026)', href: 'https://planning.lacity.gov/odocument/a098a8ca-11a2-4831-8f5a-d576285fe0b7/AHLF_Implementation_Memo_April_22,_2026.pdf' },
  park: { text: 'Recreation & Parks — Park Fees', href: 'https://recreation.parks.lacity.gov/planning/park-fees/park-mitigation-fee-homepage' },
  lausd: { text: 'LAUSD developer fees (LADBS notice)', href: 'https://ladbs.org/our-organization/messaging/news/news-details/2020/06/26/la-unified-school-district-(lausd)-developer-fee-rate-changes-effective-july-20-2020' },
  adu: { text: 'Gov. Code §66314 (ADU standards)', href: 'https://california.public.law/codes/government_code_section_66314' },
}

const item = (id, level, title, why, who, links = [], extra = {}) => ({ id, level, title, why, who, links: links.filter(Boolean), ...extra })

/** What the chosen design implies. */
function designFacts(option, existing) {
  if (!option?.stats) return null
  const vols = option.vols || []
  const hasAdu = vols.some((v) => v.use === 'adu')
  const aduSqft = option.stats.aduSqft || 0
  const homes = option.stats.homes || 0
  const mainHomes = homes - (hasAdu ? 1 : 0)
  return {
    homes,
    mainHomes,
    hasAdu,
    aduSqft,
    sb9: option.id === 'sb9',
    storeys: option.stats.storeys || 1,
    floorSqft: option.stats.floorSqft || 0,
    parking: option.stats.parking || 0,
    // Apartments: homes sharing one building.
    apartments: vols.some((v) => v.label === 'Homes') ? homes : 0,
    townhomes: option.id === 'townhomes',
    newHomes: Math.max(0, mainHomes - (existing?.units || 0)),
  }
}

export function checklistFor({ report, rules, option }) {
  const has = (id) => report.overlays.some((o) => o.id === id)
  const flag = (id) => report.overlays.find((o) => o.id === id)
  const hazard = (id) => report.hazards.find((h) => h.id === id)
  const z = report.zoning?.parsed
  const ex = report.parcel.existing
  const builtNow = Boolean(ex && (ex.sqft || ex.yearBuilt))
  const d = designFacts(option, ex)
  const zimas = report.parcel.pin
    ? `https://zimas.lacity.org/?pin=${encodeURIComponent(report.parcel.pin)}`
    : `https://zimas.lacity.org/?apn=${report.parcel.ain}`
  const hillside = has('hillside')

  const groups = []

  /* ---------- 1. Approvals ---------- */
  const approvals = [
    item('permit', 'required', 'Building permit and plan check', 'Every new building in the City needs plans checked and a permit issued before work starts.', 'LADBS', [L.ladbs]),
  ]
  if (has('coastal')) {
    const c = flag('coastal')
    approvals.push(
      item(
        'cdp',
        'required',
        'Coastal Development Permit',
        `The lot is in the Coastal Zone (${c.value}). New development needs a Coastal Development Permit in addition to the building permit${/dual|commission/i.test(c.value) ? '; in Dual or Commission areas the California Coastal Commission is involved too' : ''}.`,
        'LA City Planning · California Coastal Commission',
        [L.planning, L.coastal],
      ),
    )
  }
  if (has('hpoz'))
    approvals.push(
      item('hpoz', 'required', 'Historic review (HPOZ)', `The lot is in the ${flag('hpoz').value} Historic Preservation Overlay Zone. New buildings, demolition and exterior changes need HPOZ approval, which depends on whether the existing building is a “contributing” structure.`, 'LA City Planning — Office of Historic Resources', [L.planning, L.zimas(zimas)]),
    )
  if (has('specificPlan'))
    approvals.push(
      item('sp', 'required', 'Specific Plan review', `The lot is in the ${flag('specificPlan').value} specific plan, which adds its own rules and a compliance review.`, 'LA City Planning', [L.planning, L.zimas(zimas)]),
    )
  if (has('cpio') || has('cdo'))
    approvals.push(
      item('overlay', 'required', `${has('cpio') ? 'CPIO' : 'Design overlay'} sign-off`, `${[has('cpio') && `Community Plan Implementation Overlay (${flag('cpio').value})`, has('cdo') && `Community Design Overlay (${flag('cdo').value})`].filter(Boolean).join(' and ')}: the project needs a clearance against the overlay’s standards.`, 'LA City Planning', [L.planning]),
    )
  if (has('ico')) approvals.push(item('ico', 'required', 'Interim Control Ordinance', `An interim ordinance (${flag('ico').value}) may pause or limit permits here — check it first.`, 'LA City Planning', [L.zimas(zimas)]))
  if (z?.prefixes?.length)
    approvals.push(
      item('q', 'required', 'Conditions in this lot’s own zoning ordinance', `The zone has ${z.prefixes.map((p) => `[${p.code}]`).join(' ')} — extra conditions written into an ordinance for this lot. Read it before designing.`, 'LA City Planning', [L.zimas(zimas)]),
    )
  if (d?.hasAdu)
    approvals.push(
      item('adu', 'info', 'ADU approval is ministerial', 'ADU applications that meet the State standards are approved without a hearing, within 60 days of a complete application.', 'LADBS', [L.adu]),
    )
  if (d?.sb9)
    approvals.push(
      item('sb9', 'likely', 'SB 9 application', 'Two homes under SB 9 are approved ministerially. Splitting the lot needs an Urban Lot Split, and the owner must sign an intent to live there for 3 years.', 'LA City Planning · LADBS', [L.planning]),
    )
  if (builtNow && ex.units > 0 && /residential/i.test(ex.use || ''))
    approvals.push(
      item(
        'replace',
        ex.units > 1 ? 'likely' : 'check',
        'Replacing existing homes',
        `The Assessor lists ${ex.units} home${ex.units === 1 ? '' : 's'} on the lot today. Under the State Housing Crisis Act, homes that were rented (or affordable) recently must be replaced and their tenants protected.`,
        'LA Housing Department · City Planning',
        [L.replacement],
      ),
    )
  groups.push({ id: 'approvals', title: 'Approvals', items: approvals })

  /* ---------- 2. Site studies ---------- */
  const studies = [item('survey', 'likely', 'Boundary and topographic survey', 'Plans are drawn from a licensed survey of the lot lines and ground levels.', 'Licensed land surveyor')]
  if (hazard('liquefaction') || hazard('landslide'))
    studies.push(
      item('geo', 'required', 'Soils / geology report', `The lot is in a mapped ${[hazard('liquefaction') && 'liquefaction', hazard('landslide') && 'landslide'].filter(Boolean).join(' and ')} zone, so a geotechnical investigation is needed for the foundations and grading.`, 'Geotechnical engineer · LADBS Grading', [L.ladbs]),
    )
  if (hazard('fault')) {
    const exempt = d && d.homes < 4 && d.storeys <= 2 && !d.apartments
    studies.push(
      item(
        'fault',
        exempt ? 'check' : 'required',
        'Earthquake fault study',
        exempt
          ? 'The lot is in an Alquist-Priolo fault zone. A one- or two-storey wood- or steel-frame house that isn’t part of a 4+ home development is exempt from the State fault study, but LADBS still needs a geologist’s site determination.'
          : 'The lot is in an Alquist-Priolo fault zone. Buildings for people need a geologist’s fault study showing they aren’t over an active fault.',
        'Engineering geologist · LADBS',
        [L.ap, L.faultIB],
      ),
    )
  }
  if (hillside)
    studies.push(
      item('grading', 'likely', 'Hillside grading permit', 'Hillside Area: grading is limited, and moving more than 1,000 cubic yards of soil on or off the site needs a haul-route hearing (LAMC §91.7006.7.5).', 'LADBS · Board of Building and Safety Commissioners', [L.haul]),
    )
  if (has('hcr')) studies.push(item('hcr', 'required', 'Hillside construction limits', `Hillside Construction Regulation District (${flag('hcr').value}): limits on construction hours, hauling and truck trips.`, 'LA City Planning · LADBS', [L.planning]))
  if (hazard('flood')) studies.push(item('flood', 'required', 'Flood-zone building rules', `The lot is in a FEMA 100-year flood zone (${hazard('flood').value}). Floor levels and flood-resistant construction must meet the flood rules.`, 'LADBS · Bureau of Engineering', [L.boe]))
  studies.push(
    item('trees', 'check', 'Protected trees and shrubs', 'Native oaks, western sycamores, Southern California black walnuts and California bay trees — and toyon and Mexican elderberry shrubs — need a permit before removal or relocation (LAMC §46.00–46.06). An arborist survey tells you if any are on or near the lot.', 'StreetsLA — Urban Forestry Division', [L.trees]),
  )
  groups.push({ id: 'studies', title: 'Site studies', items: studies })

  /* ---------- 3. Building code ---------- */
  const code = [
    item(
      'energy',
      'required',
      '2025 Energy Code (Title 24) and solar',
      `Permits applied for from 1 January 2026 follow the 2025 Energy Code. ${!d || d.storeys <= 3 ? 'New homes and low-rise apartments need a solar (PV) system sized by the code.' : 'Buildings over three storeys follow the high-rise multifamily rules.'}`,
      'LADBS (plan check)',
      [L.energy],
    ),
    item('calgreen', 'required', 'CALGreen green building code', `Water-efficient fixtures, construction-waste recycling${d?.parking ? ' and EV-ready parking' : ''}.`, 'LADBS', [L.ladbs]),
    item(
      'sprinklers',
      'required',
      'Fire sprinklers',
      `New homes in California need fire sprinklers.${d?.hasAdu ? ' An ADU needs them only if the main house does — and building an ADU doesn’t force sprinklers into an existing house.' : ''}`,
      'LADBS · LAFD',
      [d?.hasAdu && L.adu, L.ladbs],
    ),
  ]
  const fire = hazard('fire')
  if (fire)
    code.push(
      item(
        'wildfire',
        'required',
        'Wildfire-resistant construction and brush clearance',
        `Fire Hazard Severity Zone (${fire.value}): new buildings must use ignition-resistant construction (California Building Code Chapter 7A — roofs, vents, windows, siding), and vegetation must be cleared within 200 ft of structures every year.`,
        'LADBS · LAFD',
        [L.brush],
      ),
    )
  if (d && d.apartments >= 3)
    code.push(
      item('access', 'required', 'Accessibility for apartments', `${d.apartments} homes in one building: “covered multifamily dwelling” accessibility rules apply (California Building Code Chapter 11A).`, 'LADBS', [L.ladbs]),
    )
  code.push(
    item('allelectric', 'info', 'All-electric rule — no longer required', 'LA’s 2023 rule requiring new buildings to be all-electric was repealed (effective 13 October 2025). Electric heat pumps still help meet the Energy Code.', 'LA City Council', [L.allElectricRepeal]),
  )
  groups.push({ id: 'code', title: 'Building code', items: code })

  /* ---------- 4. Site and utilities ---------- */
  const site = []
  if (builtNow) {
    const pre1978 = ex.yearBuilt && ex.yearBuilt < 1978
    site.push(
      item(
        'demo',
        'required',
        'Demolition permit and asbestos survey',
        `Replacing the existing ${ex.yearBuilt ? `${ex.yearBuilt} ` : ''}building needs a demolition permit, an asbestos survey and SCAQMD notification at least 10 working days before demolition (Rule 1403).${pre1978 ? ' Built before 1978, so expect lead-safe work practices too.' : ''}`,
        'LADBS · South Coast AQMD',
        [L.aqmd],
      ),
    )
  }
  site.push(
    item('lid', 'likely', 'Stormwater (Low Impact Development)', 'LADBS decides at plan check whether the LID ordinance applies; if it does, rainwater must be kept and soaked in or reused on site, and LID clearance is needed before occupancy.', 'LADBS · LA Sanitation', [L.lid]),
    item('sewer', 'required', 'Sewer connection', 'New homes connect to the City sewer; a Sewer Facilities Charge is collected with the permit.', 'LA Sanitation · Bureau of Engineering', [L.sanitation]),
    item('utilities', 'required', 'Water and power service', 'New or upgraded water and electric services are arranged with LADWP.', 'LADWP', [L.ladwp]),
  )
  if (d?.parking || d?.townhomes)
    site.push(item('driveway', 'likely', 'Driveway and street work', 'A new or widened driveway, curb cut or any work in the street needs a Bureau of Engineering permit.', 'LA Bureau of Engineering', [L.boe]))
  if (d && d.mainHomes >= 3)
    site.push(item('dedication', 'check', 'Street dedication or improvements', 'Apartment projects on streets below standard width may have to give a strip of land or improve the sidewalk and street.', 'LA Bureau of Engineering', [L.boe]))
  groups.push({ id: 'site', title: 'Site and utilities', items: site })

  /* ---------- 5. Fees (named, not priced) ---------- */
  const fees = [
    item('fee-permit', 'required', 'Plan check and permit fees', 'Charged by LADBS on the value of the work.', 'LADBS', [L.ladbs]),
    item(
      'fee-school',
      'required',
      'School fees (LAUSD)',
      `Charged per square foot of new homes.${d?.hasAdu ? (d.aduSqft < 500 ? ' This design’s ADU is under 500 sq ft, which is exempt.' : ' ADUs under 500 sq ft are exempt; this one is larger.') : ''}`,
      'Los Angeles Unified School District',
      [L.lausd],
    ),
  ]
  if (!d || d.newHomes > 0 || d.sb9)
    fees.push(item('fee-park', 'check', 'Park fee', 'New homes generally pay a park fee (LAMC §12.33); some, including certain ADUs and affordable homes, are exempt.', 'Recreation & Parks · City Planning', [L.park]))
  fees.push(item('fee-ahlf', 'check', 'Affordable Housing Linkage Fee', 'A per-square-foot fee on many new market-rate homes (LAMC §19.18), with exemptions; the rate depends on the neighbourhood’s market area (updated April 2026).', 'LA City Planning · Housing Department', [L.ahlf]))
  groups.push({ id: 'fees', title: 'Fees to expect', items: fees, note: 'Named only — amounts change often, so get current figures from each agency.' })

  return {
    groups,
    basis: option ? `For: ${option.name} — ${option.tagline}` : 'For building a new home on this lot',
    count: groups.reduce((s, g) => s + g.items.filter((i) => i.level !== 'info').length, 0),
  }
}
