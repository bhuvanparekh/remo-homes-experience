/**
 * Every live data source Zone Lab reads, in one place.
 *
 * Fast tier — City of LA GeoHub, LA County GIS: hosted copies the agencies
 * keep current (the City's zoning and overlay layers were last edited
 * 22 Oct 2026 when this was written). They answer in under a second, so the
 * report appears straight away.
 *
 * Confirm tier — ZIMAS, the City Planning Department's live zoning system.
 * It answers in ~9 s, so it runs in parallel and confirms (or corrects) the
 * zoning once it arrives; it also carries the General Plan land use,
 * community plan and coastal zone.
 *
 * `level` sets how the report flags a hit:
 *   red    the lot has its own extra rules — confirm with the City
 *   amber  extra requirements or a different process apply
 *   info   good to know
 */

const GEOHUB = 'https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services'
const LAHUB = 'https://maps.lacity.org/lahub/rest/services'
const ZIMAS = 'https://zimas.lacity.org/arcgis/rest/services/zma/zimas/MapServer'
const COUNTY = 'https://public.gis.lacounty.gov/public/rest/services'
const HAZ = `${COUNTY}/LACounty_Dynamic/Hazards/MapServer`

export const AGENCY = {
  geohub: { name: 'City of LA GeoHub', url: 'https://geohub.lacity.org/' },
  lahub: { name: 'City of LA (NavigateLA)', url: 'https://navigatela.lacity.org/' },
  zimas: { name: 'City of LA ZIMAS', url: 'https://zimas.lacity.org/' },
  county: { name: 'LA County GIS', url: 'https://egis-lacounty.hub.arcgis.com/' },
  assessor: { name: 'LA County Assessor', url: 'https://portal.assessor.lacounty.gov/' },
  ladcp: { name: 'LA City Planning', url: 'https://planning.lacity.gov/' },
  scag: { name: 'SCAG', url: 'https://scag.ca.gov/' },
}

export const LAYERS = {
  // The lot itself
  countyParcel: { url: `${COUNTY}/LACounty_Cache/LACounty_Parcel/MapServer/0`, agency: 'assessor' },
  cityParcel: { url: `${LAHUB}/Landbase_Information/MapServer/5`, agency: 'lahub', fields: 'PIN,BPP,PIND,TRACT,LOT' },

  // Zoning — fast copy, then live ZIMAS
  zoning: { url: `${GEOHUB}/Zoning/FeatureServer/15`, agency: 'geohub', fields: 'Zoning,CATEGORY' },
  zimasZoning: { url: `${ZIMAS}/1102`, agency: 'zimas', fields: 'ZONE_CMPLT,ZONE_CLASS' },
  zimasZoning1A: { url: `${ZIMAS}/1101`, agency: 'zimas', fields: 'ZONE_CMPLT,ZONELEGEND' },
  generalPlan: { url: `${ZIMAS}/1202`, agency: 'zimas' },
  communityPlan: { url: `${ZIMAS}/103`, agency: 'zimas', fields: 'NAME_ALF' },
}

/**
 * The 3D site model. Building outlines and roof heights (feet) are LARIAC,
 * the County's aerial survey; the ground photo is Esri World Imagery; ground
 * height is AWS Terrain Tiles (USGS 3DEP in the US), 'terrarium' encoding.
 */
export const SITE = {
  buildings: { url: `${COUNTY}/LACounty_Dynamic/LARIAC_Buildings_2020/MapServer/0`, fields: 'BLD_ID,CODE,HEIGHT' },
  imagery: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  terrain: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  terrainZoom: 15,
  // Street-level view: City street centrelines (with their official street
  // type), alleys, and StreetsLA's street-tree inventory.
  streets: { url: `${LAHUB}/Street_Information/MapServer/36`, fields: 'STNAME,STSFX,Street_Designation,Street_Designation_WO_Mod' },
  alleys: { url: `${LAHUB}/Street_Information/MapServer/32`, fields: 'OBJECTID' },
  trees: { url: `${GEOHUB}/Trees_Data_Bureau_of_Street_Services/FeatureServer/0`, fields: 'TreeID,TOOLTIP' },
}

/**
 * Overlays and hazards: each becomes a chip in the report when the lot is in it.
 * `value(attrs)` names the specific district; `law` is where its rules live.
 */
