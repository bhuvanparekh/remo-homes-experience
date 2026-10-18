/**
 * Every word on the site that isn't UI chrome.
 *
 * Copy is ReMo's own, lifted from remo.homes (home, /our-homes, /our-method,
 * /factory-tour) in October 2026. Nothing here is invented marketing: where a
 * room needs a line, it borrows the sentence from their site that describes
 * that system. Edit here; components only lay it out.
 */
export const COMPANY = {
  legalName: 'ReMo Homes, Inc.',
  address: '15934 S. Figueroa St., Gardena, CA 90248',
  phone: '(310) 910-1132',
  phoneHref: 'tel:+13109101132',
  email: 'info@remo.homes',
  site: 'https://www.remo.homes',
  factoryTourUrl: 'https://www.remo.homes/factory-tour',
  contactUrl: 'https://www.remo.homes/contact',
  instagram: 'https://www.instagram.com/remo.homes/',
  linkedin: 'https://www.linkedin.com/company/remo-homes/',
  x: 'https://x.com/remohomes',
}

export const HERO = {
  eyebrow: 'Steel modular homes · Built in Los Angeles',
  title: ['From rockets', 'to residences.'],
  body:
    'ReMo turns aerospace engineering into resilient, all-electric homes—precision-built indoors and designed for the realities of living in California.',
}

export const STATS = [
  {
    value: 'First',
    label: 'California first',
    body: 'First modular company with statewide pre-approval and an LA County Standard Plan listing.',
  },
  {
    value: '$3M',
    label: 'CEC grant',
    body: 'State support for zero-carbon and near-zero-carbon modular housing innovation.',
  },
  {
    value: 'NASA · SpaceX',
    label: 'Aerospace talent',
    body: 'Experience from NASA, SpaceX, defense, and advanced manufacturing programs.',
  },
]

export const SITE = {
  eyebrow: 'One home / A scalable platform',
  title: 'Designed for one site. Ready for many.',
  body:
    'A standardized platform creates the common foundation; siting, orientation, landscape, and deployment respond to place.',
  rebuild: {
    title: 'Rebuild with more certainty.',
    body:
      'For families navigating wildfire recovery, the SupReMo begins with a pre-reviewed home plan, a high-performance steel system, and a team focused on reducing avoidable friction.',
  },
}

/** ReMo's own four-step story (home page), with detail from /our-method. */
export const METHOD = [
  {
    id: 'design',
    n: '01',
    title: 'Design',
    kicker: 'Resolve before building',
    body:
      'Architecture, structure, envelope, mechanical, electrical, plumbing and energy systems are coordinated in one shared digital model.',
  },
  {
    id: 'preapprove',
    n: '02',
    title: 'Pre-approve',
    kicker: 'California’s first',
    body: 'The first statewide-preapproved modular home design, listed in LA County’s wildfire-rebuild catalog.',
  },
  {
    id: 'manufacture',
    n: '03',
    title: 'Manufacture',
    kicker: 'Controlled environment',
    body:
      'Steel-framed modules are built indoors with defined workstations, protected materials and continuous quality checks. Weather stops influencing the schedule.',
  },
  {
    id: 'deliver',
    n: '04',
    title: 'Deliver',
    kicker: 'Precision placement',
    body:
      'Completed modules travel to the site and are set with a coordinated transport and crane plan. Most of the home arrives already assembled.',
  },
]

export const HOME = {
  eyebrow: 'Residence 01 / The SupReMo™',
  title: 'Meet the SupReMo™.',
  body: 'Modern enough to inspire. Practical enough to repeat. Engineered to perform across California and beyond.',
  quiet: ['Quiet architecture.', 'Serious capability.'],
  specs: [
    { label: 'Area', value: '1,365 SF' },
    { label: 'Plan', value: '3 bed / 2 bath' },
    { label: 'Structure', value: 'Steel modular' },
    { label: 'Energy', value: 'All-electric' },
  ],
}

/**
 * The walkthrough, in the order you meet the rooms. Names are ReMo's own
 * captions from /our-homes; `line` is the site's sentence for that system.
 */
export const ROOMS = [
  {
    id: 'entry',
    name: 'Entry',
    role: 'Arrival',
    line: 'A precise exterior designed to feel at home in the landscape—not announce how hard it works.',
  },
  {
    id: 'living',
    name: 'Living',
    role: 'Open plan',
    line: 'Three private bedrooms and two full baths orbit a generous open living core.',
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    role: 'All-electric',
    line: 'Heat-pump systems, a high-performance envelope, solar readiness, and factory-integrated energy features.',
  },
  {
    id: 'dining',
    name: 'Dining',
    role: 'Integrated storage',
    line: 'Storage, circulation, utilities, and daylight are organized as one system—not leftover space.',
  },
  {
    id: 'primarySuite',
    name: 'Primary suite',
    role: 'Quiet retreat',
    line: 'A controlled envelope, all-electric systems, and low-VOC materials support cleaner air and consistent comfort.',
  },
  {
    id: 'bath',
    name: 'Bath',
    role: 'Refined utility',
    line: 'Non-combustible steel, a Class A roof assembly, and ember-resistant detailing address fire-prone conditions.',
  },
]

export const PICKER_COPY = {
  eyebrow: 'Inside the SupReMo™',
  title: 'Choose a room.',
  body: 'Three private bedrooms and two full baths around one open living core. Pick a room to walk straight in.',
}

export const VISIT = {
  eyebrow: 'Factory tours · Gardena, California',
  title: ['See the product.', 'See the process.'],
  body:
    'Visit ReMo’s Los Angeles factory to experience the home in person and see the manufacturing system behind it.',
  facts: ['Free', 'By appointment', 'Gardena, CA'],
  dates: [
    { day: '21', month: 'October 2026', weekday: 'Wednesday' },
    { day: '19', month: 'November 2026', weekday: 'Thursday' },
  ],
}
