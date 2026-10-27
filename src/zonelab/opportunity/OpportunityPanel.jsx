import { KINDS, toCSV } from './load.js'

/**
 * Opportunity map controls and results: which signals to show, filters, a
 * count per signal for the area on screen, the list, and a CSV download.
 */

export const PLACES = [
  { id: 'altadena', label: 'Altadena (Eaton fire)', center: [-118.137, 34.19], zoom: 13.4 },
  { id: 'palisades', label: 'Pacific Palisades', center: [-118.535, 34.045], zoom: 13.4 },
  { id: 'highland', label: 'Highland Park', center: [-118.19, 34.115], zoom: 14.2 },
  { id: 'south', label: 'South LA / Watts', center: [-118.24, 33.943], zoom: 14.2 },
  { id: 'valley', label: 'Sun Valley', center: [-118.375, 34.22], zoom: 14.2 },
]

const ago = (days) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
export const SINCE = [
  { id: '30d', label: '30 days', value: () => ago(30) },
  { id: '6m', label: '6 months', value: () => ago(182) },
  { id: '1y', label: '1 year', value: () => ago(365) },
  { id: 'fire', label: 'Since the fires', value: () => '2025-01-07' },
]

const LOT_TYPES = [
  { id: 'all', label: 'All' },
  { id: 'homes', label: 'Homes' },
  { id: 'apartments', label: 'Apartments' },
  { id: 'commercial', label: 'Commercial' },
]

const ORDER = ['cleared', 'burned', 'applied', 'building', 'done', 'vacant', 'demo', 'newbuild']
const fmt = (n) => Number(n).toLocaleString('en-US')

export function OpportunityPanel({ filters, setFilters, result, selected, onSelect, onPlace, onClose }) {
  const items = result.items
  const counts = Object.fromEntries(Object.keys(KINDS).map((k) => [k, 0]))
  for (const i of items) counts[i.kind]++
  const sorted = [...items].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || String(b.date || '').localeCompare(String(a.date || '')))
  const shown = sorted.slice(0, 120)

  const toggle = (k) => setFilters((f) => ({ ...f, kinds: { ...f.kinds, [k]: !f.kinds[k] } }))
  const download = () => {
    const blob = new Blob([toCSV(sorted)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `la-opportunity-map-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  return (
    <section className="zo" aria-label="Opportunity map">
      <div className="zo__head">
        <div>
          <p className="eyebrow">Zone Lab · Opportunity map</p>
          <h2 className="zl__title">
            Where LA is <span className="accent">rebuilding</span>
          </h2>
        </div>
        <button type="button" className="zl-link" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="zo__lede">
        Burned, cleared, empty and newly permitted lots, read live from LA County and the City. These are signs of what’s
        happening on a lot — not what its owner intends.
      </p>
      <p className="zo-notice" role="note">
        <b>For information only.</b> Not for unsolicited offers to buy property in the 2025 fire areas — California law
        restricts below-market offers to fire-affected owners. Not affiliated with or endorsed by LA County or the City of
        LA.
      </p>

      <div className="zo-places">
        {PLACES.map((p) => (
          <button key={p.id} type="button" onClick={() => onPlace(p)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="zo-kinds" role="group" aria-label="What to show">
        {Object.entries(KINDS).map(([k, v]) => (
          <button key={k} type="button" className={filters.kinds[k] ? 'is-on' : ''} aria-pressed={filters.kinds[k]} onClick={() => toggle(k)}>
            <i style={{ background: v.color }} />
            <span>{v.label}</span>
            <b>{filters.kinds[k] ? fmt(counts[k]) : '—'}</b>
          </button>
        ))}
      </div>

      <div className="zo-filters">
        <div className="zo-seg" role="radiogroup" aria-label="Permits issued in the last">
          <span>Permits from</span>
          {SINCE.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={filters.since === s.id} className={filters.since === s.id ? 'is-on' : ''} onClick={() => setFilters((f) => ({ ...f, since: s.id }))}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="zo-seg" role="radiogroup" aria-label="Lot type">
          <span>Lot type</span>
          {LOT_TYPES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={filters.lotType === t.id} className={filters.lotType === t.id ? 'is-on' : ''} onClick={() => setFilters((f) => ({ ...f, lotType: t.id }))}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="zo-status" role="status">
        {result.loading ? (
          <>
            <span className="zl-spin" aria-hidden="true" /> Reading the County and City records for this area…
          </>
        ) : (
          <>
            <b>{fmt(items.length)}</b> in view
            {counts.cleared > 0 && filters.kinds.cleared && (
              <span>
                {' '}
                · <b>{fmt(counts.cleared)}</b> burned lots cleared with no rebuild yet
              </span>
            )}
          </>
        )}
        {result.notes.map((n) => (
          <p key={n} className="zl-muted">
            {n}
          </p>
        ))}
      </div>

      {items.length > 0 && (
        <>
          <div className="zo-listhead">
            <p>
              {items.length > shown.length ? `First ${shown.length} of ${fmt(items.length)}` : 'All results'} · tap to find on the map
            </p>
            <button type="button" className="zl-link" onClick={download}>
              Download CSV
            </button>
          </div>
          <ul className="zo-list">
            {shown.map((i) => (
              <li key={i.id}>
                <button type="button" className={selected === i.id ? 'is-on' : ''} onClick={() => onSelect(i, true)}>
                  <i style={{ background: KINDS[i.kind].color }} />
                  <span>
                    <b>{i.address || `APN ${i.ain}`}</b>
                    <small>
                      {KINDS[i.kind].label}
                      {i.date ? ` · ${i.date}` : ''}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="zl-fine">
        Sources: LA County Public Works (2025 fire lots, debris removal), LA County EPIC-LA (rebuild cases), City of LA LADBS
        (building permits, updated daily), LA County Assessor (vacant land). Public records only — no owner names or contact
        details.
      </p>
    </section>
  )
}

/** Card for the marker that was tapped. */
export function OppCard({ item, onOpen, onClose }) {
  if (!item) return null
  const k = KINDS[item.kind]
  return (
    <div className="zo-card" role="dialog" aria-label={item.title}>
      <button type="button" className="zo-card__x" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <p className="zo-card__kind">
        <i style={{ background: k.color }} />
        {k.label}
      </p>
      <h3>{item.address || `APN ${item.ain}`}</h3>
      <p className="zo-card__title">{item.title}</p>
      <dl>
        {item.status && (
          <div>
            <dt>Status</dt>
            <dd>{item.status}</dd>
          </div>
        )}
        {item.date && (
          <div>
            <dt>Date</dt>
            <dd>{item.date}</dd>
          </div>
        )}
        {item.value ? (
          <div>
            <dt>Permit value</dt>
            <dd>${fmt(item.value)}</dd>
          </div>
        ) : null}
      </dl>
      {item.detail && <p className="zo-card__detail">{item.detail}</p>}
      <p className="zo-card__src">{item.source}</p>
      <button type="button" className="btn btn--gold btn--sm" onClick={onOpen}>
        Open full lot report
      </button>
    </div>
  )
}