export const OVERLAYS = [
  {
    id: 'specificPlan',
    label: 'Specific Plan',
    url: `${GEOHUB}/Specific_Plan_Areas/FeatureServer/6`,
    agency: 'geohub',
    value: (a) => a.SPA_NM,
    level: 'red',
    note: 'A specific plan replaces or adds to the base zoning rules for this area.',
    law: 'Specific plan ordinance',
  },
  {
    id: 'hpoz',
    label: 'Historic Preservation Overlay Zone',
    url: `${GEOHUB}/Historic_Preservation_Overlay_Zones/FeatureServer/5`,
    agency: 'geohub',
    value: (a) => a.NAME,
    level: 'red',
    note: 'Exterior changes and new buildings need historic review (HPOZ board).',
    law: 'LAMC §12.20.3',
  },
  {
    id: 'cpio',
    label: 'Community Plan Implementation Overlay',
    url: `${GEOHUB}/Zoning_Supplemental_Use_Districts/FeatureServer/48`,
    agency: 'geohub',
    value: (a) => a.NAME,
    level: 'red',
    note: 'Subarea rules can change height, density and design standards.',
    law: 'LAMC §13.14',
  },
  {
    id: 'ico',
    label: 'Interim Control Ordinance',
    url: `${LAHUB}/City_Planning_Department/MapServer/11`,
    agency: 'lahub',
    value: (a) => a.NAME,
    level: 'red',
    note: 'A temporary ordinance may pause or limit certain permits here.',
    law: 'Interim control ordinance',
  },
  {
    id: 'hillside',
    label: 'Hillside Area',
    url: `${LAHUB}/Special_Areas/MapServer/6`,
    agency: 'lahub',
    value: (a) => a.H_TYPE,
    level: 'amber',
    note: 'Baseline Hillside Ordinance: stricter floor area, height and grading limits.',
    law: 'LAMC §12.21 C.10',
  },
  {
    id: 'hcr',
    label: 'Hillside Construction Regulation District',
    url: `${GEOHUB}/Zoning_Supplemental_Use_Districts/FeatureServer/26`,
    agency: 'geohub',
    value: (a) => a.NAME,
    level: 'amber',
    note: 'Limits on grading, hauling and construction hours.',
    law: 'LAMC §13.20',
  },
  {
    id: 'cdo',
    label: 'Community Design Overlay',
    url: `${GEOHUB}/Zoning_Supplemental_Use_Districts/FeatureServer/49`,
    agency: 'geohub',
    value: (a) => a.NAME,
    level: 'amber',
    note: 'Design guidelines and a sign-off apply to new buildings.',
    law: 'LAMC §13.08',
  },
  {
    id: 'nso',
    label: 'Neighborhood Stabilization Overlay',
    url: `${GEOHUB}/Zoning_Supplemental_Use_Districts/FeatureServer/51`,
    agency: 'geohub',
    value: (a) => a.NAME,
    level: 'amber',
    note: 'Limits on how many people can share a single-family home.',
    law: 'LAMC §13.12',
  },
  {
    id: 'rfa',
    label: 'Residential Floor Area District',
    url: `${GEOHUB}/Zoning_Supplemental_Use_Districts/FeatureServer/12`,
    agency: 'geohub',
    value: (a) => a.NAME,
    level: 'amber',
    note: 'A different maximum house size applies than the citywide rule.',
    law: 'LAMC §13.13',
  },
  {
    id: 'pod',
    label: 'Pedestrian Oriented District',
    url: `${GEOHUB}/Zoning_Supplemental_Use_Districts/FeatureServer/53`,
    agency: 'geohub',
    value: (a) => a.NAME,
    level: 'info',
    note: 'Storefront and street-facing design standards.',
    law: 'LAMC §13.07',
  },
  {
    id: 'mprd',
    label: 'Modified Parking Requirement District',
    url: `${GEOHUB}/Zoning_Supplemental_Use_Districts/FeatureServer/8`,
    agency: 'geohub',
    value: (a) => a.NAME,
    level: 'info',
    note: 'Parking requirements differ from the citywide rules.',
    law: 'LAMC §13.15',
  },
  {
    id: 'toia',
    label: 'Transit Oriented Incentive Area',
    url: `${GEOHUB}/Mixed_Income_Incentive_Program/FeatureServer/2`,
    agency: 'geohub',
    value: (a) => a.TOIA_Type,
    level: 'info',
    note: 'Housing incentives near transit (Mixed Income Incentive Program).',
    law: 'Citywide Housing Incentive Program (2025)',
  },
  {
    id: 'oc',
    label: 'Opportunity Corridor',
    url: `${GEOHUB}/Mixed_Income_Incentive_Program/FeatureServer/3`,
    agency: 'geohub',
    value: (a) => a.OC_Type,
    level: 'info',
    note: 'Housing incentives along commercial corridors (Mixed Income Incentive Program).',
    law: 'Citywide Housing Incentive Program (2025)',
  },
  {
    id: 'ct',
    label: 'Corridor Transition Incentive Area',
    url: `${GEOHUB}/Mixed_Income_Incentive_Program/FeatureServer/75`,
    agency: 'geohub',
    value: (a) => a.CT_Type,
    level: 'info',
    note: 'Housing incentives next to corridors (Mixed Income Incentive Program).',
    law: 'Citywide Housing Incentive Program (2025)',
  },
  {
    // SCAG's Transit Priority Areas: ½ mile around major transit stops (Jan 2026
    // map, AB 2553 definition; includes stops planned in the regional plan).
    id: 'tpa',
    label: 'Transit Priority Area',
    url: 'https://rdp.scag.ca.gov/hosting/rest/services/Hosted/TPA_DMB_Mar2026/FeatureServer/1',
    agency: 'scag',
    value: () => 'Within ½ mile of a major transit stop',
    level: 'info',
    note: 'State law (AB 2097) bars minimum parking for most housing here. The City confirms it on the ZIMAS parcel report.',
    law: 'Gov. Code §65863.2 (AB 2097)',
  },
  {
    // LA City Planning's SB 79 station areas (May 2026).
    id: 'sb79',
    label: 'SB 79 transit area',
    url: 'https://services1.arcgis.com/tzwalEyxl2rpamKs/arcgis/rest/services/SB79_TOD_Zones_May2026/FeatureServer/31',
    agency: 'ladcp',
    value: (a) => a.SB79_TOD_Tiers1_2_buffers_03_24_26_Station,
    level: 'info',
    note: 'Since 1 July 2026, state law can allow taller, denser housing (5+ homes) near major stations. LA is phasing it in — ask City Planning.',
    law: 'SB 79 (2025)',
  },
]

