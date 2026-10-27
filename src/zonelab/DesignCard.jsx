/**
 * "Design options for this lot": the visitor's filters, the 2–3 options the
 * generator builds inside the lot's real setbacks, and how each one measures
 * up against every limit from "What you can build".
 *
 * Filters may be pushed past the legal limits on purpose — the option is
 * then drawn anyway and marked in red with the rule it breaks.
 */

import { FloorPlan } from './FloorPlan.jsx'

const fmt = (n) => Math.round(n).toLocaleString('en-US')

const HOME_SIZES = [
  { sqft: 450, label: 'Studio' },
  { sqft: 650, label: '1 bed' },
  { sqft: 850, label: '2 bed' },
  { sqft: 1100, label: '3 bed' },
]

function Stepper({ label, value, min, max, onChange, hint }) {
  return (
    <div className="zd-step" role="group" aria-label={label}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <div>
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Less: ${label}`}>
          −
        </button>
        <b aria-live="polite">{value}</b>
        <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More: ${label}`}>
          +
        </button>
      </div>
    </div>
  )
}

function Filters({ limits, filters, set }) {
  const L = limits
  if (L.kind === 'single') {
    const legal = L.storeysMax ?? Math.max(1, Math.floor((L.flatRoofFt - 1.5) / 10))
    return (
      <div className="zd-filters">
        <Stepper label="Floors" hint={`${legal} fit the limit`} value={filters.floors} min={1} max={Math.min(4, legal + 1)} onChange={(floors) => set({ floors })} />
        <Stepper
          label="Parking spaces"
          hint={L.parking.exempt ? 'none required here' : `${L.parking.perHome} required`}
          value={filters.parking}
          min={0}
          max={4}
          onChange={(parking) => set({ parking })}
        />
        <label className="zd-range">
          <span>
            Garden <b>{filters.garden}%</b> of the lot
          </span>
          <input type="range" min={10} max={70} step={5} value={filters.garden} onChange={(e) => set({ garden: Number(e.target.value) })} />
        </label>
        <button type="button" className={`zl-toggle ${filters.adu ? 'is-on' : ''}`} aria-pressed={filters.adu} onClick={() => set({ adu: !filters.adu })}>
          <span className="zl-toggle__sw" aria-hidden="true" />
          Backyard ADU option
        </button>
      </div>
    )
  }
  const byHeight = L.heightFt ? Math.max(1, Math.floor((L.heightFt - 1.5) / 10)) : null
  return (
    <div className="zd-filters">
      <Stepper label="Floors" hint={byHeight ? `${byHeight} fit the height limit` : 'no height limit in feet'} value={filters.floors} min={1} max={byHeight ? byHeight + 1 : 12} onChange={(floors) => set({ floors })} />
      <Stepper label="Homes" hint={`${L.homes.max} allowed`} value={filters.homes} min={1} max={Math.max(L.homes.max + Math.ceil(L.homes.max * 0.25), L.homes.max + 1)} onChange={(homes) => set({ homes })} />
      <div className="zd-seg" role="radiogroup" aria-label="Home size">
        {HOME_SIZES.map((h) => (
          <button key={h.sqft} type="button" role="radio" aria-checked={filters.homeSize === h.sqft} className={filters.homeSize === h.sqft ? 'is-on' : ''} onClick={() => set({ homeSize: h.sqft })}>
            {h.label}
            <small>{fmt(h.sqft)}</small>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`zl-toggle ${filters.parking ? 'is-on' : ''}`}
        aria-pressed={!!filters.parking}
        onClick={() => set({ parking: filters.parking ? 0 : 1 })}
      >
        <span className="zl-toggle__sw" aria-hidden="true" />
        Parking on the ground floor{L.parking.exempt ? ' (not required here)' : ''}
      </button>
      <label className="zd-range">
        <span>
          Garden <b>{filters.garden}%</b> of the lot
        </span>
        <input type="range" min={10} max={70} step={5} value={filters.garden} onChange={(e) => set({ garden: Number(e.target.value) })} />
      </label>
    </div>
  )
}

function Option({ o, selected, onSelect }) {
  const broken = o.checks?.filter((c) => !c.ok && !c.soft) ?? []
  const soft = o.checks?.filter((c) => !c.ok && c.soft) ?? []
  return (
    <li>
      <button type="button" className={`zd-opt ${selected ? 'is-on' : ''} ${o.unavailable ? 'is-off' : ''}`} aria-pressed={selected} onClick={onSelect} disabled={!!o.unavailable}>
        <span className="zd-opt__head">
          <b>{o.name}</b>
          {o.unavailable ? (
            <em className="zd-pill is-off">Doesn’t fit</em>
          ) : broken.length ? (
            <em className="zd-pill is-red">Breaks {broken.length} rule{broken.length === 1 ? '' : 's'}</em>
          ) : soft.length ? (
            <em className="zd-pill is-amber">Fits · check {soft.map((c) => c.label.toLowerCase()).join(', ')}</em>
          ) : (
            <em className="zd-pill is-ok">Fits the rules</em>
          )}
        </span>
        <span className="zd-opt__tag">{o.unavailable || o.tagline}</span>
        {o.stats && (
          <span className="zd-opt__stats">
            <span>
              <b>{fmt(o.stats.floorSqft)}</b> sq ft
            </span>
            <span>
              <b>{o.stats.homes}</b> home{o.stats.homes === 1 ? '' : 's'}
            </span>
            <span>
              <b>{o.stats.storeys}</b> floor{o.stats.storeys === 1 ? '' : 's'}
            </span>
            <span>
              <b>{o.stats.gardenPct}%</b> garden
            </span>
          </span>
        )}
      </button>
    </li>
  )
}

function Checks({ o }) {
  if (!o?.checks?.length) return null
  return (
    <ul className="zd-checks">
      {o.checks.map((c) => (
        <li key={c.id} className={c.ok ? 'is-ok' : c.soft ? 'is-amber' : 'is-red'}>
          <span className="zd-checks__mark" aria-hidden="true">
            {c.ok ? '✓' : c.soft ? '~' : '✕'}
          </span>
          <span className="zd-checks__label">{c.label}</span>
          <span className="zd-checks__val">
            {c.value}
            <small>
              {!c.ok && !c.soft ? 'Over — ' : ''}
              {c.limit}
            </small>
            {c.note && <small>{c.note}</small>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Side-by-side ✓ / ✕ for every option. */
function Compare({ options }) {
  const live = options.filter((o) => o.checks?.length)
  if (live.length < 2) return null
  const ids = [...new Set(live.flatMap((o) => o.checks.map((c) => c.id)))].filter((id) => id !== 'yards')
  const labelOf = (id) => live.flatMap((o) => o.checks).find((c) => c.id === id)?.label
  return (
    <table className="zd-compare">
      <caption>Compare</caption>
      <thead>
        <tr>
          <th scope="col">Rule</th>
          {live.map((o) => (
            <th key={o.id} scope="col">
              {o.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ids.map((id) => (
          <tr key={id}>
            <th scope="row">{labelOf(id)}</th>
            {live.map((o) => {
              const c = o.checks.find((x) => x.id === id)
              return (
                <td key={o.id} className={!c ? '' : c.ok ? 'is-ok' : c.soft ? 'is-amber' : 'is-red'}>
                  {!c ? '—' : c.ok ? '✓' : c.soft ? '~' : '✕'}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function DesignCard({ limits, design, filters, setFilters, selected, setSelected, in3d, onEnter, floor, setFloor }) {
  if (!limits || !filters) return null
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))
  const options = design?.options ?? []
  const current = options.find((o) => o.id === selected) || options.find((o) => !o.unavailable)

  return (
    <section className="zl-card zd" aria-label="Design options for this lot">
      <p className="zl-card__eyebrow">Design options for this lot</p>
      <p className="zd__lede">Set what you’d like; we fit it inside this lot’s real setbacks and check it against every limit above.</p>

      <Filters limits={limits} filters={filters} set={set} />

      {design?.unavailable ? (
        <p className="zl-warn">{design.unavailable}</p>
      ) : (
        <>
          <ul className="zd-opts">
            {options.map((o) => (
              <Option key={o.id} o={o} selected={current?.id === o.id} onSelect={() => setSelected(o.id)} />
            ))}
          </ul>

          {current && !current.unavailable && (
            <div className="zd-detail">
              <div className="zd-detail__head">
                <p>
                  <b>{current.name}</b> against the rules
                </p>
                {onEnter && !in3d && (
                  <button type="button" className="btn btn--gold btn--sm" onClick={onEnter}>
                    See it in 3D
                  </button>
                )}
              </div>
              <Checks o={current} />
              <FloorPlan option={current} floor={floor} setFloor={setFloor} filters={filters} />
              {[current.extraNote, current.homesShort].filter(Boolean).map((t) => (
                <p key={t} className="zl-muted">
                  {t}
                </p>
              ))}
            </div>
          )}

          <Compare options={options} />
        </>
      )}

      {design?.assumptions && (
        <ul className="zd-assume">
          {design.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