/** Coastal zone comes from ZIMAS only (confirm tier). */
export const COASTAL = [
  { url: `${ZIMAS}/1604`, kind: 'Single Permit Jurisdiction' },
  { url: `${ZIMAS}/1603`, kind: 'Dual Permit Jurisdiction' },
  { url: `${ZIMAS}/1605`, kind: 'Coastal Commission Permit Area' },
]

export const HAZARDS = [
  {
    id: 'fire',
    label: 'Fire Hazard Severity Zone',
    url: `${HAZ}/2`,
    agency: 'county',
    // "Non-Wildland" areas are mapped but are not a hazard zone.
    keep: (a) => /moderate|high/i.test(a.HAZ_CLASS || ''),
    value: (a) => `${a.HAZ_CLASS}${a.SRA ? ` (${a.SRA === 'LRA' ? 'local responsibility' : a.SRA === 'SRA' ? 'state responsibility' : a.SRA})` : ''}`,
    level: (a) => (/very high/i.test(a.HAZ_CLASS) ? 'red' : 'amber'),
    note: 'Wildfire building standards apply: ignition-resistant materials and defensible space.',
    law: 'CA Building Code Ch. 7A',
  },
  {
    id: 'fault',
    label: 'Earthquake Fault Zone',
    url: `${HAZ}/5`,
    agency: 'county',
    value: (a) => a.ZONE_TYPE || 'Alquist-Priolo zone',
    level: 'red',
    note: 'A fault study by a geologist is required before building.',
    law: 'Alquist-Priolo Act',
  },
  {
    id: 'landslide',
    label: 'Landslide Zone',
    url: `${HAZ}/8`,
    agency: 'county',
    value: () => 'Earthquake-induced landslide zone',
    level: 'amber',
    note: 'A geotechnical report is required.',
    law: 'Seismic Hazards Mapping Act',
  },
  {
    id: 'liquefaction',
    label: 'Liquefaction Zone',
    url: `${HAZ}/9`,
    agency: 'county',
    value: () => 'Liquefaction potential',
    level: 'amber',
    note: 'A soils report and suitable foundations are required.',
    law: 'Seismic Hazards Mapping Act',
  },
  {
    id: 'flood',
    label: '100-Year Flood Zone',
    url: `${HAZ}/11`,
    agency: 'county',
    value: (a) => (a.FLD_ZONE ? `FEMA zone ${a.FLD_ZONE}` : 'FEMA flood zone'),
    level: 'amber',
    note: 'Floor levels and flood-resistant construction rules apply.',
    law: 'FEMA flood maps · LA Flood Hazard Management Specific Plan',
  },
]
